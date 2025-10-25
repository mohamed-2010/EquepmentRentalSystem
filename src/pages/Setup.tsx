import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // التحقق إذا كان المستخدم لديه branch_id
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("branch_id")
        .eq("user_id", user.id)
        .limit(1);

      if (userRoles && userRoles.length > 0 && userRoles[0]?.branch_id) {
        // المستخدم مُعد بالفعل، توجيه للـ dashboard
        navigate("/dashboard");
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("المستخدم غير مسجل الدخول");

      // 1. إنشاء الفرع
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .insert({
          name: branchName,
          address: branchAddress,
          phone: branchPhone,
        })
        .select()
        .single();

      if (branchError) throw branchError;

      // 2. إضافة المستخدم إلى user_roles كـ admin
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: user.id,
        role: "admin",
        branch_id: branch.id,
      });

      if (roleError) throw roleError;

      toast.success("تم إعداد النظام بنجاح!");
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
