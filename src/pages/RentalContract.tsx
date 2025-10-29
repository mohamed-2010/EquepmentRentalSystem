import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getAllFromLocal,
  getFromLocal,
  BranchData,
  CustomerData,
} from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type AnyRecord = Record<string, any>;

export default function RentalContract() {
  const { id } = useParams<{ id: string }>();
  const [rental, setRental] = useState<AnyRecord | null>(null);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [customer, setCustomer] = useState<CustomerData | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const r = await getFromLocal("rentals", id);
      setRental(r || null);

      const allItems = await getAllFromLocal("rental_items");
      const filtered = (allItems || []).filter(
        (ri: AnyRecord) => ri.rental_id === id
      );

      // Enrich items with equipment data
      const allEquipment = await getAllFromLocal("equipment");
      const enrichedItems = filtered.map((item: AnyRecord) => {
        const equip = (allEquipment || []).find(
          (e: any) => e.id === item.equipment_id
        );
        return {
          ...item,
          equipment: equip
            ? {
                name: equip.name,
                code: equip.code,
                daily_rate: equip.daily_rate,
              }
            : null,
        };
      });

      setItems(enrichedItems);

      // branch
      if (r?.branches) {
        setBranch(r.branches as BranchData);
      } else if (r?.branch_id) {
        const bs = await getAllFromLocal("branches");
        const b =
          (bs || []).find((x: BranchData) => x.id === r.branch_id) || null;
        setBranch(b);
      }

      // customer
      if (r?.customers) {
        setCustomer(r.customers as CustomerData);
      } else if (r?.customer_id) {
        const cs = await getAllFromLocal("customers");
        const c =
          (cs || []).find((x: CustomerData) => x.id === r.customer_id) || null;
        setCustomer(c);
      }
    })();
  }, [id]);

  const print = () => window.print();

  if (!rental) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <Link to="/rentals" className="no-underline">
              <Button variant="ghost" className="gap-2 no-print">
                <ArrowRight className="h-4 w-4" />
                العودة للإيجارات
              </Button>
            </Link>
          </div>
          <div className="text-center text-muted-foreground">
            لا يوجد عقد بهذا الرقم
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1cm; }
        }
        .contract-page {
          background: white;
          max-width: 21cm;
          margin: 0 auto;
          padding: 2cm;
          min-height: 29.7cm;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        @media print {
          .contract-page {
            box-shadow: none;
            margin: 0;
          }
        }
      `}</style>

      <div className="no-print mb-4 max-w-4xl mx-auto flex justify-between items-center">
        <Link to="/rentals" className="no-underline">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="h-4 w-4" /> عودة
          </Button>
        </Link>
        <Button onClick={print} className="gap-2">
          <Printer className="h-4 w-4" /> طباعة العقد
        </Button>
      </div>

      <div className="contract-page" dir="rtl">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 mb-8 pb-4 border-b-2 border-gray-300">
          <div className="text-right">
            <h3 className="font-bold text-lg mb-2">إيجار معدات</h3>
            <div className="text-sm">
              <div>صيانة جميع المعدات</div>
              {branch?.phone && <div>جوال: {branch.phone}</div>}
            </div>
          </div>

          <div className="text-center flex items-center justify-center">
            <div className="border-2 border-gray-800 px-6 py-2 rounded-lg">
              <div className="font-bold text-lg">عقد إيجار معدة</div>
            </div>
          </div>

          <div className="text-left">
            <div className="font-bold text-lg mb-2">مؤسسة عتبة المحلات</div>
            <div className="text-sm">
              <div>لتأجير وبيع وصيانة المعدات</div>
              <div>الرس - صناعة الحراء</div>
            </div>
          </div>
        </div>

        {/* Contract Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                الاسم
              </div>
              <div className="border border-gray-800 p-2">
                {customer?.full_name || rental.customers?.full_name || "-"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                موقع العمل
              </div>
              <div className="border border-gray-800 p-2">
                {(customer as any)?.address || "-"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                التــــاريخ
              </div>
              <div className="border border-gray-800 p-2">
                {format(new Date(rental.start_date), "dd/MM/yyyy")}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                رقم الهوية / الإقامة
              </div>
              <div className="border border-gray-800 p-2">
                {(customer as any)?.national_id || "-"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                مصدر الهوية
              </div>
              <div className="border border-gray-800 p-2">-</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                الجـــوال
              </div>
              <div className="border border-gray-800 p-2">
                {customer?.phone || rental.customers?.phone || "-"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                رقم العقد
              </div>
              <div className="border border-gray-800 p-2">
                {rental.id.slice(0, 8)}
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Details */}
        <div className="mb-6">
          <div className="text-center border-2 border-gray-800 px-4 py-2 bg-gray-100 font-bold mb-3">
            بيانات التأجير
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 p-2">كود المعدة</th>
                <th className="border border-gray-800 p-2">نوع المعدة</th>
                <th className="border border-gray-800 p-2">العدد</th>
                <th className="border border-gray-800 p-2">الإيجار اليومي</th>
                <th className="border border-gray-800 p-2">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="border border-gray-800 p-2 text-center">
                    {idx + 1}
                  </td>
                  <td className="border border-gray-800 p-2">
                    {item.equipment?.name || "معدة غير معروفة"}
                  </td>
                  <td className="border border-gray-800 p-2 text-center">
                    {item.quantity || 1}
                  </td>
                  <td className="border border-gray-800 p-2 text-center">
                    {item.equipment?.daily_rate || 0}
                  </td>
                  <td className="border border-gray-800 p-2 text-center">
                    {(item.equipment?.daily_rate || 0) * (item.quantity || 1)}
                  </td>
                </tr>
              ))}
              {/* Empty rows */}
              {[...Array(Math.max(0, 3 - items.length))].map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-gray-800 p-2 text-center">
                    {items.length + i + 1}
                  </td>
                  <td className="border border-gray-800 p-2">&nbsp;</td>
                  <td className="border border-gray-800 p-2">&nbsp;</td>
                  <td className="border border-gray-800 p-2">&nbsp;</td>
                  <td className="border border-gray-800 p-2">&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  إجمالي الفاتورة
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  {items.reduce(
                    (sum, it) =>
                      sum +
                      (it.equipment?.daily_rate || 0) * (it.quantity || 1),
                    0
                  )}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  الضريبون
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  0
                </td>
              </tr>
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  الخـــصم
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  0
                </td>
              </tr>
              <tr>
                <td
                  colSpan={5}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  إجمالي تسديد الفاتورة
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Terms and Conditions */}
        <div className="text-xs leading-relaxed space-y-2 mb-8 border-t pt-4">
          <p className="font-semibold text-center mb-3">شروط وملاحظات</p>
          <p>• مدة صلاحية تأجير المعدة 24 ساعة من الاستلام.</p>
          <p>
            • المحترم يلتزم المستأجر بإلإقاء الإيجار اليومي للعمل عن كل 24 ساعة.
          </p>
          <p>
            • ضمان المستأجر إرجاع المعدة سليمة؛ وبدون أي طلل تبيع بيخصم من
            الضمان المتاخذ مبلغ غير محرد.
          </p>
          <p>
            • يلتزم المستأجر بفحص المعدة عن أي خلل أو تلف وقبل أي دي حالة تلك
            المعدة يتحمل.
          </p>
          <p>
            • مسؤولية عن أي ضمر في الأعواب والمستلمات نتيجة أي نسبب في المعدة.
          </p>
          <p>
            • المؤسسة تحق الاحتفاظ بنسة التشبيت في حالة تلك المعدة لحين إصلاحها
            وإصلاحية المستحقات.
          </p>
          <p>
            • مدلة 30 ايام للمؤسسة للحل في المطالبة بالتسديد ما مضى وعند عدم
            الالتزام يتم اتخاذ الإجراءات.
          </p>
          <p>
            • يجوز للمستأجر بعد خروجها من المحل وما لم تكن غير مطابقة للعمل.
          </p>
          <p>• نسوع الحق لنا بتاتيت اشعار المعدات المتكونة اعلاه بحالة جهزة.</p>
          <p>
            • بالملاحق بالتهريفة الصحيحة لإستعمان الماده بها، والتي تمحول أي في
            أي تلك يحدث للمعدة.
          </p>
          <p>• المرفقة التالاوية يتحمل المستأجر تكلفت أجور مرابلة فاتورة.</p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-gray-800">
          <div className="text-center">
            <div className="mb-16 text-sm">........................</div>
            <div className="font-bold border-t-2 border-gray-800 pt-2">
              الاسم
            </div>
            <div className="font-bold border-t-2 border-gray-800 pt-2 mt-4">
              التوقيع
            </div>
          </div>
          <div className="text-center">
            <div className="mb-16 text-sm">........................</div>
            <div className="font-bold border-t-2 border-gray-800 pt-2">
              الاسم
            </div>
            <div className="font-bold border-t-2 border-gray-800 pt-2 mt-4">
              التوقيع
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
