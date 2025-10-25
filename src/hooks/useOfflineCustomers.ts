import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  CustomerData,
} from "@/lib/offline/db";
import { addToQueue } from "@/lib/offline/queue";
import { v4 as uuidv4 } from "uuid";
import { syncWithBackend } from "@/lib/offline/sync";
import { getQueue, removeFromQueue } from "@/lib/offline/queue";

export function useOfflineCustomers(searchQuery: string = "") {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  // Load from server only when transitioning to online
  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, reloading customers...");
      loadCustomers();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      // Always load from local first for instant display
      const localCustomers = await getAllFromLocal("customers");
      let filtered = localCustomers as CustomerData[];

      if (searchQuery) {
        filtered = filtered.filter(
          (customer) =>
            customer.full_name
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            customer.phone.includes(searchQuery) ||
            (customer.id_number && customer.id_number.includes(searchQuery))
        );
      }

      setCustomers(filtered);
      setIsLoading(false);

      // Then fetch from backend if online
      if (isOnline) {
        try {
          let query = supabase
            .from("customers")
            .select("*")
            .order("created_at", { ascending: false });

          if (searchQuery) {
            query = query.or(
              `full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,id_number.ilike.%${searchQuery}%`
            );
          }

          const { data, error } = await query;

          if (!error && data) {
            // Exclude rows pending local delete from being re-added
            let filteredServer = data as CustomerData[];
            try {
              const q = await getQueue();
              const deleteIds = new Set(
                q
                  .filter(
                    (qi) =>
                      qi.operation === "delete" && qi.table === "customers"
                  )
                  .map((qi) => qi.data?.id)
              );
              if (deleteIds.size > 0) {
                filteredServer = filteredServer.filter(
                  (c) => !deleteIds.has(c.id)
                );
              }
            } catch {}

            // Save to local
            for (const customer of filteredServer) {
              await saveToLocal("customers", {
                ...customer,
                synced: true,
              });
            }
            setCustomers(filteredServer as CustomerData[]);
          }
        } catch (error) {
          console.error("Error fetching customers from server:", error);
        }
      }
    } catch (error) {
      console.error("Error loading customers:", error);
      setIsLoading(false);
    }
  };

  const loadFromLocal = async () => {
    const localCustomers = await getAllFromLocal("customers");
    let filtered = localCustomers as CustomerData[];

    if (searchQuery) {
      filtered = filtered.filter(
        (customer) =>
          customer.full_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery) ||
          (customer.id_number && customer.id_number.includes(searchQuery))
      );
    }

    setCustomers(filtered);
  };

  const addCustomer = async (
    data: Omit<CustomerData, "id" | "created_at" | "updated_at" | "synced">
  ) => {
    const newCustomer: CustomerData = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // Save to local
    await saveToLocal("customers", newCustomer);

    // Add to sync queue
    await addToQueue("customers", "insert", newCustomer);

    // If online, attempt direct insert to get real server id
    if (isOnline) {
      try {
        const toInsert: any = {
          full_name: data.full_name,
          phone: data.phone,
          id_number: data.id_number,
          notes: data.notes,
          branch_id: data.branch_id,
        };
        const { data: inserted, error } = await supabase
          .from("customers")
          .insert(toInsert)
          .select()
          .single();
        if (!error && inserted) {
          const oldId = newCustomer.id;
          newCustomer.id = inserted.id;
          newCustomer.synced = true;
          await saveToLocal("customers", newCustomer);
          try {
            const q = await getQueue();
            const match = q.find(
              (qi) =>
                qi.table === "customers" &&
                qi.operation === "insert" &&
                qi.data?.id === oldId
            );
            if (match) await removeFromQueue(match.id);
          } catch {}
        }
      } catch (e) {
        // fallback to queued insert
      }
    }

    // Update local state immediately without reloading
    // Reload to reflect potential id changes
    await loadFromLocal();

    return newCustomer;
  };

  const updateCustomer = async (id: string, data: Partial<CustomerData>) => {
    const existing = customers.find((c) => c.id === id);
    if (!existing) return;

    const updated: CustomerData = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("customers", updated);
    await addToQueue("customers", "update", updated);

    // Try online update immediately when connected
    if (isOnline) {
      try {
        const serverData: any = { ...data };
        Object.keys(serverData).forEach((k) =>
          serverData[k] === undefined ? delete serverData[k] : null
        );
        const { error } = await supabase
          .from("customers")
          .update(serverData)
          .eq("id", id);
        if (!error) {
          updated.synced = true;
          await saveToLocal("customers", updated);
        }
      } catch (e) {
        console.warn("Online customer update failed, will sync later", e);
      }
    }

    // optimistic update
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteCustomer = async (id: string) => {
    // prevent deleting if there are rentals referencing this customer locally
    const rentals = await getAllFromLocal("rentals");
    const hasRentals = rentals?.some((r: any) => r.customer_id === id);
    if (hasRentals) {
      throw new Error("لا يمكن حذف العميل لوجود إيجارات مرتبطة به");
    }

    const existing = customers.find((c) => c.id === id);
    if (!existing) return;

    // If online, try direct deletion first
    if (isOnline) {
      try {
        // Perform delete without select to avoid 406 issues
        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("id", id);
        if (!error) {
          // Verify deletion by querying existence
          const { data: exists } = await supabase
            .from("customers")
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (!exists) {
            await deleteFromLocal("customers", id);
            setCustomers((prev) => prev.filter((c) => c.id !== id));
            return;
          } else {
            console.warn(
              "Delete call returned success but record still exists (RLS or constraint?)"
            );
          }
        }
      } catch (e) {
        // fallback to queue below
      }
    }

    // Fallback: queue delete and sync if possible
    await deleteFromLocal("customers", id);
    await addToQueue("customers", "delete", { id });
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (isOnline) {
      try {
        await syncWithBackend();
      } catch {}
    }
  };

  return {
    customers,
    isLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: loadCustomers,
  };
}
