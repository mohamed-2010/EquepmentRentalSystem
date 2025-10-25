import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  EquipmentData,
} from "@/lib/offline/db";
import { addToQueue } from "@/lib/offline/queue";
import { getQueue, removeFromQueue } from "@/lib/offline/queue";
import { syncWithBackend } from "@/lib/offline/sync";
import { v4 as uuidv4 } from "uuid";

export function useOfflineEquipment(searchQuery: string = "") {
  const [equipment, setEquipment] = useState<EquipmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    loadEquipment();
  }, [searchQuery]);

  // Load from server only when transitioning to online
  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, reloading equipment...");
      loadEquipment();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  const loadEquipment = async () => {
    setIsLoading(true);
    try {
      // Load from local first for instant UI
      const localEquipment = await getAllFromLocal("equipment");
      let filtered = localEquipment as EquipmentData[];

      if (searchQuery) {
        filtered = filtered.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.category &&
              item.category.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      setEquipment(filtered);
      setIsLoading(false);

      // Then fetch fresh data if online
      if (isOnline) {
        try {
          let query = supabase
            .from("equipment")
            .select("*")
            .order("created_at", { ascending: false });

          if (searchQuery) {
            query = query.or(
              `name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`
            );
          }

          const { data, error } = await query;
          if (!error && data) {
            // Exclude rows pending local delete from being re-added
            let filteredServer = data as EquipmentData[];
            try {
              const q = await getQueue();
              const deleteIds = new Set(
                q
                  .filter(
                    (qi) =>
                      qi.operation === "delete" && qi.table === "equipment"
                  )
                  .map((qi) => qi.data?.id)
              );
              if (deleteIds.size > 0) {
                filteredServer = filteredServer.filter(
                  (e) => !deleteIds.has(e.id)
                );
              }
            } catch {}

            for (const item of filteredServer) {
              await saveToLocal("equipment", { ...item, synced: true });
            }
            setEquipment(filteredServer as EquipmentData[]);
          }
        } catch (error) {
          console.error("Error fetching equipment from server:", error);
        }
      }
    } catch (error) {
      console.error("Error loading equipment:", error);
      setIsLoading(false);
    }
  };

  const loadFromLocal = async () => {
    const localEquipment = await getAllFromLocal("equipment");
    let filtered = localEquipment as EquipmentData[];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.category &&
            item.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setEquipment(filtered);
  };

  const addEquipment = async (
    data: Omit<EquipmentData, "id" | "created_at" | "updated_at" | "synced">
  ) => {
    const newEquipment: EquipmentData = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // حفظ محلياً دائماً
    await saveToLocal("equipment", newEquipment);
    await addToQueue("equipment", "insert", newEquipment);

    // إذا كان online، حاول الحفظ في Supabase مباشرة
    if (isOnline) {
      try {
        const equipmentToInsert: any = {
          name: data.name,
          code: data.code,
          category: data.category,
          daily_rate: data.daily_rate,
          status: data.status,
          notes: data.notes,
          branch_id: data.branch_id,
        };

        const { data: inserted, error } = await supabase
          .from("equipment")
          .insert(equipmentToInsert)
          .select()
          .single();

        if (!error && inserted) {
          // Sync local record id with server id
          const oldId = newEquipment.id;
          newEquipment.id = inserted.id;
          newEquipment.synced = true;
          await saveToLocal("equipment", newEquipment);
          // Remove queued insert for old temp id to avoid duplicates
          try {
            const q = await getQueue();
            const match = q.find(
              (qi) =>
                qi.table === "equipment" &&
                qi.operation === "insert" &&
                qi.data?.id === oldId
            );
            if (match) await removeFromQueue(match.id);
          } catch {}
        }
      } catch (error) {
        console.error("Error syncing equipment to Supabase:", error);
        // الحفظ المحلي نجح، سيتم المزامنة لاحقاً
      }
    }

    // Refresh from local to ensure state reflects any id changes from online insert
    await loadEquipment();
    return newEquipment;
  };

  const updateEquipment = async (id: string, data: Partial<EquipmentData>) => {
    const existing = equipment.find((e) => e.id === id);
    if (!existing) return;

    const updated: EquipmentData = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("equipment", updated);
    await addToQueue("equipment", "update", updated);
    // Try online update immediately when connected
    if (isOnline) {
      try {
        const serverData: any = { ...data };
        // Clean undefined to avoid overwriting with nulls
        Object.keys(serverData).forEach((k) =>
          serverData[k] === undefined ? delete serverData[k] : null
        );
        const { error } = await supabase
          .from("equipment")
          .update(serverData)
          .eq("id", id);
        if (!error) {
          updated.synced = true;
          await saveToLocal("equipment", updated);
        }
      } catch (e) {
        console.warn("Online equipment update failed, will sync later", e);
      }
    }
    await loadEquipment();

    return updated;
  };

  const deleteEquipment = async (id: string) => {
    const existing = equipment.find((e) => e.id === id);
    if (!existing) return;

    // Prevent deletion if rented
    if (existing.status === "rented") {
      throw new Error("لا يمكن حذف معدة مؤجرة حالياً");
    }

    // Also prevent delete if referenced by active rental items locally
    const items = await getAllFromLocal("rental_items");
    const isReferenced = items?.some(
      (ri: any) => ri.equipment_id === id && !ri.return_date
    );
    if (isReferenced) {
      throw new Error("لا يمكن حذف المعدة لوجود بنود إيجار نشطة مرتبطة بها");
    }

    // If online, try direct deletion first (without select to avoid 406)
    if (isOnline) {
      try {
        let { error } = await supabase.from("equipment").delete().eq("id", id);
        if (error && existing.code) {
          const byCode = await supabase
            .from("equipment")
            .delete()
            .eq("code", existing.code);
          error = byCode.error ?? null;
        }
        if (!error) {
          // Verify deletion by querying existence
          const { data: still } = await supabase
            .from("equipment")
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (!still) {
            await deleteFromLocal("equipment", id);
            setEquipment((prev) => prev.filter((e) => e.id !== id));
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

    await deleteFromLocal("equipment", id);
    await addToQueue("equipment", "delete", { id });
    setEquipment((prev) => prev.filter((e) => e.id !== id));
    if (isOnline) {
      try {
        await syncWithBackend();
      } catch {}
    }
  };

  return {
    equipment,
    isLoading,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    refresh: loadEquipment,
  };
}
