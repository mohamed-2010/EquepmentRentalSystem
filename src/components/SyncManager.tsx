// Offline-only placeholder: original SyncManager disabled
// Keeping a minimal component to avoid import errors if referenced.
import { WifiOff } from "lucide-react";

export function SyncManager() {
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-3 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600">وضع أوفلاين فقط</span>
      </div>
    </div>
  );
}
