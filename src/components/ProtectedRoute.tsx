import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineUser } from "@/lib/offline/offlineAuth";
// removed unused import

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isOnline = useOnlineStatus();

  // التحقق من وجود branch_id للمستخدم
  const { data: userRole, isLoading: isLoadingRole } = useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      if (!user) return null;

      console.log("🔍 ProtectedRoute Query: Checking user role");
      console.log("IsOnline:", isOnline);

      // أولاً: دائماً فحص sessionStorage (أولوية قصوى) حتى لو Online
      const offlineSession = sessionStorage.getItem("offline_session");
      console.log("📦 SessionStorage:", offlineSession ? "Found" : "Not found");
      if (offlineSession) {
        const sessionUser = JSON.parse(offlineSession);
        console.log("SessionUser:", sessionUser);
        if (sessionUser.user_metadata?.branch_id) {
          console.log(
            "✅ Branch ID found in sessionStorage:",
            sessionUser.user_metadata.branch_id
          );
          return {
            role: sessionUser.user_metadata.role,
            branch_id: sessionUser.user_metadata.branch_id,
          };
        }
      }

      // ثانياً: فحص localStorage (البيانات الدائمة) حتى لو Online
      const offlineUser = getOfflineUser();
      console.log("💾 LocalStorage offline user:", offlineUser);
      if (offlineUser && offlineUser.branch_id) {
        console.log(
          "✅ Branch ID found in localStorage:",
          offlineUser.branch_id
        );
        return {
          role: offlineUser.role,
          branch_id: offlineUser.branch_id,
        };
      }

      // ثالثاً: إذا كان online ولم نجد في الكاش، اجلب من السيرفر
      if (isOnline) {
        console.log("🌐 Fetching from Supabase with timeout...");
        // تنفيذ الطلب مع مهلة زمنية قصيرة لتجنب التعليق اللانهائي
        const timeoutMs = 2000;
        const fetchPromise = supabase
          .from("user_roles")
          .select("role, branch_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        const timeoutPromise = new Promise<{ data: any | null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), timeoutMs)
        );

        const { data } = await Promise.race([fetchPromise, timeoutPromise]);
        console.log("Supabase result (race):", data);

        // إذا حصلنا على بيانات من السيرفر، خزّنها وارجعها
        if (data) {
          try {
            localStorage.setItem("user_role", JSON.stringify(data));
          } catch {}
          return data;
        }

        // في حالة المهلة أو null، حاول استخدام الكاش
        const cached = localStorage.getItem("user_role");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            console.log("Using cached user_role after timeout", parsed);
            // لو الكاش ناقص branch_id، كمله من offlineUser إن وجد
            if (!parsed?.branch_id && offlineUser?.branch_id) {
              return { ...parsed, branch_id: offlineUser.branch_id };
            }
            return parsed;
          } catch (_) {}
        }

        // آخر محاولة: تركيب بيانات من offlineUser حتى لا نعطل المسار
        if (offlineUser?.role || offlineUser?.branch_id) {
          return {
            role: offlineUser.role,
            branch_id: offlineUser.branch_id,
          };
        }

        return null;
      }

      console.log("❌ No branch_id found anywhere");
      return null;
    },
    enabled: !!user,
    staleTime: Infinity, // استخدم البيانات المحفوظة بدون إعادة جلب
    retry: false,
  });

  if (loading || (user && isLoadingRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // حفظ الصفحة المطلوبة للعودة إليها بعد تسجيل الدخول
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // كان هنا توجيه تلقائي إلى /setup عند عدم وجود branch_id
  // بناءً على طلبك، لن نعيد التوجيه بعد الآن وسنسمح بالمتابعة بدون إعداد الفرع.
  if (user && !userRole?.branch_id) {
    console.warn(
      "ProtectedRoute: no branch_id; continuing without setup redirect"
    );
  }

  return <>{children}</>;
}
