import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAllFromLocal,
  getFromLocal,
  BranchData,
  CustomerData,
  EquipmentData,
} from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  const navigate = useNavigate();
  const [rental, setRental] = useState<AnyRecord | null>(null);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [customer, setCustomer] = useState<CustomerData | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      console.log("[RentalInvoice] Loading rental:", id);
      const r = await getFromLocal("rentals", id);
      console.log("[RentalInvoice] Rental data:", r);
      setRental(r || null);

      const allItems = await getAllFromLocal("rental_items");
      const filtered = (allItems || []).filter(
        (ri: AnyRecord) => ri.rental_id === id
      );
      console.log("[RentalInvoice] Rental items:", filtered);

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
      console.log("[RentalInvoice] Enriched items:", enrichedItems);
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
        startDate: it.start_date?.split("T")[0] || "-",
        returnDate: it.return_date?.split("T")[0] || "-",
        rate,
        quantity,
        days,
        amount,
      };
    });
    const discount = rental?.discount_amount || 0;
    const deposit = rental?.deposit_amount || 0;
    const total = subtotal - discount - deposit;
    return { lines, subtotal, discount, deposit, total };
  }, [items, rental]);

  const print = () => window.print();

  if (!rental) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              variant="ghost"
              className="gap-2 no-print"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للإيجارات
            </Button>
          </div>
          <div className="text-center text-muted-foreground">
            لا يوجد عقد بهذا الرقم
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 10mm; }
        }
        .invoice-table {
          border-collapse: collapse;
          width: 100%;
        }
        .invoice-table th,
        .invoice-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: center;
        }
        .invoice-table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
      `}</style>
      <div className="max-w-3xl mx-auto bg-white">
        {/* Header with QR and Company Info */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-black">
          <div className="text-start">
            <h1 className="text-xl font-bold mb-2">
              {branch?.company_name || "مؤسسة عتبة المحلات لتأجير المعدات"}
            </h1>
            <p className="text-sm">ورشة عتبة المحلات لتأجير المعدات</p>
            <p className="text-sm">طريق الملك فهد</p>
            <p className="text-sm">
              السجل التجاري: {branch?.commercial_registration || "1132113781"}
            </p>
            <p className="text-sm">الهاتف: {branch?.phone || "0550819844"}</p>
          </div>
          <div className="">
            <QRCodeSVG
              value={`Rental ID: ${rental.id}`}
              size={80}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Invoice Title and Info */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">فاتورة ضريبية مبسطة - نقداً</h2>
        </div>

        <div className="grid grid-cols-3 gap-1 mb-4 text-sm">
          <div className="text-center">
            <p>
              <span className="font-bold">الرقم:</span>{" "}
              {rental.invoice_number || "00000000"}
            </p>
          </div>
          <div className="text-center" dir="ltr">
            <p>
              <span className="font-bold">التاريخ:</span>{" "}
              {new Date(rental.created_at).toLocaleDateString("ar-EG")}
            </p>
            <p>
              <span className="font-bold">الوقت:</span>{" "}
              {new Date(rental.created_at).toLocaleTimeString("ar-EG")}
            </p>
          </div>
          <div className="mb-4 text-sm text-center">
            <p>
              <span className="font-bold">اسم العميل:</span>{" "}
              {customer?.full_name || rental.customers?.full_name || "-"}
            </p>
          </div>
        </div>

        {/* Customer adderss and phone in table => address(as header in right): *****(as td) | phone: ***** */}
        <div className="mb-4">
          <table className="invoice-table w-full">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>رقم الهاتف</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{customer?.address || rental.customers?.address || "-"}</td>
                <td>{customer?.phone || rental.customers?.phone || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items Table */}
        <table className="invoice-table mb-4">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>الأيام</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {totals.lines.map((ln) => (
              <tr key={ln.id}>
                <td>{ln.name}</td>
                <td>{ln.rate.toFixed(2)} ر.س</td>
                <td>{ln.quantity}</td>
                <td>{ln.days}</td>
                <td>{ln.amount.toFixed(2)} ر.س</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-2 border-black p-4 mb-4">
          <div className="flex justify-between items-center text-lg mb-2">
            <span className="font-bold">المجموع:</span>
            <span className="font-bold">{totals.subtotal.toFixed(2)} ر.س</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between items-center text-lg mb-2">
              <span className="font-bold">الخصم:</span>
              <span className="font-bold">
                {totals.discount.toFixed(2)} ر.س
              </span>
            </div>
          )}
          {totals.deposit > 0 && (
            <div className="flex justify-between items-center text-lg mb-2">
              <span className="font-bold">التأمين:</span>
              <span className="font-bold">{totals.deposit.toFixed(2)} ر.س</span>
            </div>
          )}
          <div className="flex justify-between items-center text-xl border-t-2 border-black pt-2">
            <span className="font-bold">الباقي:</span>
            <span className="font-bold">{totals.total.toFixed(2)} ر.س</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm border-t-2 border-black pt-2">
          <p className="font-bold">نسعد بخدمة عملائنا الكرام</p>
        </div>

        {rental.notes && (
          <div className="mt-4 text-sm">
            <div className="font-bold">ملاحظات:</div>
            <div>{rental.notes}</div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 no-print">
          <Button
            type="button"
            onClick={() => navigate(-1)}
            variant="outline"
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" /> عودة
          </Button>
          <Button onClick={print} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>
    </div>
  );
}
