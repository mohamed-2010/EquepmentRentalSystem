import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  verifyOfflineAuth,
  getOfflineUser,
} from "@/lib/offline/offlineAuth";

const authSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح").max(255),
  password: z
    .string()
    .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    .max(100),
  fullName: z
    .string()
    .min(3, "الاسم يجب أن يكون 3 أحرف على الأقل")
    .max(100)
    .optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  // احصل على الصفحة المطلوبة من state أو استخدم /dashboard كافتراضي
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = isLogin
        ? { email, password }
        : { email, password, fullName };

      const validation = authSchema.safeParse(data);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      if (isLogin) {
        // محاولة تسجيل الدخول
        if (isOnline) {
          // تسجيل دخول عادي عبر الإنترنت
          const { error, data: authData } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });

          if (error) {
            // إذا فشل، جرب offline
            if (verifyOfflineAuth(email, password)) {
              toast.success("تم تسجيل الدخول (وضع Offline)");
              navigate(from, { replace: true });
            } else {
              if (error.message.includes("Invalid login credentials")) {
                toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
              } else {
                toast.error(error.message);
              }
            }
            return;
          }

          // حفظ بيانات التسجيل للاستخدام offline لاحقاً
          saveOfflineAuth(email, password);

          // حفظ بيانات المستخدم
          if (authData.user) {
            const { data: userRole } = await supabase
              .from("user_roles")
              .select("role, branch_id")
              .eq("user_id", authData.user.id)
              .limit(1)
              .maybeSingle();

            const userData = {
              id: authData.user.id,
              email: authData.user.email!,
              full_name: authData.user.user_metadata?.full_name,
              role: userRole?.role,
              branch_id: userRole?.branch_id,
            };

            saveOfflineUser(userData);

            // حفظ في sessionStorage أيضاً للاستخدام الفوري
            const sessionUser = {
              id: authData.user.id,
              email: authData.user.email!,
              app_metadata: {},
              aud: "authenticated",
              created_at: authData.user.created_at,
              user_metadata: {
                full_name: authData.user.user_metadata?.full_name,
                role: userRole?.role,
                branch_id: userRole?.branch_id,
              },
            };
            sessionStorage.setItem(
              "offline_session",
              JSON.stringify(sessionUser)
            );
          }

          toast.success("تم تسجيل الدخول بنجاح");
          navigate(from, { replace: true });
        } else {
          // وضع offline - التحقق من البيانات المحفوظة
          const ok = verifyOfflineAuth(email, password);
          const offlineUser = getOfflineUser();
          if (ok && offlineUser) {
            const mockUser = {
              id: offlineUser.id,
              email: (offlineUser.email || email)?.toLowerCase(),
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
            toast.success("تم تسجيل الدخول (وضع Offline)");
            window.location.href = from;
          } else if (
            offlineUser &&
            offlineUser.email &&
            offlineUser.email.toLowerCase() === email.toLowerCase()
          ) {
            // فولباك اختياري: سماح بالدخول بالحساب المحفوظ حتى لو كلمة المرور غير متاحة
            const mockUser = {
              id: offlineUser.id,
              email: offlineUser.email.toLowerCase(),
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
            toast.info(
              "تم تسجيل الدخول باستخدام الحساب المحفوظ (بدون تحقق كلمة المرور)"
            );
            window.location.href = from;
          } else {
            toast.error(
              "لا يمكن تسجيل الدخول بدون إنترنت. يجب تسجيل الدخول مرة واحدة عبر الإنترنت أولاً."
            );
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${from}`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("هذا البريد الإلكتروني مسجل مسبقاً");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن");
        setIsLogin(true);
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
            <span>
              وضع Offline - يمكنك تسجيل الدخول باستخدام حساب مسجل مسبقاً
            </span>
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
              {isLogin ? "مرحباً بك! سجل دخولك للمتابعة" : "إنشاء حساب جديد"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="أدخل اسمك الكامل"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@domain.com"
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
              ) : isLogin ? (
                "تسجيل الدخول"
              ) : (
                "إنشاء حساب"
              )}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary"
              >
                {isLogin ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب؟ سجل دخولك"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
