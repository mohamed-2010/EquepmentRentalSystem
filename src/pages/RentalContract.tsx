import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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

      // branch - Always load from IndexedDB to get complete data
      if (r?.branch_id) {
        const bs = await getAllFromLocal("branches");
        const b =
          (bs || []).find((x: BranchData) => x.id === r.branch_id) || null;
        setBranch(b);
      }

      // customer - Always load from IndexedDB to get complete data
      if (r?.customer_id) {
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
          <Button
            type="button"
            onClick={() => navigate(-1)}
            variant="outline"
            className="gap-2"
          >
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
            <h1 className="font-bold text-lg mb-2">
              {branch?.company_name ||
                `مؤسسة ${branch?.name || "عتبة المحلات"}`}
            </h1>
            <div className="text-sm mb-2">
              <div>لتأجير المعدات و صيانتها</div>
              {/* {branch?.name && (
                <div className="font-semibold text-primary mt-1">
                  الفرع: {branch.name}
                </div>
              )} */}
            </div>
            <div className="text-sm">
              <div>جوال: {branch?.phone || "-"}</div>
            </div>
          </div>

          <div className="text-center flex items-center justify-center">
            <div className="border-2 border-gray-800 px-6 py-2 rounded-lg">
              <div className="font-bold text-lg">عقد إيجار معدة</div>
            </div>
          </div>

          <div className="text-left">
            <div className="font-bold text-lg mb-2">
              التاريخ: {rental.start_date}
            </div>
            <div className="text-sm mb-2">
              <div>
                الوقت:{" "}
                {rental.created_at
                  ? format(new Date(rental.created_at), "hh:mm a", {
                      locale: ar,
                    })
                  : "-"}
              </div>
            </div>
            <div className="text-sm">
              <div>
                رقم العقد: {rental.invoice_number || rental.id.slice(0, 8)}
              </div>
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
                رقم الهوية / الإقامة
              </div>
              <div className="border border-gray-800 p-2">
                {customer?.id_number || rental.customers?.id_number || "-"}
              </div>
            </div>
            {/* <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                التــــاريخ
              </div>
              <div className="border border-gray-800 p-2">
                {format(new Date(rental.start_date), "dd/MM/yyyy")}
              </div>
            </div> */}
          </div>

          <div className="space-y-2">
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
                مصدر الهوية
              </div>
              <div className="border border-gray-800 p-2">
                {customer?.id_source || rental.customers?.id_source || "-"}
              </div>
            </div>
            {/* <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                الجـــوال
              </div>
              <div className="border border-gray-800 p-2">
                {customer?.phone || rental.customers?.phone || "-"}
              </div>
            </div> */}
            {/* <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="border border-gray-800 p-2 text-center font-semibold bg-gray-100">
                رقم العقد
              </div>
              <div className="border border-gray-800 p-2">
                {rental.id.slice(0, 8)}
              </div>
            </div> */}
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
              {/* <tr>
                <td
                  colSpan={4}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  الضريبة
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  0
                </td>
              </tr> */}
              <tr>
                <td
                  colSpan={4}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  تأمين
                </td>
                <td className="border border-gray-800 p-2 text-center font-bold">
                  {(rental?.deposit_amount || 0).toLocaleString("ar-EG")}
                </td>
              </tr>
              {/* <tr>
                <td
                  colSpan={5}
                  className="border border-gray-800 p-2 text-center font-bold bg-gray-100"
                >
                  إجمالي سداد الفاتورة
                </td>
              </tr> */}
            </tfoot>
          </table>
        </div>

        {/* Terms and Conditions */}
        <div className="text-lg leading-relaxed space-y-1.5 mb-6 border-t pt-3 avoid-break">
          <p className="font-semibold text-center mb-2">الشروط والأحكام</p>
          <p>
            م١ـ يلتزم العميل بترجيع المعدات المستاجرة ليوم واحده قبل نهاية
            الدوام ليلا
          </p>
          <p>
            م٢ـ يلتزم العميل بترجيع المعده في الوقت المحدد وفي حال عدم الترجع
            يلتزم العميل بدفع اﻻيام المتاخره بسعر ايجار المعده اليومي المذكوره
            اعلاه
          </p>
          <p>
            م٣ـ يلتزم العميل بترجيع المعدة سليمه وبدون اي تلف ناتج عن سوء
            اﻻستخدام و في حال التلف يلتزم العميل بكافه تكاليف الاصلاح من اجور
            قطع الغيار وفي حال تلف المعده يتحمل المستاجر تصليح .
          </p>
          <p>
            م٤ـ المؤسسة غير مسؤلة عن اي خسائر في اﻻرواح والممتلكات نتيجه اي سبب
            في المعده .
          </p>
          <p>
            م٥ـ للمؤسسة حق اﻻحتفاظ بقيمه التأمين في حالة تلف المعدة لحين اصلاحها
            وتصفيه المستحقات
          </p>
          <p>
            م٦ـ حسب اﻻيجار المعده من بعد خروجها من المحل وما لم تكن غير صالحه
            للعمل .
          </p>
          <p>
            م٧ ـاقر انا الموقع ادناه انني استلمت المعده بحاله جيده و انه تم
            ابلاغي بالطريقه الصحيحه . للإستعمال المعده وانني مسؤول عن اي تلف
            يحدث للمعدة
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
          {/* <div className="text-center">
            <div className="mb-12 text-sm">........................</div>
            <div className="font-bold border-t-2 border-gray-800 pt-2">
              الاسم
            </div>
            <div className="font-bold border-t-2 border-gray-800 pt-2 mt-4">
              التوقيع
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
