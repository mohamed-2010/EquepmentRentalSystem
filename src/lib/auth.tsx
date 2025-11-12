import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getOfflineUser, clearOfflineAuth } from "@/lib/offline/offlineAuth";
import { OFFLINE_ONLY } from "@/config/offline";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Offline-only auth bootstrap
    const initOfflineAuth = () => {
      // Try sessionStorage first for quick warm start
      const offlineSession = sessionStorage.getItem("offline_session");
      if (offlineSession) {
        try {
          const mockUser = JSON.parse(offlineSession);
          setUser(mockUser as unknown as User);
          setSession(null);
          setLoading(false);
          return;
        } catch {}
      }

      const offlineUser = getOfflineUser();
      if (offlineUser) {
        const mockUser = {
          id: offlineUser.id,
          email: offlineUser.email || "",
          app_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
          user_metadata: {
            full_name: offlineUser.full_name,
          },
        } as unknown as User;
        setUser(mockUser);
        setSession(null);
        sessionStorage.setItem("offline_session", JSON.stringify(mockUser));
      }
      setLoading(false);
    };

    if (OFFLINE_ONLY) {
      initOfflineAuth();
      return;
    } else {
      // Fallback: treat as offline anyway
      initOfflineAuth();
      return;
    }
  }, []);

  const signOut = async () => {
    // Clear supabase-related tokens (if any remain) and offline session
    try {
      const stores: Storage[] = [localStorage, sessionStorage];
      for (const store of stores) {
        for (let i = store.length - 1; i >= 0; i--) {
          const key = store.key(i);
          if (!key) continue;
          if (
            (key.startsWith("sb-") && key.endsWith("-auth-token")) ||
            key === "supabase.auth.token" ||
            key === "supabase.auth.user"
          ) {
            store.removeItem(key);
          }
        }
      }
    } catch {}
    sessionStorage.removeItem("offline_session");
    clearOfflineAuth();
    window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
