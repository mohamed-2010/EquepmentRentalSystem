import { openDB, IDBPDatabase } from "idb";

export interface CustomerData {
  id: string;
  full_name: string;
  phone: string;
  id_number?: string;
  notes?: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface EquipmentData {
  id: string;
  name: string;
  code: string;
  category?: string;
  daily_rate: number;
  status: string;
  notes?: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface RentalData {
  id: string;
  customer_id: string;
  equipment_id: string;
  branch_id: string;
  start_date: string;
  end_date?: string;
  status: string;
  rental_type?: string;
  days_count?: number;
  total_amount?: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface RentalItemData {
  id: string;
  rental_id: string;
  equipment_id: string;
  start_date: string;
  return_date?: string;
  days_count?: number;
  amount?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface BranchData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  company_name?: string;
  tax_number?: string;
  commercial_registration?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface QueueData {
  id: string;
  table: "customers" | "equipment" | "rentals" | "rental_items" | "branches";
  operation: "insert" | "update" | "delete";
  data: any;
  timestamp: number;
  retries: number;
}

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB("branch-gear-offline", 3, {
    upgrade(db, oldVersion) {
      // Customers store
      if (!db.objectStoreNames.contains("customers")) {
        const customerStore = db.createObjectStore("customers", {
          keyPath: "id",
        });
        customerStore.createIndex("by-branch", "branch_id");
        customerStore.createIndex("by-synced", "synced");
      }

      // Equipment store
      if (!db.objectStoreNames.contains("equipment")) {
        const equipmentStore = db.createObjectStore("equipment", {
          keyPath: "id",
        });
        equipmentStore.createIndex("by-branch", "branch_id");
        equipmentStore.createIndex("by-synced", "synced");
      }

      // Rentals store
      if (!db.objectStoreNames.contains("rentals")) {
        const rentalStore = db.createObjectStore("rentals", { keyPath: "id" });
        rentalStore.createIndex("by-branch", "branch_id");
        rentalStore.createIndex("by-synced", "synced");
      }

      // Rental items store
      if (!db.objectStoreNames.contains("rental_items")) {
        const rentalItemStore = db.createObjectStore("rental_items", {
          keyPath: "id",
        });
        rentalItemStore.createIndex("by-rental", "rental_id");
        rentalItemStore.createIndex("by-synced", "synced");
      }

      // Branches store
      if (!db.objectStoreNames.contains("branches")) {
        const branchStore = db.createObjectStore("branches", { keyPath: "id" });
        branchStore.createIndex("by-synced", "synced");
      }

      // Sync queue store
      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
}

export async function saveToLocal(
  storeName:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "sync_queue",
  data: any
): Promise<void> {
  const db = await getDB();
  await db.put(storeName, data);
}

export async function getFromLocal(
  storeName:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "sync_queue",
  id: string
): Promise<any> {
  const db = await getDB();
  return await db.get(storeName, id);
}

export async function getAllFromLocal(
  storeName:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "sync_queue"
): Promise<any[]> {
  const db = await getDB();
  return await db.getAll(storeName);
}

export async function deleteFromLocal(
  storeName:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "sync_queue",
  id: string
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function clearStore(
  storeName:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "sync_queue"
): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

// Initialize the IndexedDB database early to ensure stores are created
export async function initLocalDB(): Promise<void> {
  try {
    await getDB();
    // Optional marker to help diagnose first-run
    try {
      localStorage.setItem("db_initialized_at", new Date().toISOString());
    } catch {}
    console.log("IndexedDB initialized (branch-gear-offline)");
  } catch (e) {
    console.warn("Failed to initialize IndexedDB:", e);
  }
}

export async function bulkSaveToLocal(
  storeName:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "sync_queue",
  items: any[]
): Promise<void> {
  if (!items || items.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  try {
    for (const item of items) {
      await tx.store.put(item);
    }
    await tx.done;
  } catch (e) {
    try {
      await tx.done.catch(() => {});
    } catch {}
    throw e;
  }
}
