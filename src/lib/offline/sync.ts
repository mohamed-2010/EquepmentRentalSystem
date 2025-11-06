import { supabase } from "@/integrations/supabase/client";
import { getQueue, removeFromQueue, updateQueueItem, QueueItem } from "./queue";
import {
  saveToLocal,
  getAllFromLocal,
  clearStore,
  bulkSaveToLocal,
} from "./db";
import { toast } from "sonner";

const MAX_RETRIES = 3;
let isSyncing = false;

export async function syncWithBackend(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
}> {
  if (isSyncing) {
    console.log("Sync already in progress");
    return { success: true, synced: 0, failed: 0 };
  }

  isSyncing = true;

  try {
    const queue = await getQueue();

    if (queue.length === 0) {
      return { success: true, synced: 0, failed: 0 };
    }

    console.log(`Starting sync of ${queue.length} items`);
    let synced = 0;
    let failed = 0;

    // ترتيب العمليات: insert أولاً، ثم update، ثم delete
    // داخل insert، قم بترتيب الجداول حسب الاعتمادية: branches -> customers/equipment -> rentals -> rental_items
    // داخل delete، أعكس الترتيب للاعتمادية: rental_items -> rentals -> customers/equipment -> branches
    const opOrder: Record<QueueItem["operation"], number> = {
      insert: 0,
      update: 1,
      delete: 2,
    };
    const tableInsertOrder: Record<QueueItem["table"], number> = {
      branches: 0,
      customers: 1,
      equipment: 1,
      rentals: 2,
      rental_items: 3,
      maintenance_requests: 2,
      expenses: 1,
    };

    const tableDeleteOrder: Record<QueueItem["table"], number> = {
      rental_items: 0,
      rentals: 1,
      maintenance_requests: 1,
      expenses: 1,
      customers: 2,
      equipment: 2,
      branches: 3,
    };

    const sortedQueue = [...queue].sort((a, b) => {
      const opDiff = opOrder[a.operation] - opOrder[b.operation];
      if (opDiff !== 0) return opDiff;
      if (a.operation === "insert" && b.operation === "insert") {
        const ta = tableInsertOrder[a.table] ?? 99;
        const tb = tableInsertOrder[b.table] ?? 99;
        if (ta !== tb) return ta - tb;
      }
      if (a.operation === "delete" && b.operation === "delete") {
        const ta = tableDeleteOrder[a.table] ?? 99;
        const tb = tableDeleteOrder[b.table] ?? 99;
        if (ta !== tb) return ta - tb;
      }
      // fallback: الأقدم أولاً
      return a.timestamp - b.timestamp;
    });

    for (const item of sortedQueue) {
      try {
        await processQueueItem(item);
        await removeFromQueue(item.id);
        synced++;
      } catch (error: any) {
        console.error("Sync error:", error);

        if (item.retries >= MAX_RETRIES) {
          console.error(`Failed to sync after ${MAX_RETRIES} retries:`, item);
          await removeFromQueue(item.id);
          failed++;
        } else {
          item.retries++;
          await updateQueueItem(item);
          failed++;
        }
      }
    }

    // Show toast messages
    if (synced > 0) {
      console.log(`Successfully synced ${synced} items`);
      toast.success(`تم مزامنة ${synced} عملية بنجاح`);
    }

    if (failed > 0) {
      toast.error(`فشل مزامنة ${failed} عملية`);
    }

    return { success: failed === 0, synced, failed };
  } finally {
    isSyncing = false;
  }
}

