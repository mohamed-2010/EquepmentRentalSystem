import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getAllFromLocal,
  getFromLocal,
  BranchData,
  CustomerData,
  EquipmentData,
} from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";

type AnyRecord = Record<string, any>;

function daysBetween(startISO: string, endISO?: string) {
  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date();
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export default function RentalInvoice() {
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
      setItems(filtered);

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

  const totals = useMemo(() => {
    let subtotal = 0;
    const lines = items.map((it) => {
      const rate = it?.equipment?.daily_rate ?? 0;
      const quantity = it?.quantity ?? 1;
      const days = it?.days_count ?? daysBetween(it.start_date, it.return_date);
      // احسب المبلغ بضرب السعر × الأيام × الكمية (تجاهل it.amount لأنه قد يكون خاطئ)
      const amount = rate * days * quantity;
      subtotal += Number(amount || 0);
      return {
        id: it.id,
        name: it?.equipment?.name,
        code: it?.equipment?.code,
        rate,
        quantity,
        days,
        amount,
      };
    });
    const tax = 0; // يمكن إضافة ضريبة لاحقاً
    const total = subtotal + tax;
    return { lines, subtotal, tax, total };
  }, [items]);

  const print = () => window.print();

  if (!rental) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
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
    <div className="p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="max-w-3xl mx-auto bg-white border rounded-lg shadow-sm">
        <div className="flex justify-between items-start p-6 border-b">
          <div>
            <h1 className="text-2xl font-bold">فاتورة إيجار</h1>
            <p className="text-sm text-muted-foreground">
              رقم العقد: {rental.id}
            </p>
          </div>
          <div className="text-right">
            <div className="font-semibold text-lg">
              {branch?.company_name || branch?.name || "الفرع"}
            </div>
            {branch?.tax_number && (
              <div className="text-sm">الرقم الضريبي: {branch.tax_number}</div>
            )}
            {branch?.commercial_registration && (
              <div className="text-sm">
                السجل التجاري: {branch.commercial_registration}
              </div>
            )}
            {branch?.phone && (
              <div className="text-sm">هاتف: {branch.phone}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-6">
          <div>
            <div className="text-sm text-muted-foreground">العميل</div>
            <div className="font-medium">
              {customer?.full_name || rental.customers?.full_name || "-"}
            </div>
            <div className="text-sm">
              {customer?.phone || rental.customers?.phone || "-"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">تفاصيل العقد</div>
            <div className="text-sm">
              النوع: {rental.rental_type === "monthly" ? "شهري" : "يومي"}
            </div>
            <div className="text-sm">
              تاريخ البداية: {String(rental.start_date).slice(0, 10)}
            </div>
            {rental.end_date && (
              <div className="text-sm">
                تاريخ النهاية: {String(rental.end_date).slice(0, 10)}
              </div>
            )}
            {rental.is_fixed_duration && rental.expected_end_date && (
              <div className="text-sm">
                الإرجاع المتوقع: {String(rental.expected_end_date).slice(0, 10)}
              </div>
            )}
            {rental.status && (
              <div className="text-sm">
                الحالة: {rental.status === "completed" ? "منتهي" : "نشط"}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 pt-0">
          <table className="w-full text-sm border">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 border">المعدة</th>
                <th className="p-2 border">الكود</th>
                <th className="p-2 border">الكمية</th>
                <th className="p-2 border">السعر/يوم</th>
                <th className="p-2 border">المدة (يوم)</th>
                <th className="p-2 border">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((ln) => (
                <tr key={ln.id}>
                  <td className="p-2 border">{ln.name || "-"}</td>
                  <td className="p-2 border">{ln.code || "-"}</td>
                  <td className="p-2 border">{ln.quantity}</td>
                  <td className="p-2 border">
                    {Number(ln.rate || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border">{ln.days}</td>
                  <td className="p-2 border">
                    {Number(ln.amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-2 border text-right" colSpan={5}>
                  المجموع
                </td>
                <td className="p-2 border font-semibold">
                  {totals.subtotal.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="p-2 border text-right" colSpan={5}>
                  الضريبة
                </td>
                <td className="p-2 border font-semibold">
                  {totals.tax.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="p-2 border text-right" colSpan={5}>
                  الإجمالي النهائي
                </td>
                <td className="p-2 border font-bold text-primary">
                  {totals.total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {rental.notes && (
          <div className="px-6 pb-2 text-sm">
            <div className="text-muted-foreground">ملاحظات:</div>
            <div>{rental.notes}</div>
          </div>
        )}

        <div className="flex items-center justify-between p-6 border-t no-print">
          <Link to="/rentals" className="no-underline">
            <Button variant="outline" className="gap-2">
              <ArrowRight className="h-4 w-4" /> عودة
            </Button>
          </Link>
          <Button onClick={print} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>
    </div>
  );
}
