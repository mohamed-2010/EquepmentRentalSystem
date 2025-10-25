import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, performSync, pullData } = useOfflineSync();

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">متصل</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">غير متصل</span>
          </>
        )}

        {pendingCount > 0 && (
          <Badge variant="secondary" className="mr-2">
            {pendingCount} في الانتظار
          </Badge>
        )}

        {isOnline && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={performSync}
              disabled={isSyncing || pendingCount === 0}
              className="h-8 px-2"
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={pullData}
              className="h-8 px-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        )}

        {!isOnline && (
          <CloudOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {lastSyncTime && (
        <div className="text-xs text-muted-foreground bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-1">
          آخر مزامنة: {formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: ar })}
        </div>
      )}
    </div>
  );
}