async function processQueueItem(item: QueueItem): Promise<void> {
  const { table, operation, data } = item;

  try {
    // Remove local-only fields and relationships before sending to Supabase
    const cleanData = { ...data };
    delete cleanData.synced;
    delete cleanData.branches;
    delete cleanData.customers;
    delete cleanData.equipment;
    delete cleanData.rental_items;
    delete cleanData.user_roles;

    switch (operation) {
      case "insert": {
        const { error } = await (supabase as any).from(table).insert(cleanData);
        if (error) throw error;
        // تحديث البيانات المحلية بـ synced: true
        await saveToLocal(table as any, { ...data, synced: true });
        break;
      }

      case "update": {
        const { error } = await (supabase as any)
          .from(table)
          .update(cleanData)
          .eq("id", data.id);
        if (error) throw error;
        await saveToLocal(table as any, { ...data, synced: true });
        break;
      }

      case "delete": {
        const { error } = await (supabase as any)
          .from(table)
          .delete()
          .eq("id", data.id);
        if (error) throw error;
        // Verify deletion: if row still exists (or still visible), treat as failure to retry later
        const verify = await (supabase as any)
          .from(table)
          .select("id")
          .eq("id", data.id)
          .maybeSingle();
        if (verify.data) {
          throw new Error(
            `Delete on ${table} id=${data.id} did not remove row (still exists)`
          );
        }
        break;
      }
    }
  } catch (error) {
    console.error(`Error processing ${operation} on ${table}:`, error);
    throw error;
  }
}

export async function pullDataFromBackend(): Promise<void> {
  try {
    console.log("🔄 Pulling all data from backend...");
    const startTime = Date.now();

    // Use Promise.all to fetch all data in parallel instead of sequentially
    const [
      customersRes,
      equipmentRes,
      rentalsRes,
      rentalItemsRes,
      branchesRes,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("equipment")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("rentals")
        .select(
          `
        *,
        customers(full_name, phone),
        branches(name, address, phone)
      `
        )
        .order("created_at", { ascending: false }),
      supabase.from("rental_items").select(`
        *,
        equipment(name, code, daily_rate)
      `),
      supabase
        .from("branches")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    // Process customers
    if (customersRes.data) {
      await clearStore("customers");
      const customersToSave = customersRes.data.map((customer) => ({
        ...customer,
        synced: true,
      }));
      await bulkSaveToLocal("customers", customersToSave);
      console.log(`✅ Synced ${customersRes.data.length} customers`);
    }

    // Process equipment
    if (equipmentRes.data) {
      await clearStore("equipment");
      const eqToSave = equipmentRes.data.map((item) => ({
        ...item,
        synced: true,
      }));
      await bulkSaveToLocal("equipment", eqToSave);
      console.log(`✅ Synced ${equipmentRes.data.length} equipment items`);
    }

    // Process rentals
    if (rentalsRes.data) {
      await clearStore("rentals");
      const rentalsToSave = rentalsRes.data.map((rental) => ({
        ...rental,
        synced: true,
      }));
      await bulkSaveToLocal("rentals", rentalsToSave);
      console.log(`✅ Synced ${rentalsRes.data.length} rentals`);
    }

    // Process rental_items
    if (rentalItemsRes.data) {
      await clearStore("rental_items");
      const itemsToSave = rentalItemsRes.data.map((item) => ({
        ...item,
        synced: true,
      }));
      await bulkSaveToLocal("rental_items", itemsToSave);
      console.log(`✅ Synced ${rentalItemsRes.data.length} rental items`);
    }

    // Process branches
    if (branchesRes.data) {
      await clearStore("branches");
      const branchesToSave = branchesRes.data.map((branch) => ({
        ...branch,
        synced: true,
      }));
      await bulkSaveToLocal("branches", branchesToSave);
      console.log(`✅ Synced ${branchesRes.data.length} branches`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ All data synced successfully in ${duration}s!`);
    localStorage.setItem("last_sync_time", new Date().toISOString());
  } catch (error: any) {
    // Some Electron builds may throw generic IndexedDB UnknownError on heavy writes.
    // Log and degrade gracefully instead of crashing the app.
    console.error("❌ Error pulling data from backend:", error);
    // Don't rethrow UnknownError to keep app usable offline
    if (String(error?.name || "").includes("UnknownError")) {
      console.warn(
        "Proceeding without full local cache due to IndexedDB UnknownError."
      );
      return;
    }
    throw error;
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
