import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineUser, clearOfflineAuth } from "@/lib/offline/offlineAuth";
import { preloadAllData } from "@/lib/offline/preload";

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
    const clearSupabaseAuthStorage = () => {
      try {
        const stores: Storage[] = [localStorage, sessionStorage];
        for (const store of stores) {
          // امسح مفاتيح supabase-js القياسية
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
      } catch (e) {
        console.warn("Failed clearing supabase auth storage", e);
      }
    };
    // الحصول على الجلسة الحالية عند التحميل مع مهلة زمنية لتجنب التعليق اللانهائي
    const getSessionWithTimeout = async (timeoutMs: number) => {
      return await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: Session | null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), timeoutMs)
        ),
      ]);
    };

    getSessionWithTimeout(1500).then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session?.user ?? null);
      } else {
        // محاولة الحصول على offline session من sessionStorage
        const offlineSession = sessionStorage.getItem("offline_session");
        if (offlineSession) {
          try {
            const mockUser = JSON.parse(offlineSession);
            setUser(mockUser as unknown as User);
          } catch (e) {
            console.error("Failed to parse offline session", e);
          }
        } else {
          // محاولة الحصول على المستخدم من offline storage
          const offlineUser = getOfflineUser();
          if (offlineUser) {
            // إنشاء user object مؤقت للعمل offline
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
            // حفظ في sessionStorage
            sessionStorage.setItem("offline_session", JSON.stringify(mockUser));
          }
        }
      }
      setLoading(false);
    });

    // الاستماع لتغييرات حالة المصادقة
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // إذا تم تسجيل الدخول بنجاح، قم بتحميل جميع البيانات
      if (event === "SIGNED_IN" && session) {
        console.log("[Auth] User signed in, preloading all data...");

        // حفظ بيانات المستخدم في localStorage للاستخدام offline
        if (session.user) {
          localStorage.setItem(
            "supabase.auth.user",
            JSON.stringify(session.user)
          );
          sessionStorage.setItem(
            "supabase.auth.token",
            JSON.stringify(session)
          );

          // فقط حاول جلب user_role إذا كان الإنترنت متاح
          // تحقق من وجود user_role محفوظ مسبقاً
          const existingRole = localStorage.getItem("user_role");

          // جلب user_role فقط إذا لم يكن موجود أو إذا كان الإنترنت متاح
          if (navigator.onLine) {
            try {
              // اجلب role بمهلة قصيرة، ثم خزّنه أو ركّبه من الكاش
              const timeoutMs = 2000;
              const fetchPromise = supabase
                .from("user_roles")
                .select("role, branch_id")
                .eq("user_id", session.user.id)
                .limit(1)
                .maybeSingle();
              const timeoutPromise = new Promise<{ data: any | null }>(
                (resolve) =>
                  setTimeout(() => resolve({ data: null }), timeoutMs)
              );
              const { data: userRole } = await Promise.race([
                fetchPromise,
                timeoutPromise,
              ]);

              if (userRole) {
                localStorage.setItem("user_role", JSON.stringify(userRole));
                console.log(
                  "[Auth] User role saved to localStorage:",
                  userRole
                );
              } else if (!existingRole) {
                // لو مفيش في الكاش، حاول التركيب من offlineUser
                const offline = getOfflineUser();
                if (offline) {
                  const composed = {
                    role: offline.role,
                    branch_id: offline.branch_id,
                  };
                  localStorage.setItem("user_role", JSON.stringify(composed));
                  console.log(
                    "[Auth] Composed user_role from offline user:",
                    composed
                  );
                }
              }
            } catch (error) {
              console.error("[Auth] Failed to fetch user role:", error);
            }

            // فقط قم بتحميل البيانات إذا كان الإنترنت متاح
            preloadAllData().then((success) => {
              if (success) {
                console.log("[Auth] All data preloaded successfully");
              } else {
                console.error("[Auth] Failed to preload data");
              }
            });
          } else {
            console.log(
              "[Auth] Offline mode - skipping data fetch, using cached data"
            );
            if (existingRole) {
              console.log(
                "[Auth] Using cached user_role:",
                JSON.parse(existingRole)
              );
            }
          }
        }
      }

      // إذا تم تسجيل الخروج، أعد التوجيه لصفحة تسجيل الدخول
      if (event === "SIGNED_OUT") {
        // لا نحذف بيانات offline auth حتى نسمح بتسجيل الدخول بدون إنترنت لاحقاً
        clearSupabaseAuthStorage();
        sessionStorage.removeItem("offline_session");
        window.location.href = "/auth";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // لا نحذف بيانات offline auth لتسهيل تسجيل الدخول بدون إنترنت لاحقاً
    const clearSupabaseAuthStorage = () => {
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
      } catch (e) {
        console.warn("Failed clearing supabase auth storage", e);
      }
    };

    clearSupabaseAuthStorage();
    sessionStorage.removeItem("offline_session");

    if (navigator.onLine) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Signout online failed, redirecting anyway", e);
        window.location.href = "/auth";
      }
    } else {
      // أوفلاين: نفّذ تسجيل الخروج محلياً فقط
      window.location.href = "/auth";
    }
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
