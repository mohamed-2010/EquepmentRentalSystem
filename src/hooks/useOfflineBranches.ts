import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  BranchData,
} from "@/lib/offline/db";
import { addToQueue } from "@/lib/offline/queue";
import { getQueue, removeFromQueue } from "@/lib/offline/queue";
import { syncWithBackend } from "@/lib/offline/sync";
import { v4 as uuidv4 } from "uuid";

export function useOfflineBranches(searchQuery: string = "") {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    loadBranches();
  }, [searchQuery]);

  // Load from server only when transitioning to online
  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, reloading branches...");
      loadBranches();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      // Always load from local first for instant display
      await loadFromLocal();
      // fallback: لو المخزن المحلي فاضي، جرّب القراءة من localStorage cache
      const current = await getAllFromLocal("branches");
      if ((!current || current.length === 0) && !isOnline) {
        try {
          const cachedStr = localStorage.getItem("branches_cache");
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (Array.isArray(cached) && cached.length > 0) {
              for (const b of cached) {
                await saveToLocal("branches", { ...b, synced: true });
              }
              await loadFromLocal();
            }
          }
        } catch (e) {
          console.warn("Failed to load branches from cache", e);
        }
      }
      setIsLoading(false);

      // Then fetch from backend if online
      if (isOnline) {
        try {
          let query = supabase
            .from("branches")
            .select("*")
            .order("created_at", { ascending: false });

          if (searchQuery) {
            query = query.or(
              `name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
            );
          }

          const { data, error } = await query;

          if (!error && data) {
            // Exclude rows pending local delete from being re-added
            let filteredServer = data as BranchData[];
            try {
              const q = await getQueue();
              const deleteIds = new Set(
                q
                  .filter(
                    (qi) => qi.operation === "delete" && qi.table === "branches"
                  )
                  .map((qi) => qi.data?.id)
              );
              if (deleteIds.size > 0) {
                filteredServer = filteredServer.filter(
                  (b) => !deleteIds.has(b.id)
                );
              }
            } catch {}

            // حفظ في IndexedDB
            for (const item of filteredServer) {
              await saveToLocal("branches", {
                ...item,
                synced: true,
              });
            }
            // واحفظ نسخة في localStorage للاستخدام كفولباك
            try {
              localStorage.setItem(
                "branches_cache",
                JSON.stringify(filteredServer)
              );
            } catch {}
            setBranches(filteredServer as BranchData[]);
          }
        } catch (error) {
          console.error("Error fetching branches from server:", error);
        }
      }
    } catch (error) {
      console.error("Error loading branches:", error);
      setIsLoading(false);
    }
  };

  const loadFromLocal = async () => {
    const localBranches = await getAllFromLocal("branches");
    let filtered = localBranches as BranchData[];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.company_name &&
            item.company_name
              .toLowerCase()
              .includes(searchQuery.toLowerCase())) ||
          (item.phone &&
            item.phone.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setBranches(filtered);
  };

  const addBranch = async (
    data: Omit<BranchData, "id" | "created_at" | "updated_at" | "synced">
  ) => {
    const newBranch: BranchData = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // حفظ محلياً دائماً
    await saveToLocal("branches", newBranch);
    await addToQueue("branches", "insert", newBranch);

    // إذا كان online، حاول الحفظ في Supabase مباشرة
    if (isOnline) {
      try {
        const branchToInsert: any = {
          name: data.name,
          company_name: data.company_name,
          phone: data.phone,
          address: data.address,
          tax_number: data.tax_number,
          commercial_registration: data.commercial_registration,
        };

        const { data: inserted, error } = await supabase
          .from("branches")
          .insert(branchToInsert)
          .select()
          .single();

        if (!error && inserted) {
          const oldId = newBranch.id;
          newBranch.id = inserted.id;
          newBranch.synced = true;
          await saveToLocal("branches", newBranch);
          // Remove queued insert for old temp id to avoid duplicates
          try {
            const q = await getQueue();
            const match = q.find(
              (qi) =>
                qi.table === "branches" &&
                qi.operation === "insert" &&
                qi.data?.id === oldId
            );
            if (match) await removeFromQueue(match.id);
          } catch {}
        }
      } catch (error) {
        console.error("Error syncing branch to Supabase:", error);
        // الحفظ المحلي نجح، سيتم المزامنة لاحقاً
      }
    }

    // Refresh from local to reflect any id changes from online insert
    await loadFromLocal();

    return newBranch;
  };

  const updateBranch = async (id: string, data: Partial<BranchData>) => {
    const existing = branches.find((b) => b.id === id);
    if (!existing) return;

    const updated: BranchData = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("branches", updated);
    await addToQueue("branches", "update", updated);

    // إذا كان online، حاول التحديث في Supabase مباشرة
    if (isOnline) {
      try {
        const { error } = await supabase
          .from("branches")
          .update(data as any)
          .eq("id", id);

        if (!error) {
          updated.synced = true;
          await saveToLocal("branches", updated);
        }
      } catch (error) {
        console.error("Error syncing branch update to Supabase:", error);
      }
    }

    // Update local state immediately without reloading
    setBranches((prev) => prev.map((b) => (b.id === id ? updated : b)));

    return updated;
  };

  const deleteBranch = async (id: string) => {
    // Check dependencies locally
    const [customers, equipment, rentals] = await Promise.all([
      getAllFromLocal("customers"),
      getAllFromLocal("equipment"),
      getAllFromLocal("rentals"),
    ]);

    const hasDeps =
      customers?.some((c: any) => c.branch_id === id) ||
      equipment?.some((e: any) => e.branch_id === id) ||
      rentals?.some((r: any) => r.branch_id === id);
    if (hasDeps) {
      throw new Error(
        "لا يمكن حذف الفرع لوجود بيانات مرتبطة به (عملاء/معدات/إيجارات)"
      );
    }

    // If online, try direct deletion first (without select to avoid 406)
    if (isOnline) {
      try {
        const { error } = await supabase.from("branches").delete().eq("id", id);
        if (!error) {
          // Verify deletion by querying existence
          const { data: still } = await supabase
            .from("branches")
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (!still) {
            await deleteFromLocal("branches", id);
            setBranches((prev) => prev.filter((b) => b.id !== id));
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

    await deleteFromLocal("branches", id);
    await addToQueue("branches", "delete", { id });
    setBranches((prev) => prev.filter((b) => b.id !== id));
    if (isOnline) {
      try {
        await syncWithBackend();
      } catch {}
    }
  };

  return {
    branches,
    isLoading,
    addBranch,
    updateBranch,
    deleteBranch,
    refresh: loadBranches,
  };
}
