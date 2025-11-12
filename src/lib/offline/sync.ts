// Offline-only mode: all sync functions become no-ops retained for compatibility.
export async function syncWithBackend(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
}> {
  return { success: true, synced: 0, failed: 0 };
}

export async function pullDataFromBackend(): Promise<void> {
  // No-op: backend disabled.
  return;
}

export async function getPendingSyncCount(): Promise<number> {
  return 0;
}
