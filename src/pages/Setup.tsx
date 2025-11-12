import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveToLocal, getAllFromLocal } from "@/lib/offline/db";
import { getOfflineUser, saveOfflineUser } from "@/lib/offline/offlineAuth";
import { v4 as uuidv4 } from "uuid";

export default function Setup() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [branchName, setBranchName] = useState("الفرع الرئيسي");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    checkUserSetup();
  }, []);

  const checkUserSetup = async () => {
    try {
      // أوفلاين: التحقق من وجود مستخدم محلي
      const offline = getOfflineUser();
      if (!offline) {
        navigate("/auth");
        return;
      }

      // تحقق من وجود branch_id محفوظ للمستخدم
      const userRoleStr = localStorage.getItem("user_role");
      const userBranchId =
        offline.branch_id || localStorage.getItem("user_branch_id");
      if (userRoleStr || userBranchId) {
        navigate("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking setup:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleSetup = async () => {
    setLoading(true);
    try {
      const offline = getOfflineUser();
      if (!offline) throw new Error("المستخدم غير مسجل الدخول (أوفلاين)");

      // 1) إنشاء الفرع محليًا
      const branch = {
        id: uuidv4(),
        name: branchName,
        address: branchAddress,
        phone: branchPhone,
        company_name: "",
        tax_number: "",
        commercial_registration: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false,
      };
      await saveToLocal("branches" as any, branch);

      // تحديث كاش الفروع في localStorage
      try {
        const all = await getAllFromLocal("branches");
        localStorage.setItem("branches_cache", JSON.stringify(all));
      } catch {}

      // 2) تعيين دور المستخدم محليًا وربطه بالفرع كـ admin
      const userRole = { role: "admin", branch_id: branch.id } as any;
      localStorage.setItem("user_role", JSON.stringify(userRole));
      localStorage.setItem("user_branch_id", branch.id);

      // 3) تحديث بيانات المستخدم الأوفلاين بالفرع
      saveOfflineUser({
        ...(offline as any),
        branch_id: branch.id,
        role: offline.role || "admin",
      });

      toast.success("تم إعداد النظام بنجاح (Offline)!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Setup error:", error);
      toast.error(error.message || "حدث خطأ أثناء الإعداد");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">مرحباً بك! 🎉</CardTitle>
          <CardDescription>لنبدأ بإعداد الفرع الأول للنظام</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-name">اسم الفرع *</Label>
            <Input
              id="branch-name"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="مثال: الفرع الرئيسي"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch-address">العنوان</Label>
            <Input
              id="branch-address"
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder="مثال: الرياض، حي النخيل"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch-phone">رقم الهاتف</Label>
            <Input
              id="branch-phone"
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              placeholder="مثال: 0500000000"
            />
          </div>

          <Button
            onClick={handleSetup}
            disabled={loading || !branchName}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ابدأ الآن
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            سيتم إعدادك كمسؤول للنظام تلقائياً
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
