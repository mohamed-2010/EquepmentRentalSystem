import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { EquipmentAutocomplete } from "@/components/EquipmentAutocomplete";
import { useToast } from "@/hooks/use-toast";
import { offlineDb } from "@/lib/offline/db";
import { Plus, Trash2, FileText, Search, Pencil } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

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

export default function MaintenanceRecords() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [maintenanceList, setMaintenanceList] = useState<Maintenance[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });

  // Dialog states
  const [dialog, setDialog] = useState<{
    open: boolean;
    maintenance: Maintenance | null;
  }>({ open: false, maintenance: null });

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<MaintenanceItem[]>([
    { equipmentId: "", description: "", cost: 0, notes: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"pending" | "in_progress" | "completed">(
    "completed"
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [maintenanceData, customerData, equipmentData] = await Promise.all([
        offlineDb.getAllMaintenance(),
        offlineDb.getAllCustomers(),
        offlineDb.getAllEquipment(),
      ]);
      setMaintenanceList(maintenanceData || []);
      setCustomers(customerData || []);
      setEquipment(equipmentData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "خطأ",
        description: "فشل تحميل البيانات",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار العميل",
        variant: "destructive",
      });
      return;
    }

    const validItems = items.filter(
      (item) => item.equipmentId && item.description && item.cost > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى إضافة عنصر صيانة واحد على الأقل",
        variant: "destructive",
      });
      return;
    }

    const totalCost = validItems.reduce((sum, item) => sum + item.cost, 0);

    try {
      const maintenanceData: Maintenance = {
        id: dialog.maintenance?.id || uuidv4(),
        customer_id: customerId,
        date: new Date().toISOString(),
        total_cost: totalCost,
        notes,
        items: validItems.map((item) => ({
          ...item,
          id: item.id || uuidv4(),
        })),
        status,
        created_at: dialog.maintenance?.created_at || new Date().toISOString(),
      };

      await offlineDb.saveMaintenance(maintenanceData);
      await loadData();

      toast({
        title: "نجح",
        description: dialog.maintenance
          ? "تم تحديث سجل الصيانة بنجاح"
          : "تم إضافة سجل الصيانة بنجاح",
      });

      resetForm();
    } catch (error) {
      console.error("Error saving maintenance:", error);
      toast({
        title: "خطأ",
        description: "فشل حفظ سجل الصيانة",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (maintenance: Maintenance) => {
    setCustomerId(maintenance.customer_id);
    setItems(maintenance.items);
    setNotes(maintenance.notes || "");
    setStatus(maintenance.status);
    setDialog({ open: true, maintenance });
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      await offlineDb.deleteMaintenance(deleteDialog.id);
      await loadData();
      toast({
        title: "نجح",
        description: "تم حذف سجل الصيانة بنجاح",
      });
    } catch (error) {
      console.error("Error deleting maintenance:", error);
      toast({
        title: "خطأ",
        description: "فشل حذف سجل الصيانة",
        variant: "destructive",
      });
    } finally {
      setDeleteDialog({ open: false, id: null });
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setItems([{ equipmentId: "", description: "", cost: 0, notes: "" }]);
    setNotes("");
    setStatus("completed");
    setDialog({ open: false, maintenance: null });
  };

  const addItem = () => {
    setItems([
      ...items,
      { equipmentId: "", description: "", cost: 0, notes: "" },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof MaintenanceItem,
    value: any
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const filteredMaintenance = maintenanceList.filter((m) => {
    const customer = customers.find((c) => c.id === m.customer_id);
    const customerName = customer?.full_name || "";
    return customerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "قيد الانتظار";
      case "in_progress":
        return "جاري العمل";
      case "completed":
        return "مكتمل";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">فواتير الصيانة</h1>
          <Button onClick={() => setDialog({ open: true, maintenance: null })}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة فاتورة صيانة
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="البحث عن عميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredMaintenance.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              لا توجد فواتير صيانة
            </Card>
          ) : (
            filteredMaintenance.map((maintenance) => {
              const customer = customers.find(
                (c) => c.id === maintenance.customer_id
              );
              return (
                <Card key={maintenance.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">
                          {customer?.full_name || "غير معروف"}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            maintenance.status
                          )}`}
                        >
                          {getStatusLabel(maintenance.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        التاريخ:{" "}
                        {new Date(maintenance.date).toLocaleDateString("ar-EG")}
                      </p>
                      <div className="mb-2">
                        <p className="text-sm font-medium">عناصر الصيانة:</p>
                        {maintenance.items.map((item, index) => {
                          const eq = equipment.find(
                            (e) => e.id === item.equipmentId
                          );
                          return (
                            <div
                              key={index}
                              className="text-sm text-muted-foreground mr-4"
                            >
                              • {eq?.name || "غير معروف"} - {item.description} (
                              {item.cost.toFixed(2)} ر.س)
                            </div>
                          );
                        })}
                      </div>
                      {maintenance.notes && (
                        <p className="text-sm text-muted-foreground">
                          ملاحظات: {maintenance.notes}
                        </p>
                      )}
                      <p className="text-lg font-bold mt-2">
                        الإجمالي: {maintenance.total_cost.toFixed(2)} ر.س
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/maintenance-invoice/${maintenance.id}`)
                        }
                        title="عرض الفاتورة"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(maintenance)}
                        title="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setDeleteDialog({ open: true, id: maintenance.id })
                        }
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog
          open={dialog.open}
          onOpenChange={(open) => !open && resetForm()}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {dialog.maintenance
                  ? "تعديل فاتورة الصيانة"
                  : "إضافة فاتورة صيانة جديدة"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>العميل *</Label>
                <CustomerAutocomplete
                  value={customerId}
                  onChange={setCustomerId}
                  onCustomerAdded={() => loadData()}
                />
              </div>

              <div className="space-y-2">
                <Label>الحالة</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="in_progress">جاري العمل</option>
                  <option value="completed">مكتمل</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>عناصر الصيانة *</Label>
                  <Button type="button" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة عنصر
                  </Button>
                </div>
                {items.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>المعدة</Label>
                        <EquipmentAutocomplete
                          value={item.equipmentId}
                          onChange={(value) =>
                            updateItem(index, "equipmentId", value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>التكلفة (ر.س)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.cost}
                          onChange={(e) =>
                            updateItem(
                              index,
                              "cost",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>الوصف</Label>
                        <Textarea
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, "description", e.target.value)
                          }
                          placeholder="وصف عملية الصيانة"
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                          value={item.notes || ""}
                          onChange={(e) =>
                            updateItem(index, "notes", e.target.value)
                          }
                          placeholder="ملاحظات إضافية"
                        />
                      </div>
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                        className="mt-2"
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        حذف العنصر
                      </Button>
                    )}
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Label>ملاحظات عامة</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية عن الصيانة"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
                <Button type="submit">
                  {dialog.maintenance ? "تحديث" : "حفظ"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog
          open={deleteDialog.open}
          onOpenChange={(open) =>
            !open && setDeleteDialog({ open: false, id: null })
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف فاتورة الصيانة؟ لا يمكن التراجع عن هذا
                الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>حذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
