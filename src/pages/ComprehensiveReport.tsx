import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getAllFromLocal } from "@/lib/offline/db";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type AnyRecord = Record<string, any>;

export default function ComprehensiveReport() {
  const [searchParams] = useSearchParams();
  const startDate = searchParams.get("start") || "";
  const endDate = searchParams.get("end") || "";
  const isOnline = useOnlineStatus();

  const [rentals, setRentals] = useState<AnyRecord[]>([]);
  const [rentalItems, setRentalItems] = useState<AnyRecord[]>([]);
  const [equipment, setEquipment] = useState<AnyRecord[]>([]);
  const [expenses, setExpenses] = useState<AnyRecord[]>([]);
  const [maintenance, setMaintenance] = useState<AnyRecord[]>([]);
  const [branch, setBranch] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log("[Report] Loading data...", { isOnline, startDate, endDate });

      if (isOnline) {
        // تحميل من Supabase عندما يكون متصل
        console.log("[Report] Loading from Supabase...");

        // تحميل المعدات
        const { data: equipmentData } = await supabase
          .from("equipment")
          .select("*");
        setEquipment(equipmentData || []);

        // تحميل الإيجارات مع العملاء
        const { data: rentalsData } = await supabase
          .from("rentals")
          .select(
            `
            *,
            customers(full_name, phone)
          `
          )
          .gte("start_date", startDate)
          .lte("start_date", endDate)
          .order("start_date", { ascending: false });

        setRentals(rentalsData || []);

        // تحميل rental_items مع المعدات
        const { data: itemsData } = await supabase.from("rental_items").select(`
            *,
            equipment(name, code, daily_rate)
          `);

        setRentalItems(itemsData || []);

        // تحميل المصروفات
        const { data: expensesData } = await (supabase as any)
          .from("expenses")
          .select("*")
          .gte("expense_date", startDate)
          .lte("expense_date", endDate);

        setExpenses(expensesData || []);

        // تحميل الصيانة
        const { data: maintenanceData } = await (supabase as any)
          .from("maintenance_requests")
          .select(
            `
            *,
            equipment(name, code)
          `
          )
          .gte("request_date", startDate)
          .lte("request_date", endDate);

        setMaintenance(maintenanceData || []);

        // تحميل الفرع
        const { data: branchData } = await supabase
          .from("branches")
          .select("*")
          .limit(1)
          .single();

        if (branchData) setBranch(branchData);

        console.log("[Report] Loaded from Supabase:", {
          rentals: rentalsData?.length || 0,
          equipment: equipmentData?.length || 0,
          expenses: expensesData?.length || 0,
          maintenance: maintenanceData?.length || 0,
        });
      } else {
        // تحميل من IndexedDB عندما يكون offline
        console.log("[Report] Loading from IndexedDB...");

        const allRentals = await getAllFromLocal("rentals");
        const allEquipment = await getAllFromLocal("equipment");
        const allExpenses = await getAllFromLocal("expenses");
        const allMaintenance = await getAllFromLocal("maintenance_requests");
        const branches = await getAllFromLocal("branches");
        const customers = await getAllFromLocal("customers");
        const allRentalItems = await getAllFromLocal("rental_items");

        console.log("[Report] Loaded from IndexedDB:", {
          rentals: allRentals?.length || 0,
          equipment: allEquipment?.length || 0,
          expenses: allExpenses?.length || 0,
          maintenance: allMaintenance?.length || 0,
        });

        // إثراء بيانات الإيجارات بمعلومات العملاء
        const enrichedRentals = (allRentals || []).map((rental: any) => {
          const customer = (customers || []).find(
            (c: any) => c.id === rental.customer_id
          );
          return {
            ...rental,
            customers: customer || { full_name: "غير معروف" },
          };
        });

        // إثراء بيانات الصيانة بمعلومات المعدات
        const enrichedMaintenance = (allMaintenance || []).map((m: any) => {
          const equip = (allEquipment || []).find(
            (e: any) => e.id === m.equipment_id
          );
          return {
            ...m,
            equipment: equip || { name: "غير معروف" },
          };
        });

        // إثراء rental_items بمعلومات المعدات
        const enrichedItems = (allRentalItems || []).map((item: any) => {
          const equip = (allEquipment || []).find(
            (e: any) => e.id === item.equipment_id
          );
          return {
            ...item,
            equipment: equip || { name: "غير معروف", code: "-", daily_rate: 0 },
          };
        });
        setRentalItems(enrichedItems);

        // حساب المبلغ الإجمالي لكل إيجار
        const rentalsWithTotal = enrichedRentals.map((rental: any) => {
          const items = enrichedItems.filter(
            (item: any) => item.rental_id === rental.id
          );

          let totalAmount = 0;
          items.forEach((item: any) => {
            const rate = item.equipment?.daily_rate || 0;
            const quantity = item.quantity || 1;
            // حساب عدد الأيام
            const startDate = new Date(rental.start_date);
            const endDate = item.return_date
              ? new Date(item.return_date)
              : rental.end_date
              ? new Date(rental.end_date)
              : new Date();
            const days = Math.max(
              1,
              Math.ceil(
                (endDate.getTime() - startDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );

            totalAmount += rate * quantity * days;
          });

          return {
            ...rental,
            total_amount: totalAmount,
          };
        });

        // فلترة البيانات حسب التاريخ
        const filtered = {
          rentals: filterByDate(
            rentalsWithTotal,
            startDate,
            endDate,
            "start_date"
          ),
          equipment: allEquipment || [],
          expenses: filterByDate(
            allExpenses || [],
            startDate,
            endDate,
            "expense_date"
          ),
          maintenance: filterByDate(
            enrichedMaintenance,
            startDate,
            endDate,
            "request_date"
          ),
        };

        console.log("[Report] Filtered data:", {
          rentals: filtered.rentals.length,
          equipment: filtered.equipment.length,
          expenses: filtered.expenses.length,
          maintenance: filtered.maintenance.length,
        });

        setRentals(filtered.rentals);
        setEquipment(filtered.equipment);
        setExpenses(filtered.expenses);
        setMaintenance(filtered.maintenance);

        // تحميل بيانات الفرع
        if (branches && branches.length > 0) {
          setBranch(branches[0]);
        }
      }
    } catch (error) {
      console.error("[Report] Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterByDate = (
    data: AnyRecord[],
    start: string,
    end: string,
    dateField: string
  ) => {
    // إذا لم يكن هناك نطاق تاريخ محدد، أرجع كل البيانات
    if (!start || !end) {
      console.log(
        `[Report] No date filter for ${dateField}, returning all data`
      );
      return data;
    }

    const filtered = data.filter((item) => {
      const itemDate = item[dateField];
      if (!itemDate) return false;

      // تحويل التواريخ للمقارنة
      const itemDateStr = String(itemDate).split("T")[0]; // فقط التاريخ بدون الوقت
      return itemDateStr >= start && itemDateStr <= end;
    });

    console.log(
      `[Report] Filtered ${dateField}: ${data.length} -> ${filtered.length}`
    );
    return filtered;
  };

  const handlePrint = () => {
    window.print();
  };

  // حسابات الإيرادات والمصروفات
  const rentalRevenue = rentals.reduce((sum, rental) => {
    // حساب الإيرادات من كل معدة في الإيجار
    const items = rentalItems.filter(
      (item: any) => item.rental_id === rental.id
    );

    const rentalTotal = items.reduce((itemSum: number, item: any) => {
      const startDate = new Date(rental.start_date);
      const endDate = item.return_date
        ? new Date(item.return_date)
        : rental.end_date
        ? new Date(rental.end_date)
        : new Date();
      const days = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const rate = item.equipment?.daily_rate || 0;
      const quantity = item.quantity || 1;

      return itemSum + rate * quantity * days;
    }, 0);

    return sum + rentalTotal;
  }, 0);

  const maintenanceRevenue = maintenance.reduce((sum, m) => {
    return sum + (m.cost || 0);
  }, 0);

  const totalExpenses = expenses.reduce((sum, exp) => {
    return sum + (exp.amount || 0);
  }, 0);

  const totalRevenue = rentalRevenue + maintenanceRevenue;
  const netProfit = totalRevenue - totalExpenses;

  console.log("[Report] Financial Summary:", {
    rentalRevenue,
    maintenanceRevenue,
    totalExpenses,
    netProfit,
    rentalsCount: rentals.length,
    expensesCount: expenses.length,
  });

  // إحصائيات المعدات
  const availableEquipment = equipment.filter((e) => e.status === "available");
  const rentedEquipment = equipment.filter((e) => e.status === "rented");
  const maintenanceEquipment = equipment.filter(
    (e) => e.status === "maintenance"
  );

  return (
    <div className="min-h-screen bg-background">
      {/* أزرار التحكم - تختفي عند الطباعة */}
      <div className="print:hidden sticky top-0 z-50 bg-background border-b p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              رجوع للوحة التحكم
            </Button>
          </Link>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
        </div>
      </div>

      {/* محتوى التقرير - قابل للطباعة */}
      <div className="container mx-auto p-8 max-w-5xl">
        {loading ? (
          <div className="bg-white shadow-lg rounded-lg p-8 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">جاري تحميل البيانات...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-lg p-8 print:shadow-none">
            {/* رأس التقرير */}
            <div className="text-center mb-8 border-b pb-6">
              <h1 className="text-3xl font-bold mb-2">التقرير الشامل</h1>
              {branch && (
                <>
                  <h2 className="text-xl text-muted-foreground mb-2">
                    {branch.name}
                  </h2>
                  {branch.address && (
                    <p className="text-sm text-muted-foreground">
                      {branch.address}
                    </p>
                  )}
                  {branch.phone && (
                    <p className="text-sm text-muted-foreground">
                      هاتف: {branch.phone}
                    </p>
                  )}
                </>
              )}
              <div className="mt-4 text-sm text-muted-foreground">
                {startDate && endDate ? (
                  <p>
                    الفترة من{" "}
                    {format(new Date(startDate), "dd MMMM yyyy", {
                      locale: ar,
                    })}{" "}
                    إلى{" "}
                    {format(new Date(endDate), "dd MMMM yyyy", { locale: ar })}
                  </p>
                ) : (
                  <p>جميع الفترات</p>
                )}
                <p className="mt-1">
                  تاريخ الطباعة:{" "}
                  {format(new Date(), "dd MMMM yyyy - HH:mm", { locale: ar })}
                </p>
              </div>
            </div>

            {/* الملخص المالي */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 border-b pb-2">
                الملخص المالي
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    إيرادات الإيجارات
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {rentalRevenue.toLocaleString("ar-EG")} ريال
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    إيرادات الصيانة
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {maintenanceRevenue.toLocaleString("ar-EG")} ريال
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    إجمالي المصروفات
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {totalExpenses.toLocaleString("ar-EG")} ريال
                  </p>
                </div>
                <div
                  className={`${
                    netProfit >= 0 ? "bg-green-50" : "bg-red-50"
                  } p-4 rounded-lg`}
                >
                  <p className="text-sm text-muted-foreground mb-1">
                    صافي الربح
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      netProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {netProfit.toLocaleString("ar-EG")} ريال
                  </p>
                </div>
              </div>
            </div>

            {/* إحصائيات المعدات */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 border-b pb-2">
                إحصائيات المعدات
              </h3>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    إجمالي المعدات
                  </p>
                  <p className="text-3xl font-bold">{equipment.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">متاحة</p>
                  <p className="text-3xl font-bold text-green-600">
                    {availableEquipment.length}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">مؤجرة</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {rentedEquipment.length}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">صيانة</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {maintenanceEquipment.length}
                  </p>
                </div>
              </div>

              {/* جدول المعدات */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-right">الكود</th>
                    <th className="border p-2 text-right">اسم المعدة</th>
                    <th className="border p-2 text-center">الحالة</th>
                    <th className="border p-2 text-center">السعر اليومي</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((eq) => (
                    <tr key={eq.id}>
                      <td className="border p-2">{eq.code}</td>
                      <td className="border p-2">{eq.name}</td>
                      <td className="border p-2 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            eq.status === "available"
                              ? "bg-green-100 text-green-800"
                              : eq.status === "rented"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {eq.status === "available"
                            ? "متاح"
                            : eq.status === "rented"
                            ? "مؤجر"
                            : "صيانة"}
                        </span>
                      </td>
                      <td className="border p-2 text-center">
                        {eq.daily_rate?.toLocaleString("ar-EG")} ريال
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* جدول الإيجارات */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 border-b pb-2">
                الإيجارات ({rentals.length})
              </h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-right">العميل</th>
                    <th className="border p-2 text-right">المعدة</th>
                    <th className="border p-2 text-center">الكمية</th>
                    <th className="border p-2 text-center">السعر/يوم</th>
                    <th className="border p-2 text-center">عدد الأيام</th>
                    <th className="border p-2 text-center">تاريخ البداية</th>
                    <th className="border p-2 text-center">تاريخ الإرجاع</th>
                    <th className="border p-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((rental) => {
                    const items = rentalItems.filter(
                      (item: any) => item.rental_id === rental.id
                    );

                    if (items.length === 0) {
                      return (
                        <tr key={rental.id}>
                          <td className="border p-2">
                            {rental.customers?.full_name || "-"}
                          </td>
                          <td
                            colSpan={7}
                            className="border p-2 text-center text-muted-foreground"
                          >
                            لا توجد معدات
                          </td>
                        </tr>
                      );
                    }

                    return items.map((item: any, idx: number) => {
                      const startDate = new Date(rental.start_date);
                      const endDate = item.return_date
                        ? new Date(item.return_date)
                        : rental.end_date
                        ? new Date(rental.end_date)
                        : new Date();
                      const days = Math.max(
                        1,
                        Math.ceil(
                          (endDate.getTime() - startDate.getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      );
                      const rate = item.equipment?.daily_rate || 0;
                      const quantity = item.quantity || 1;
                      const total = rate * quantity * days;

                      return (
                        <tr key={`${rental.id}-${item.id}`}>
                          {idx === 0 && (
                            <td className="border p-2" rowSpan={items.length}>
                              <div>
                                <div className="font-medium">
                                  {rental.customers?.full_name || "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {rental.rental_type === "daily"
                                    ? "يومي"
                                    : "شهري"}
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="border p-2">
                            <div>
                              <div className="font-medium">
                                {item.equipment?.name || "-"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.equipment?.code || "-"}
                              </div>
                            </div>
                          </td>
                          <td className="border p-2 text-center font-medium">
                            {quantity}
                          </td>
                          <td className="border p-2 text-center">
                            {rate.toLocaleString("ar-EG")} ريال
                          </td>
                          <td className="border p-2 text-center font-medium">
                            {days}
                          </td>
                          <td className="border p-2 text-center">
                            {format(startDate, "dd/MM/yyyy", { locale: ar })}
                          </td>
                          <td className="border p-2 text-center">
                            {item.return_date
                              ? format(
                                  new Date(item.return_date),
                                  "dd/MM/yyyy",
                                  { locale: ar }
                                )
                              : rental.end_date
                              ? format(
                                  new Date(rental.end_date),
                                  "dd/MM/yyyy",
                                  { locale: ar }
                                )
                              : "جاري"}
                          </td>
                          <td className="border p-2 text-center font-bold text-blue-600">
                            {total.toLocaleString("ar-EG")} ريال
                          </td>
                        </tr>
                      );
                    });
                  })}
                  {rentals.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="border p-4 text-center text-muted-foreground"
                      >
                        لا توجد إيجارات في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                {rentals.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={7} className="border p-2 text-right">
                        إجمالي إيرادات الإيجارات
                      </td>
                      <td className="border p-2 text-center">
                        {rentalRevenue.toLocaleString("ar-EG")} ريال
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* جدول المصروفات */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 border-b pb-2">
                المصروفات ({expenses.length})
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-right">التاريخ</th>
                    <th className="border p-2 text-right">الوصف</th>
                    <th className="border p-2 text-center">الفئة</th>
                    <th className="border p-2 text-center">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="border p-2">
                        {expense.expense_date
                          ? format(
                              new Date(expense.expense_date),
                              "dd/MM/yyyy",
                              {
                                locale: ar,
                              }
                            )
                          : "-"}
                      </td>
                      <td className="border p-2">
                        {expense.description || "-"}
                      </td>
                      <td className="border p-2 text-center">
                        {expense.category || "-"}
                      </td>
                      <td className="border p-2 text-center">
                        {(expense.amount || 0).toLocaleString("ar-EG")} ريال
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="border p-4 text-center text-muted-foreground"
                      >
                        لا توجد مصروفات في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                {expenses.length > 0 && (
                  <tfoot>
                    <tr className="bg-red-50 font-bold">
                      <td colSpan={3} className="border p-2 text-right">
                        إجمالي المصروفات
                      </td>
                      <td className="border p-2 text-center">
                        {totalExpenses.toLocaleString("ar-EG")} ريال
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* جدول الصيانة */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 border-b pb-2">
                أعمال الصيانة ({maintenance.length})
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-right">التاريخ</th>
                    <th className="border p-2 text-right">المعدة</th>
                    <th className="border p-2 text-right">الوصف</th>
                    <th className="border p-2 text-center">التكلفة</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.map((m) => (
                    <tr key={m.id}>
                      <td className="border p-2">
                        {m.request_date
                          ? format(new Date(m.request_date), "dd/MM/yyyy", {
                              locale: ar,
                            })
                          : "-"}
                      </td>
                      <td className="border p-2">{m.equipment?.name || "-"}</td>
                      <td className="border p-2">{m.description || "-"}</td>
                      <td className="border p-2 text-center">
                        {(m.cost || 0).toLocaleString("ar-EG")} ريال
                      </td>
                    </tr>
                  ))}
                  {maintenance.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="border p-4 text-center text-muted-foreground"
                      >
                        لا توجد أعمال صيانة في هذه الفترة
                      </td>
                    </tr>
                  )}
                </tbody>
                {maintenance.length > 0 && (
                  <tfoot>
                    <tr className="bg-purple-50 font-bold">
                      <td colSpan={3} className="border p-2 text-right">
                        إجمالي تكاليف الصيانة
                      </td>
                      <td className="border p-2 text-center">
                        {maintenanceRevenue.toLocaleString("ar-EG")} ريال
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* الملخص النهائي */}
            <div className="border-t-2 pt-6 mt-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold mb-2">الإيرادات:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>إيرادات الإيجارات:</span>
                      <span>{rentalRevenue.toLocaleString("ar-EG")} ريال</span>
                    </div>
                    <div className="flex justify-between">
                      <span>إيرادات الصيانة:</span>
                      <span>
                        {maintenanceRevenue.toLocaleString("ar-EG")} ريال
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
                      <span>إجمالي الإيرادات:</span>
                      <span className="text-green-600">
                        {totalRevenue.toLocaleString("ar-EG")} ريال
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold mb-2">المصروفات:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>إجمالي المصروفات:</span>
                      <span className="text-red-600">
                        {totalExpenses.toLocaleString("ar-EG")} ريال
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1">
                      <span>صافي الربح:</span>
                      <span
                        className={
                          netProfit >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        {netProfit.toLocaleString("ar-EG")} ريال
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* التوقيع */}
            <div className="mt-12 pt-8 border-t grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-t-2 border-black inline-block px-8 pt-2">
                  <p className="font-bold">المدير</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t-2 border-black inline-block px-8 pt-2">
                  <p className="font-bold">المحاسب</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
