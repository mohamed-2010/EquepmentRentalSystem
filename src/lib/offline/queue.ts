import { getDB } from "./db";
import { v4 as uuidv4 } from "uuid";

export interface QueueItem {
  id: string;
  table: "customers" | "equipment" | "rentals" | "rental_items" | "branches";
  operation: "insert" | "update" | "delete";
  data: any;
  timestamp: number;
  retries: number;
}

export async function addToQueue(
  table: QueueItem["table"],
  operation: QueueItem["operation"],
  data: any
): Promise<void> {
  const db = await getDB();
  const queueItem: QueueItem = {
    id: uuidv4(),
    table,
    operation,
    data,
    timestamp: Date.now(),
    retries: 0,
  };
  await db.add("sync_queue", queueItem);
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await getDB();
  return await db.getAll("sync_queue");
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("sync_queue", id);
}

export async function updateQueueItem(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put("sync_queue", item);
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear("sync_queue");
}
