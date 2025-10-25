import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, Users, FileText, TrendingUp } from "lucide-react";
import { getAllFromLocal } from "@/lib/offline/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface Stats {
  totalEquipment: number;
  totalCustomers: number;
  activeRentals: number;
  completedRentals: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalEquipment: 0,
    totalCustomers: 0,
    activeRentals: 0,
    completedRentals: 0,
  });
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (isOnline) {
          // جلب البيانات من السيرفر
          const [
            equipmentRes,
            customersRes,
            activeRentalsRes,
            completedRentalsRes,
          ] = await Promise.all([
            supabase
              .from("equipment")
              .select("id", { count: "exact", head: true }),
            supabase
              .from("customers")
              .select("id", { count: "exact", head: true }),
            supabase
              .from("rentals")
              .select("id", { count: "exact", head: true })
              .eq("status", "active"),
            supabase
              .from("rentals")
              .select("id", { count: "exact", head: true })
              .eq("status", "completed"),
          ]);
          console.log("Fetched stats from server:", {
            equipmentCount: equipmentRes.count,
            customersCount: customersRes.count,
            activeRentalsCount: activeRentalsRes.count,
            completedRentalsCount: completedRentalsRes.count,
          });

          setStats({
            totalEquipment: equipmentRes.count || 0,
            totalCustomers: customersRes.count || 0,
            activeRentals: activeRentalsRes.count || 0,
            completedRentals: completedRentalsRes.count || 0,
          });
        } else {
          // جلب البيانات من IndexedDB
          const [equipment, customers, rentals] = await Promise.all([
            getAllFromLocal("equipment"),
            getAllFromLocal("customers"),
            getAllFromLocal("rentals"),
          ]);

          setStats({
            totalEquipment: equipment.length,
            totalCustomers: customers.length,
            activeRentals: rentals.filter((r) => r.status === "active").length,
            completedRentals: rentals.filter((r) => r.status === "completed")
              .length,
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isOnline]);

  const statCards = [
    {
      title: "إجمالي المعدات",
      value: stats.totalEquipment,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "العملاء",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "الإيجارات النشطة",
      value: stats.activeRentals,
      icon: FileText,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "الإيجارات المنتهية",
      value: stats.completedRentals,
      icon: TrendingUp,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            لوحة التحكم
          </h2>
          <p className="text-muted-foreground">
            مرحباً بك في نظام إدارة الإيجار
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="transition-smooth hover:shadow-lg"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? "..." : stat.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>نظرة عامة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                مرحباً بك في نظام إدارة الإيجار. استخدم القائمة الجانبية للتنقل
                بين الأقسام المختلفة.
              </p>
              <div className="space-y-2">
                <h4 className="font-semibold">الميزات الأساسية:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>إدارة المعدات والمخزون</li>
                  <li>متابعة العملاء والإيجارات</li>
                  <li>إصدار الفواتير</li>
                  <li>تقارير وتحليلات مفصلة</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>البدء السريع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="opacity-90">ابدأ باستخدام النظام بخطوات بسيطة:</p>
              <ol className="list-decimal list-inside space-y-2 opacity-90">
                <li>أضف معدات جديدة من قسم المعدات</li>
                <li>سجل بيانات العملاء</li>
                <li>ابدأ بتسجيل عمليات الإيجار</li>
                <li>تابع الإيجارات وأصدر الفواتير</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
