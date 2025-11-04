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
      console.log("[RentalContract] Loading rental:", id);
      const r = await getFromLocal("rentals", id);
      console.log("[RentalContract] Rental data:", r);
      setRental(r || null);

      const allItems = await getAllFromLocal("rental_items");
      const filtered = (allItems || []).filter(
        (ri: AnyRecord) => ri.rental_id === id
      );
      console.log("[RentalContract] Rental items:", filtered);

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
          html, body { width: 210mm; height: 297mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4 portrait; margin: 8mm; }
          body { zoom: 0.92; }
          table, tr, td, th { page-break-inside: avoid; }
          .avoid-break { page-break-inside: avoid; }
        }
        .contract-page {
          background: white;
          max-width: 21cm;
          margin: 0 auto;
          padding: 1cm;
          min-height: 29.7cm;
          font-size: 12px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .contract-page h3, .contract-page .section-title { font-size: 14px; }
        @media print {
          .contract-page {
            box-shadow: none;
            margin: 0;
            width: 100%;
            height: calc(297mm - 16mm);
            min-height: auto;
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
              {/* {branch?.name && (
                <div className="font-semibold text-primary mt-1">
                  الفرع: {branch.name}
                </div>
              )} */}
            </div>
          </div>

          <div className="text-center flex items-center justify-center">
            <div className="border-2 border-gray-800 px-6 py-2 rounded-lg">
              <div className="font-bold text-lg">عقد إيجار معدة</div>
            </div>
          </div>

          <div className="text-left">
            <div className="font-bold text-lg mb-2">
              مؤسسة {branch?.name || "عتبة المحلات"}
            </div>
            <div className="text-sm">
              <div>لتأجير وبيع وصيانة المعدات</div>
              {branch?.address && <div>{branch.address}</div>}
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
                {(customer as any)?.id_number || "-"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                مصدر الهوية
              </div>
              <div className="border border-gray-800 p-2">
                {(customer as any)?.id_source || "-"}
              </div>
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

          <table className="w-full border-collapse text-sm avoid-break">
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
                    {item.equipment?.code || "-"}
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
                  الضريبة
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
                  إجمالي سداد الفاتورة
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Terms and Conditions */}
        <div className="text-xs leading-relaxed space-y-1.5 mb-6 border-t pt-3 avoid-break">
          <p className="font-semibold text-center mb-2">الشروط والأحكام</p>
          <p>• مدة الإيجار اليومية 24 ساعة من وقت الاستلام.</p>
          <p>
            • يستحق الإيجار اليومي عن كل 24 ساعة أو جزء منها ما لم يتم الإرجاع.
          </p>
          <p>
            • يلتزم المستأجر بإعادة المعدة سليمة ونظيفة، ويتحمل تكلفة أي تلف أو
            فقدان.
          </p>
          <p>
            • يحق للمؤسسة خصم قيمة التلف أو الإصلاح من التأمين/الضمان حتى تسوية
            المستحقات.
          </p>
          <p>
            • على المستأجر فحص المعدة عند الاستلام وإبلاغ المؤسسة فوراً بأي
            ملاحظة.
          </p>
          <p>
            • يتحمل المستأجر أي أضرار ناتجة عن سوء الاستخدام أو التشغيل غير
            الصحيح.
          </p>
          <p>
            • لا يجوز نقل المعدة أو تأجيرها من الباطن إلا بموافقة خطية من
            المؤسسة.
          </p>
          <p>
            • تحتفظ المؤسسة بحقها في حجز نسبة من التأمين حتى اكتمال الإصلاحات
            وسداد جميع المستحقات.
          </p>
          <p>
            • في حال التأخر عن السداد يحق للمؤسسة المطالبة قانونياً بعد إشعار
            المستأجر.
          </p>
          <p>
            • الأسعار لا تشمل الوقود أو المُشغّل أو النقل أو الرسوم الحكومية ما
            لم يُذكر خلاف ذلك.
          </p>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-6 pt-4 border-t-2 border-gray-800 avoid-break">
          <div className="text-center">
            <div className="mb-12 text-sm">........................</div>
            <div className="font-bold border-t-2 border-gray-800 pt-2">
              الاسم
            </div>
            <div className="font-bold border-t-2 border-gray-800 pt-2 mt-4">
              التوقيع
            </div>
          </div>
          <div className="text-center">
            <div className="mb-12 text-sm">........................</div>
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
