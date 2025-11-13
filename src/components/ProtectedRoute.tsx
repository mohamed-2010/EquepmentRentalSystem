import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getOfflineUser } from "@/lib/offline/offlineAuth";

interface UserRole {
  role?: string;
  branch_id?: string;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const hasComputedRef = useRef(false);

  useEffect(() => {
    // إذا لا يوجد مستخدم، امسح كل شيء
    if (!user) {
      setUserRole(null);
      setRoleLoaded(true);
      hasComputedRef.current = false;
      return;
    }

    // إذا تم الحساب بالفعل، لا تعيد
    if (hasComputedRef.current) {
      return;
    }

    hasComputedRef.current = true;
    let result: UserRole | null = null;

    // 1) sessionStorage أولاً
    try {
      const offlineSession = sessionStorage.getItem("offline_session");
      if (offlineSession) {
        const sessionUser = JSON.parse(offlineSession);
        const branchId = sessionUser?.user_metadata?.branch_id;
        const role = sessionUser?.user_metadata?.role;
        if (branchId) {
          result = { role, branch_id: branchId };
        }
      }
    } catch (error) {
      console.error("Error parsing offline_session:", error);
    }

    // 2) localStorage offlineUser
    if (!result) {
      const offlineUser = getOfflineUser();
      if (offlineUser?.branch_id) {
        result = { role: offlineUser.role, branch_id: offlineUser.branch_id };
      }
    }

    // 3) user_role cache
    if (!result) {
      try {
        const cached = localStorage.getItem("user_role");
        if (cached) {
          const parsed = JSON.parse(cached);
          const offlineUser = getOfflineUser();
          if (!parsed?.branch_id && offlineUser?.branch_id) {
            result = { ...parsed, branch_id: offlineUser.branch_id };
          } else {
            result = parsed;
          }
        }
      } catch (error) {
        console.error("Error parsing user_role cache:", error);
      }
    }

    // 4) آخر محاولة من offlineUser
    if (!result) {
      const offlineUser = getOfflineUser();
      if (offlineUser?.role || offlineUser?.branch_id) {
        result = { role: offlineUser.role, branch_id: offlineUser.branch_id };
      }
    }

    // 5) إذا لم نجد أي شيء، جرب user_branch_id مباشرة
    if (!result?.branch_id) {
      const branchId = localStorage.getItem("user_branch_id");
      if (branchId) {
        result = { ...result, branch_id: branchId };
      }
    }

    console.log("[ProtectedRoute] Final userRole:", result);
    setUserRole(result);
    setRoleLoaded(true);
  }, [user]);

  // عرض شاشة التحميل فقط أثناء تحميل المستخدم الأولي
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // غير مسجل الدخول
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // انتظر تحميل الدور فقط في المرة الأولى
  if (!roleLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  // المستخدم لديه فرع وهو في صفحة الإعداد - وجهه للوحة التحكم
  if (userRole?.branch_id && location.pathname === "/setup") {
    return <Navigate to="/dashboard" replace />;
  }

  // المستخدم ليس لديه فرع وليس في صفحة الإعداد - وجهه للإعداد
  // ولكن فقط إذا كان userRole محدداً وليس null
  if (userRole && !userRole?.branch_id && location.pathname !== "/setup") {
    return <Navigate to="/setup" state={{ from: location }} replace />;
  }

  // كل شيء جيد - اعرض المحتوى
  return <>{children}</>;
}
