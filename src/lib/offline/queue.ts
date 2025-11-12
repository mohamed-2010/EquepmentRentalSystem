// Offline-only mode: queue disabled. All functions are inert.

export interface QueueItem {
  id: string;
  table:
    | "customers"
    | "equipment"
    | "rentals"
    | "rental_items"
    | "branches"
    | "maintenance_requests"
    | "expenses";
  operation: "insert" | "update" | "delete";
  data: any;
  timestamp: number;
  retries: number;
}

export async function addToQueue(
  _table: QueueItem["table"],
  _operation: QueueItem["operation"],
  _data: any
): Promise<void> {
  // no-op
}

export async function getQueue(): Promise<QueueItem[]> {
  return [];
}

export async function removeFromQueue(_id: string): Promise<void> {
  // no-op
}

export async function updateQueueItem(_item: QueueItem): Promise<void> {
  // no-op
}

export async function clearQueue(): Promise<void> {
  // no-op
}
