import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Wrench,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { getAllFromLocal } from "@/lib/offline/db";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface Stats {
  totalEquipment: number;
  totalCustomers: number;
  activeRentals: number;
  completedRentals: number;
}

interface FinancialStats {
  rentalRevenue: number;
  maintenanceRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalEquipment: 0,
    totalCustomers: 0,
    activeRentals: 0,
    completedRentals: 0,
  });
  const [financialStats, setFinancialStats] = useState<FinancialStats>({
    rentalRevenue: 0,
    maintenanceRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"month" | "year" | "custom">(
    "month"
  );
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const isOnline = useOnlineStatus();

  const handleDateRangeChange = (range: "month" | "year" | "custom") => {
    setDateRange(range);
    const now = new Date();
    if (range === "month") {
      setStartDate(startOfMonth(now));
      setEndDate(endOfMonth(now));
    } else if (range === "year") {
      setStartDate(startOfYear(now));
      setEndDate(endOfYear(now));
    }
  };

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

          setStats({
            totalEquipment: equipmentRes.count || 0,
            totalCustomers: customersRes.count || 0,
            activeRentals: activeRentalsRes.count || 0,
            completedRentals: completedRentalsRes.count || 0,
          });

          // حساب الإيرادات والأرباح
          const startDateStr = format(startDate, "yyyy-MM-dd");
          const endDateStr = format(endDate, "yyyy-MM-dd");

          // إيرادات الإيجارات
          const { data: rentals } = await supabase
            .from("rentals")
            .select("total_amount, start_date")
            .gte("start_date", startDateStr)
            .lte("start_date", endDateStr);

          const rentalRevenue =
            rentals?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;

          // إيرادات الصيانة
          const { data: maintenance } = await (supabase as any)
            .from("maintenance_requests")
            .select("cost, request_date")
            .eq("status", "completed")
            .gte("request_date", startDateStr)
            .lte("request_date", endDateStr);

          const maintenanceRevenue =
            maintenance?.reduce(
              (sum: number, m: any) => sum + (m.cost || 0),
              0
            ) || 0;

          // المصروفات
          const { data: expenses } = await (supabase as any)
            .from("expenses")
            .select("amount, expense_date")
            .gte("expense_date", startDateStr)
            .lte("expense_date", endDateStr);

          const totalExpenses =
            expenses?.reduce(
              (sum: number, e: any) => sum + (e.amount || 0),
              0
            ) || 0;

          const netProfit = rentalRevenue + maintenanceRevenue - totalExpenses;

          setFinancialStats({
            rentalRevenue,
            maintenanceRevenue,
            totalExpenses,
            netProfit,
          });
        } else {
          // جلب البيانات من IndexedDB
          const [equipment, customers, rentals, maintenance, expenses] =
            await Promise.all([
              getAllFromLocal("equipment"),
              getAllFromLocal("customers"),
              getAllFromLocal("rentals"),
              getAllFromLocal("maintenance_requests" as any),
              getAllFromLocal("expenses" as any),
            ]);

          setStats({
            totalEquipment: equipment.length,
            totalCustomers: customers.length,
            activeRentals: rentals.filter((r) => r.status === "active").length,
            completedRentals: rentals.filter((r) => r.status === "completed")
              .length,
          });

          // حساب الإيرادات والأرباح من البيانات المحلية
          const startTime = startDate.getTime();
          const endTime = endDate.getTime();

          const rentalRevenue = rentals
            .filter((r: any) => {
              const date = new Date(r.start_date).getTime();
              return date >= startTime && date <= endTime;
            })
            .reduce((sum, r) => sum + (r.total_amount || 0), 0);

          const maintenanceRevenue = maintenance
            .filter((m: any) => {
              const date = new Date(m.request_date).getTime();
              return (
                m.status === "completed" && date >= startTime && date <= endTime
              );
            })
            .reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

          const totalExpenses = expenses
            .filter((e: any) => {
              const date = new Date(e.expense_date).getTime();
              return date >= startTime && date <= endTime;
            })
            .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

          const netProfit = rentalRevenue + maintenanceRevenue - totalExpenses;

          setFinancialStats({
            rentalRevenue,
            maintenanceRevenue,
            totalExpenses,
            netProfit,
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isOnline, startDate, endDate]);

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

  const financialCards = [
    {
      title: "إيرادات الإيجار",
      value: financialStats.rentalRevenue,
      icon: Receipt,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "إيرادات الصيانة",
      value: financialStats.maintenanceRevenue,
      icon: Wrench,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "إجمالي المصروفات",
      value: financialStats.totalExpenses,
      icon: DollarSign,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "صافي الربح",
      value: financialStats.netProfit,
      icon: PiggyBank,
      color: financialStats.netProfit >= 0 ? "text-green-600" : "text-red-600",
      bgColor: financialStats.netProfit >= 0 ? "bg-green-100" : "bg-red-100",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              لوحة التحكم
            </h2>
            <p className="text-muted-foreground">
              مرحباً بك في نظام إدارة الإيجار
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={dateRange === "month" ? "default" : "outline"}
              onClick={() => handleDateRangeChange("month")}
            >
              هذا الشهر
            </Button>
            <Button
              variant={dateRange === "year" ? "default" : "outline"}
              onClick={() => handleDateRangeChange("year")}
            >
              هذا العام
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateRange === "custom" ? "default" : "outline"}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  فترة مخصصة
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      من تاريخ
                    </label>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date);
                          setDateRange("custom");
                        }
                      }}
                      locale={ar}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      إلى تاريخ
                    </label>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date);
                          setDateRange("custom");
                        }
                      }}
                      locale={ar}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* إحصائيات عامة */}
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

        {/* التقرير المالي */}
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            التقرير المالي
            <span className="text-sm text-muted-foreground mr-2">
              ({format(startDate, "dd MMM yyyy", { locale: ar })} -{" "}
              {format(endDate, "dd MMM yyyy", { locale: ar })})
            </span>
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {financialCards.map((stat) => (
              <Card
                key={stat.title}
                className="transition-smooth hover:shadow-lg border-2"
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
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {loading
                      ? "..."
                      : `${stat.value.toLocaleString("ar-EG")} ريال`}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* التفاصيل الإضافية */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ملخص الأرباح</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">إيرادات الإيجار</span>
                  <span className="font-semibold text-blue-600">
                    {loading
                      ? "..."
                      : `${financialStats.rentalRevenue.toLocaleString(
                          "ar-EG"
                        )} ريال`}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">إيرادات الصيانة</span>
                  <span className="font-semibold text-purple-600">
                    +{" "}
                    {loading
                      ? "..."
                      : `${financialStats.maintenanceRevenue.toLocaleString(
                          "ar-EG"
                        )} ريال`}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">
                    إجمالي الإيرادات
                  </span>
                  <span className="font-semibold text-green-600">
                    {loading
                      ? "..."
                      : `${(
                          financialStats.rentalRevenue +
                          financialStats.maintenanceRevenue
                        ).toLocaleString("ar-EG")} ريال`}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">المصروفات</span>
                  <span className="font-semibold text-red-600">
                    -{" "}
                    {loading
                      ? "..."
                      : `${financialStats.totalExpenses.toLocaleString(
                          "ar-EG"
                        )} ريال`}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t-2">
                  <span className="font-bold text-lg">صافي الربح</span>
                  <span
                    className={`font-bold text-xl ${
                      financialStats.netProfit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {loading
                      ? "..."
                      : `${financialStats.netProfit.toLocaleString(
                          "ar-EG"
                        )} ريال`}
                  </span>
                </div>
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
                <li>سجل المصروفات وتابع الأرباح</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
