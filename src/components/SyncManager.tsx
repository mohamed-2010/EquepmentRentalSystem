import { useEffect, useState, useRef } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { syncWithBackend } from "@/lib/offline/sync";
import { getQueue } from "@/lib/offline/queue";
import { toast } from "sonner";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

export function SyncManager() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const previousOnlineStatus = useRef(isOnline);

  // تحديث عدد العمليات في الانتظار
  useEffect(() => {
    const updateQueueCount = async () => {
      const queue = await getQueue();
      setQueueCount(queue.length);
    };

    updateQueueCount();

    // تحديث كل 10 ثواني
    const interval = setInterval(updateQueueCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // مزامنة تلقائية فقط عند الانتقال من offline إلى online
  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, auto-syncing...");
      const syncTimeout = setTimeout(async () => {
        await handleSync();
      }, 2000);

      previousOnlineStatus.current = isOnline;
      return () => clearTimeout(syncTimeout);
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  // مزامنة دورية كل 5 دقائق إذا كان متصل
  useEffect(() => {
    if (!isOnline) return;

    const syncInterval = setInterval(async () => {
      const queue = await getQueue();
      if (queue.length > 0) {
        console.log("Periodic sync triggered");
        await handleSync();
      }
    }, 5 * 60 * 1000); // كل 5 دقائق

    return () => clearInterval(syncInterval);
  }, [isOnline]);

  const handleSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncWithBackend();

      if (result.synced > 0) {
        setLastSyncTime(new Date());
        const queue = await getQueue();
        setQueueCount(queue.length);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("فشلت عملية المزامنة");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-3 space-y-2">
        {/* حالة الاتصال */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">متصل</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">غير متصل</span>
            </>
          )}
        </div>

        {/* عدد العمليات في الانتظار */}
        {queueCount > 0 && (
          <div className="text-sm text-muted-foreground">
            {queueCount} عملية في الانتظار
          </div>
        )}

        {/* آخر مزامنة */}
        {lastSyncTime && (
          <div className="text-xs text-muted-foreground">
            آخر مزامنة: {lastSyncTime.toLocaleTimeString("ar-SA")}
          </div>
        )}

        {/* زر المزامنة اليدوية */}
        {isOnline && queueCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                جاري المزامنة...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-2" />
                مزامنة الآن
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
