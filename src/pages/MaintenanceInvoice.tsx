import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { offlineDb } from "@/lib/offline/db";

interface MaintenanceItem {
  id?: string;
  equipmentId: string;
  description: string;
  cost: number;
  notes?: string;
}

interface Maintenance {
  id: string;
  customer_id: string;
  date: string;
  total_cost: number;
  notes?: string;
  items: MaintenanceItem[];
  status: "pending" | "in_progress" | "completed";
  created_at: string;
}

export default function MaintenanceInvoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [branch, setBranch] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      // نحاول قراءة البيانات من sessionStorage أولاً
      const tempData = sessionStorage.getItem("temp_maintenance_invoice");
      if (tempData) {
        const maintenanceRecord = JSON.parse(tempData);
        sessionStorage.removeItem("temp_maintenance_invoice"); // حذف بعد القراءة

        setMaintenance(maintenanceRecord);

        // تحميل بيانات العميل والمعدات والفرع
        const [customerData, equipmentData, branches] = await Promise.all([
          offlineDb.getAllCustomers(),
          offlineDb.getAllEquipment(),
          offlineDb.getAllBranches(),
        ]);

        const cust = customerData?.find(
          (c: any) => c.id === maintenanceRecord.customer_id
        );
        setCustomer(cust);
        setEquipment(equipmentData || []);

        if (branches && branches.length > 0) {
          setBranch(branches[0]);
        }
        return;
      }

      // إذا لم نجد في sessionStorage، نحاول IndexedDB
      try {
        const [
          maintenanceData,
          allMaintenance,
          customerData,
          equipmentData,
          branches,
        ] = await Promise.all([
          offlineDb.getMaintenance(id).catch(() => null),
          offlineDb.getAllMaintenance().catch(() => []),
          offlineDb.getAllCustomers(),
          offlineDb.getAllEquipment(),
          offlineDb.getAllBranches(),
        ]);

        const maintenanceRecord =
          maintenanceData || allMaintenance?.find((m: any) => m.id === id);

        if (maintenanceRecord) {
          setMaintenance(maintenanceRecord);
          const cust = customerData?.find(
            (c: any) => c.id === maintenanceRecord.customer_id
          );
          setCustomer(cust);
        }

        setEquipment(equipmentData || []);
        if (branches && branches.length > 0) {
          setBranch(branches[0]);
        }
      } catch (dbError) {
        console.error("Error accessing IndexedDB:", dbError);
        // إذا فشل الوصول لـ IndexedDB، نحاول تحميل البيانات الأساسية فقط
        const [customerData, equipmentData, branches] = await Promise.all([
          offlineDb.getAllCustomers().catch(() => []),
          offlineDb.getAllEquipment().catch(() => []),
          offlineDb.getAllBranches().catch(() => []),
        ]);

        setEquipment(equipmentData || []);
        if (branches && branches.length > 0) {
          setBranch(branches[0]);
        }
      }
    } catch (error) {
      console.error("Error loading maintenance data:", error);
    }
  };

  const print = () => {
    window.print();
  };

  if (!maintenance) {
    return (
      <div className="p-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const total = maintenance.total_cost;

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
          <div className="">
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
              value={`Maintenance ID: ${maintenance.id}`}
              size={80}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Invoice Title and Info */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">فاتورة صيانة - نقداً</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p>
              <span className="font-bold">الرقم:</span>{" "}
              {maintenance.id?.replace(/\D/g, "").slice(-8) || "00000000"}
            </p>
          </div>
          <div className="text-left" dir="ltr">
            <p>
              <span className="font-bold">التاريخ:</span>{" "}
              {new Date(maintenance.date).toLocaleDateString("ar-EG")}
            </p>
            <p>
              <span className="font-bold">الوقت:</span>{" "}
              {new Date(maintenance.date).toLocaleTimeString("ar-EG")}
            </p>
          </div>
        </div>

        <div className="mb-4 text-sm">
          <p>
            <span className="font-bold">اسم العميل:</span>{" "}
            {customer?.full_name || "-"}
          </p>
          <p>
            <span className="font-bold">رقم الهاتف:</span>{" "}
            {customer?.phone || "-"}
          </p>
        </div>

        {/* Items Table */}
        <table className="invoice-table mb-4">
          <thead>
            <tr>
              <th>المعدة</th>
              <th>الوصف</th>
              <th>التكلفة</th>
            </tr>
          </thead>
          <tbody>
            {maintenance.items.map((item) => {
              const eq = equipment.find((e) => e.id === item.equipmentId);
              return (
                <tr key={item.id}>
                  <td>{eq?.name || "غير معروف"}</td>
                  <td className="text-right">{item.description}</td>
                  <td>{item.cost.toFixed(2)} ر.س</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-2 border-black p-4 mb-4">
          <div className="flex justify-between items-center text-xl border-t-2 border-black pt-2">
            <span className="font-bold">الإجمالي:</span>
            <span className="font-bold">{total.toFixed(2)} ر.س</span>
          </div>
        </div>

        {maintenance.notes && (
          <div className="mb-4 text-sm">
            <p className="font-bold">ملاحظات:</p>
            <p>{maintenance.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm border-t-2 border-black pt-2">
          <p className="font-bold">نسعد بخدمة عملائنا الكرام</p>
        </div>

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
