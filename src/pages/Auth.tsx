import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
// Offline-only: Supabase disabled
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Package, Loader2, WifiOff } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  saveOfflineAuth,
  saveOfflineUser,
  getOfflineUser,
} from "@/lib/offline/offlineAuth";

// الحساب الثابت المبرمج في الكود
const DEFAULT_ACCOUNT = {
  email: "admin@rentalsystem.com",
  password: "admin123",
  fullName: "المدير العام",
  role: "admin",
};

const authSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح").max(255),
  password: z
    .string()
    .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    .max(100),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  // احصل على الصفحة المطلوبة من state أو استخدم /dashboard كافتراضي
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // تهيئة الحساب الافتراضي عند تحميل الصفحة
  useEffect(() => {
    const offlineUser = getOfflineUser();
    if (!offlineUser) {
      // إنشاء الحساب الافتراضي تلقائياً
      const defaultUser = {
        id: crypto.randomUUID(),
        email: DEFAULT_ACCOUNT.email,
        full_name: DEFAULT_ACCOUNT.fullName,
        role: DEFAULT_ACCOUNT.role,
        branch_id: undefined, // سيتم تحديده في صفحة Setup
      } as any;
      saveOfflineUser(defaultUser);
      saveOfflineAuth(DEFAULT_ACCOUNT.email, DEFAULT_ACCOUNT.password);
    }
  }, []);

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = { email, password };

      const validation = authSchema.safeParse(data);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      // التحقق من الحساب الثابت
      if (
        email.toLowerCase() !== DEFAULT_ACCOUNT.email.toLowerCase() ||
        password !== DEFAULT_ACCOUNT.password
      ) {
        toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        setLoading(false);
        return;
      }

      // الحصول على بيانات المستخدم المحفوظة
      const offlineUser = getOfflineUser();
      if (!offlineUser) {
        toast.error("خطأ في تحميل بيانات المستخدم");
        setLoading(false);
        return;
      }

      // حفظ جلسة أوفلاين
      const mockUser = {
        id: offlineUser.id,
        email: offlineUser.email?.toLowerCase(),
        app_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
        user_metadata: {
          full_name: offlineUser.full_name,
          role: offlineUser.role,
          branch_id: offlineUser.branch_id,
        },
      };
      sessionStorage.setItem("offline_session", JSON.stringify(mockUser));

      toast.success("تم تسجيل الدخول بنجاح");
      
      // إذا لم يكن هناك فرع، وجّه إلى الإعداد
      if (!offlineUser.branch_id) {
        navigate("/setup", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (error) {
      toast.error("حدث خطأ ما، يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      {!isOnline && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>وضع Offline</span>
          </div>
        </div>
      )}
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="bg-primary p-4 rounded-full shadow-glow">
              <Package className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">
              نظام إدارة الإيجار
            </CardTitle>
            <CardDescription className="text-base mt-2">
              مرحباً بك! سجل دخولك للمتابعة
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@rentalsystem.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="font-semibold mb-1">بيانات الدخول الافتراضية:</p>
              <p>البريد: {DEFAULT_ACCOUNT.email}</p>
              <p>الباسورد: {DEFAULT_ACCOUNT.password}</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
