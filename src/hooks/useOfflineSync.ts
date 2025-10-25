import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  syncWithBackend,
  pullDataFromBackend,
  getPendingSyncCount,
} from "@/lib/offline/sync";
import { toast } from "sonner";
import { getAllFromLocal } from "@/lib/offline/db";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const previousOnlineStatus = useRef(isOnline);

  const updatePendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }, []);

  const performSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncWithBackend();

      if (result.synced > 0) {
        toast.success(`تم مزامنة ${result.synced} عملية بنجاح`);
        setLastSyncTime(new Date());
      }

      if (result.failed > 0) {
        toast.error(`فشل مزامنة ${result.failed} عملية`);
      }

      await updatePendingCount();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("حدث خطأ أثناء المزامنة");
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCount]);

  const pullData = useCallback(async () => {
    if (!isOnline) return;

    try {
      await pullDataFromBackend();
      toast.success("تم تحديث البيانات من الخادم");
      setLastSyncTime(new Date());
    } catch (error) {
      console.error("Pull error:", error);
      toast.error("حدث خطأ أثناء تحديث البيانات");
    }
  }, [isOnline]);

  // Auto sync only when transitioning from offline to online
  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline && pendingCount > 0) {
      console.log("🔄 Going online with pending items, syncing...");
      performSync();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline, pendingCount]);

  // Update pending count on mount only
  useEffect(() => {
    updatePendingCount();
  }, []);

  // Auto pull once on first run in Electron/file or when no prior sync and stores are empty
  useEffect(() => {
    (async () => {
      if (!isOnline) return;
      const isFile =
        typeof window !== "undefined" && window.location.protocol === "file:";
      const isElectron =
        typeof navigator !== "undefined" &&
        navigator.userAgent.includes("Electron");
      const last = localStorage.getItem("last_sync_time");
      // Check if local stores are essentially empty
      let emptyStores = 0;
      try {
        const [b, c, e] = await Promise.all([
          getAllFromLocal("branches"),
          getAllFromLocal("customers"),
          getAllFromLocal("equipment"),
        ]);
        emptyStores = (b?.length || 0) + (c?.length || 0) + (e?.length || 0);
      } catch {}
      if ((isFile || isElectron) && (!last || emptyStores === 0)) {
        try {
          console.log("🔄 First-run pull for Electron/file protocol...");
          await pullDataFromBackend();
          toast.success("تم تحديث البيانات من الخادم");
          setLastSyncTime(new Date());
        } catch (err) {
          console.warn("Initial pull failed:", err);
        }
      }
    })();
  }, [isOnline]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    performSync,
    pullData,
    updatePendingCount,
  };
}
