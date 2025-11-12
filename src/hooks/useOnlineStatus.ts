import { useState, useEffect } from "react";
import { OFFLINE_ONLY } from "@/config/offline";

export function useOnlineStatus() {
  // Always call hooks in consistent order; enforce offline via return value
  const [isOnline, setIsOnline] = useState(() =>
    OFFLINE_ONLY ? false : navigator.onLine
  );

  useEffect(() => {
    if (OFFLINE_ONLY) return; // don't attach listeners in offline-only
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return OFFLINE_ONLY ? false : isOnline;
}
