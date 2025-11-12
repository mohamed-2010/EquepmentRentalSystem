// Offline-only stub: original sync hook disabled
export function useOfflineSync() {
  return {
    isOnline: false,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null as Date | null,
    performSync: () => Promise.resolve(),
    pullData: () => Promise.resolve(),
    updatePendingCount: () => Promise.resolve(),
  };
}
