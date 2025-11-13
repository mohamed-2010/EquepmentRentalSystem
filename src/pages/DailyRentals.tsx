import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllFromLocal } from "@/lib/offline/db";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  Package,
  User,
  DollarSign,
  X,
  Pencil,
  Trash2,
  Printer,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { EquipmentAutocomplete } from "@/components/EquipmentAutocomplete";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineRentals } from "@/hooks/useOfflineRentals";
import { getOfflineUser } from "@/lib/offline/offlineAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as AlertHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RentalEquipment {
  equipmentId: string;
  quantity: number;
  notes: string;
  itemId?: string; // معرف العنصر للتحديث
}

export default function DailyRentals() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const rentalType = "daily"; // إيجارات يومية فقط
  const [isFixedDuration, setIsFixedDuration] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [rentalEquipment, setRentalEquipment] = useState<RentalEquipment[]>([
    { equipmentId: "", quantity: 1, notes: "" },
  ]);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const {
    rentals,
    rentalItems,
    isLoading,
    createRental,
    returnRental,
    returnRentalItem,
    updateRental,
    deleteRental,
    refresh,
  } = useOfflineRentals();

  const { data: userRole } = useQuery({
    queryKey: ["userRole", "offline"],
    queryFn: async () => {
      // أوفلاين: اعتمد فقط على التخزين المحلي
      const cachedRole = localStorage.getItem("user_role");
      if (cachedRole) return JSON.parse(cachedRole);
      const offline = getOfflineUser();
      if (offline && (offline.role || offline.branch_id)) {
        const composed = { role: offline.role, branch_id: offline.branch_id };
        localStorage.setItem("user_role", JSON.stringify(composed));
        return composed as any;
      }
      return null;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", userRole?.role],
    queryFn: async () => {
      if (userRole?.role !== "admin") return [];
      // Offline-only: fetch branches from IndexedDB local store
      const localBranches = await getAllFromLocal("branches");
      return localBranches || [];
    },
    enabled: userRole?.role === "admin",
  });

  const dailyRentals = rentals.filter(
    (r) => r.status === "active" && r.rental_type === "daily"
  );
  const completedDailyRentals = rentals.filter(
    (r) => r.status === "completed" && r.rental_type === "daily"
  );

  // تصفية الإيجارات بناءً على البحث
  const filterRentals = (rentalsList: any[]) => {
    if (!searchQuery.trim()) return rentalsList;

    const query = searchQuery.toLowerCase().trim();
    return rentalsList.filter((rental) => {
      const customerName = rental.customers?.full_name?.toLowerCase() || "";
      const customerPhone = rental.customers?.phone?.toLowerCase() || "";
      const branchName = rental.branches?.name?.toLowerCase() || "";
      const invoiceNumber = rental.invoice_number?.toString() || "";

      return (
        customerName.includes(query) ||
        customerPhone.includes(query) ||
        branchName.includes(query) ||
        invoiceNumber.includes(query)
      );
    });
  };

  const filteredActiveDailyRentals = filterRentals(dailyRentals);
  const filteredCompletedDailyRentals = filterRentals(completedDailyRentals);

  const [editRentalOpen, setEditRentalOpen] = useState<{
    open: boolean;
    rental: any | null;
  }>({ open: false, rental: null });
  const [editRentalValues, setEditRentalValues] = useState({
    is_fixed_duration: true,
    expected_end_date: "",
    notes: "",
    deposit_amount: 0,
    discount_amount: 0,
  });
  const [editEquipment, setEditEquipment] = useState<RentalEquipment[]>([]);

  const openEditRental = (rental: any) => {
    setEditRentalOpen({ open: true, rental });
    setEditRentalValues({
      is_fixed_duration: !!rental.is_fixed_duration,
      expected_end_date: rental.expected_end_date
        ? String(rental.expected_end_date).slice(0, 10)
        : "",
      notes: rental.notes || "",
      deposit_amount: rental.deposit_amount || 0,
      discount_amount: rental.discount_amount || 0,
    });

    // تحميل المعدات الحالية
    const items = getRentalItems(rental.id).filter((i) => !i.return_date);
    setEditEquipment(
      items.map((item) => ({
        equipmentId: item.equipment_id,
        quantity: item.quantity || 1,
        notes: item.notes || "",
        itemId: item.id, // نحفظ ID العنصر للتحديث
      }))
    );
  };

  const handleSaveRentalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRentalOpen.rental) return;
    try {
      // تحديث بيانات الإيجار الأساسية
      await updateRental(editRentalOpen.rental.id, {
        is_fixed_duration: editRentalValues.is_fixed_duration,
        expected_end_date: editRentalValues.is_fixed_duration
          ? editRentalValues.expected_end_date
          : null,
        notes: editRentalValues.notes,
        deposit_amount: editRentalValues.deposit_amount,
        discount_amount: editRentalValues.discount_amount,
      } as any);

      // إضافة المعدات الجديدة (التي ليس لها itemId)
      const { saveToLocal } = await import("@/lib/offline/db");
      const { v4: uuidv4 } = await import("uuid");

      for (const item of editEquipment) {
        if (!item.itemId && item.equipmentId) {
          // هذه معدة جديدة، نحتاج لإضافتها
          const rentalItem = {
            id: uuidv4(),
            rental_id: editRentalOpen.rental.id,
            equipment_id: item.equipmentId,
            start_date: editRentalOpen.rental.start_date,
            quantity: item.quantity || 1,
            notes: item.notes || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            synced: false,
          };

          await saveToLocal("rental_items", rentalItem);
        }
      }

      toast({ title: "تم تحديث عقد الإيجار وإضافة المعدات الجديدة" });
      setEditRentalOpen({ open: false, rental: null });

      // إعادة تحميل البيانات لتحديث قائمة المعدات
      await refresh();
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "تعذر تحديث بيانات الإيجار",
        variant: "destructive",
      });
    }
  };

  const addEditEquipmentRow = () => {
    setEditEquipment([
      ...editEquipment,
      { equipmentId: "", quantity: 1, notes: "" },
    ]);
  };

  const removeEditEquipmentRow = (index: number) => {
    setEditEquipment(editEquipment.filter((_, i) => i !== index));
  };

  const updateEditEquipmentRow = (
    index: number,
    field: keyof RentalEquipment,
    value: any
  ) => {
    const updated = [...editEquipment];
    updated[index] = { ...updated[index], [field]: value };
    setEditEquipment(updated);
  };

  const getRentalItems = (rentalId: string) => {
    return rentalItems.filter((item) => item.rental_id === rentalId);
  };

  const addEquipmentRow = () => {
    setRentalEquipment([
      ...rentalEquipment,
      { equipmentId: "", quantity: 1, notes: "" },
    ]);
  };

  const removeEquipmentRow = (index: number) => {
    setRentalEquipment(rentalEquipment.filter((_, i) => i !== index));
  };

  const updateEquipmentRow = (
    index: number,
    field: keyof RentalEquipment,
    value: any
  ) => {
    const updated = [...rentalEquipment];
    updated[index] = { ...updated[index], [field]: value };
    setRentalEquipment(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedCustomer) {
      toast({
        title: "خطأ",
        description: "يجب اختيار العميل",
        variant: "destructive",
      });
      return;
    }

    const validEquipment = rentalEquipment.filter((e) => e.equipmentId);
    if (validEquipment.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب إضافة معدة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    if (isFixedDuration && !expectedEndDate) {
      toast({
        title: "خطأ",
        description: "يجب تحديد تاريخ الإرجاع المتوقع",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const branchId =
        userRole?.role === "admin" && selectedBranch
          ? selectedBranch
          : userRole?.branch_id;

      if (!branchId) {
        throw new Error("لم يتم تحديد الفرع");
      }

      const newRental = await createRental(
        {
          customer_id: selectedCustomer,
          branch_id: branchId,
          rental_type: "daily",
          status: "active",
          is_fixed_duration: isFixedDuration,
          start_date: startDate,
          expected_end_date: isFixedDuration ? expectedEndDate : undefined,
          deposit_amount: depositAmount,
          discount_amount: discountAmount,
        },
        validEquipment
      );

      // الانتقال مباشرةً لعرض العقد للطباعة باستخدام المعرف المعاد
      if (newRental && newRental.id) {
        setTimeout(() => {
          navigate(`/rentals/${newRental.id}/contract`);
        }, 200);
      }

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء عقد الإيجار بنجاح",
      });

      setIsDialogOpen(false);
      setSelectedCustomer("");
      setSelectedBranch("");
      setIsFixedDuration(true);
      setStartDate(new Date().toISOString().split("T")[0]);
      setExpectedEndDate("");
      setDepositAmount(0);
      setDiscountAmount(0);
      setRentalEquipment([{ equipmentId: "", quantity: 1, notes: "" }]);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل إنشاء عقد الإيجار",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">الإيجارات اليومية</h2>
            <p className="text-muted-foreground">متابعة الإيجارات اليومية</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إيجار يومي جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إيجار يومي جديد</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {userRole?.role === "admin" && (
                  <div className="space-y-2">
                    <Label>الفرع *</Label>
                    <Select
                      value={selectedBranch}
                      onValueChange={setSelectedBranch}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>العميل *</Label>
                  <CustomerAutocomplete
                    value={selectedCustomer}
                    onChange={setSelectedCustomer}
                    onCustomerAdded={() => {
                      console.log("Customer added");
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fixed-duration"
                      checked={isFixedDuration}
                      onCheckedChange={(checked) =>
                        setIsFixedDuration(checked as boolean)
                      }
                    />
                    <Label htmlFor="fixed-duration" className="cursor-pointer">
                      إيجار بمدة محددة
                    </Label>
                  </div>
                </div>

                {isFixedDuration && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">تاريخ البداية *</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">تاريخ الإرجاع المتوقع *</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={expectedEndDate}
                        onChange={(e) => setExpectedEndDate(e.target.value)}
                        min={startDate}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>المعدات *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEquipmentRow}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة معدة
                    </Button>
                  </div>

                  {rentalEquipment.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-2">
                            <Label>المعدة</Label>
                            <EquipmentAutocomplete
                              value={item.equipmentId}
                              onChange={(v) =>
                                updateEquipmentRow(index, "equipmentId", v)
                              }
                            />
                          </div>
                          <div className="w-32 space-y-2">
                            <Label>العدد</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateEquipmentRow(
                                  index,
                                  "quantity",
                                  parseInt(e.target.value) || 1
                                )
                              }
                            />
                          </div>
                          {rentalEquipment.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEquipmentRow(index)}
                              className="mt-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>ملاحظات</Label>
                          <Textarea
                            value={item.notes}
                            onChange={(e) =>
                              updateEquipmentRow(index, "notes", e.target.value)
                            }
                            placeholder="أي ملاحظات على هذه المعدة..."
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* حقل التأمين */}
                <div className="space-y-2 mt-4">
                  <Label htmlFor="deposit_amount">مبلغ التأمين (ريال)</Label>
                  <Input
                    id="deposit_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) =>
                      setDepositAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                  />
                </div>

                {/* حقل الخصم */}
                <div className="space-y-2">
                  <Label htmlFor="discount_amount">الخصم (ريال)</Label>
                  <Input
                    id="discount_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) =>
                      setDiscountAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* حقل البحث */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              placeholder="ابحث بالاسم، رقم الهاتف، الفرع، أو رقم الفاتورة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
            >
              مسح
            </Button>
          )}
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              نشطة ({filteredActiveDailyRentals.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              مكتملة ({filteredCompletedDailyRentals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {filteredActiveDailyRentals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "لا توجد نتائج للبحث"
                    : "لا توجد إيجارات يومية حالياً"}
                </CardContent>
              </Card>
            ) : (
              filteredActiveDailyRentals.map((rental) => {
                const items = getRentalItems(rental.id);
                const activeItems = items.filter((i) => !i.return_date);

                return (
                  <Card key={rental.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {rental.customers?.full_name || "عميل غير معروف"}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {rental.customers?.phone || "-"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">يومي</Badge>
                          <Badge className="gap-1">
                            <Clock className="h-3 w-3" />
                            نشط
                          </Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              navigate(`/rentals/${rental.id}/contract`)
                            }
                            title="طباعة العقد"
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            طباعة العقد
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              navigate(`/rentals/${rental.id}/invoice`)
                            }
                            title="طباعة الفاتورة"
                            className="gap-2"
                          >
                            <Printer className="h-4 w-4" />
                            طباعة فاتورة
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditRental(rental)}
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="حذف">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertHeader>
                                <AlertDialogTitle>
                                  تأكيد حذف عقد الإيجار
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذا العقد وجميع عناصره المرتبطة.
                                </AlertDialogDescription>
                              </AlertHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    await deleteRental(rental.id);
                                    toast({ title: "تم حذف العقد" });
                                  }}
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            بداية الإيجار:{" "}
                            {format(new Date(rental.start_date), "PPP", {
                              locale: ar,
                            })}
                          </span>
                        </div>
                        {rental.is_fixed_duration &&
                          rental.expected_end_date && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>
                                الإرجاع المتوقع:{" "}
                                {format(
                                  new Date(rental.expected_end_date),
                                  "PPP",
                                  {
                                    locale: ar,
                                  }
                                )}
                              </span>
                              {new Date(rental.expected_end_date) <
                                new Date() && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  متأخر
                                </Badge>
                              )}
                            </div>
                          )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">المعدات النشطة:</Label>
                        {activeItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {item.equipment?.name || "معدة غير معروفة"}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  ({item.equipment?.code || "-"})
                                </span>
                                {item.quantity && item.quantity > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    × {item.quantity}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <DollarSign className="h-3 w-3" />
                                <span>
                                  الكمية: {item.quantity || 1} | السعر:{" "}
                                  {item.equipment?.daily_rate || 0} ريال/يوم
                                </span>
                              </div>
                              {item.notes && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const returnDate = new Date()
                                  .toISOString()
                                  .split("T")[0];
                                await returnRentalItem(item.id, returnDate);
                                toast({
                                  title: "تم الإرجاع",
                                  description: "تم إرجاع المعدة بنجاح",
                                });
                              }}
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              إرجاع
                            </Button>
                          </div>
                        ))}
                      </div>

                      {userRole?.role === "admin" && rental.branches && (
                        <Badge variant="outline">
                          {rental.branches?.name || "-"}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {filteredCompletedDailyRentals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "لا توجد نتائج للبحث"
                    : "لا توجد إيجارات مكتملة"}
                </CardContent>
              </Card>
            ) : (
              filteredCompletedDailyRentals.map((rental) => {
                const items = getRentalItems(rental.id);

                return (
                  <Card key={rental.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {rental.customers?.full_name || "عميل غير معروف"}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {rental.customers?.phone || "-"}
                          </p>
                        </div>
                        <Badge variant="secondary">مكتمل</Badge>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              navigate(`/rentals/${rental.id}/contract`)
                            }
                            title="طباعة العقد"
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            طباعة العقد
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              navigate(`/rentals/${rental.id}/invoice`)
                            }
                            title="طباعة الفاتورة"
                            className="gap-2"
                          >
                            <Printer className="h-4 w-4" />
                            طباعة فاتورة
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            بداية الإيجار:{" "}
                            {format(new Date(rental.start_date), "PPP", {
                              locale: ar,
                            })}
                          </span>
                        </div>
                        {rental.end_date && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>
                              تاريخ الإرجاع:{" "}
                              {format(new Date(rental.end_date), "PPP", {
                                locale: ar,
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">المعدات:</Label>
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {item.equipment?.name || "معدة غير معروفة"}
                                </span>
                                {item.quantity && item.quantity > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    × {item.quantity}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Rental Dialog */}
      <Dialog
        open={editRentalOpen.open}
        onOpenChange={(open) =>
          setEditRentalOpen({
            open,
            rental: open ? editRentalOpen.rental : null,
          })
        }
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الإيجار</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRentalEdit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="e-fixed"
                  checked={editRentalValues.is_fixed_duration}
                  onCheckedChange={(checked) =>
                    setEditRentalValues((v) => ({
                      ...v,
                      is_fixed_duration: !!checked,
                    }))
                  }
                />
                <Label htmlFor="e-fixed">إيجار بمدة محددة</Label>
              </div>
            </div>
            {editRentalValues.is_fixed_duration && (
              <div className="space-y-2">
                <Label htmlFor="e-expected">تاريخ الإرجاع المتوقع</Label>
                <Input
                  id="e-expected"
                  type="date"
                  value={editRentalValues.expected_end_date}
                  onChange={(e) =>
                    setEditRentalValues((v) => ({
                      ...v,
                      expected_end_date: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="e-notes">ملاحظات العقد</Label>
              <Textarea
                id="e-notes"
                value={editRentalValues.notes}
                onChange={(e) =>
                  setEditRentalValues((v) => ({ ...v, notes: e.target.value }))
                }
                rows={3}
              />
            </div>

            {/* حقل مبلغ التأمين */}
            <div className="space-y-2">
              <Label htmlFor="e-deposit">مبلغ التأمين (ريال)</Label>
              <Input
                id="e-deposit"
                type="number"
                min="0"
                step="0.01"
                value={editRentalValues.deposit_amount}
                onChange={(e) =>
                  setEditRentalValues((v) => ({
                    ...v,
                    deposit_amount: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>

            {/* حقل الخصم */}
            <div className="space-y-2">
              <Label htmlFor="e-discount">الخصم (ريال)</Label>
              <Input
                id="e-discount"
                type="number"
                min="0"
                step="0.01"
                value={editRentalValues.discount_amount}
                onChange={(e) =>
                  setEditRentalValues((v) => ({
                    ...v,
                    discount_amount: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0"
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <Label>المعدات النشطة</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEditEquipmentRow}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  إضافة معدة
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                يمكنك إضافة معدات جديدة للإيجار. لحذف معدة، استخدم زر "إرجاع" من
                الصفحة الرئيسية.
              </p>

              {editEquipment.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Label>المعدة</Label>
                        <EquipmentAutocomplete
                          value={item.equipmentId}
                          onChange={(v) =>
                            updateEditEquipmentRow(index, "equipmentId", v)
                          }
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label>العدد</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateEditEquipmentRow(
                              index,
                              "quantity",
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                      </div>
                      {!item.itemId && editEquipment.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEditEquipmentRow(index)}
                          className="mt-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>ملاحظات المعدة</Label>
                      <Textarea
                        value={item.notes}
                        onChange={(e) =>
                          updateEditEquipmentRow(index, "notes", e.target.value)
                        }
                        placeholder="أي ملاحظات على هذه المعدة..."
                        rows={2}
                      />
                    </div>
                    {item.itemId && (
                      <p className="text-xs text-muted-foreground">
                        معدة موجودة - استخدم زر "إرجاع" لإزالتها
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditRentalOpen({ open: false, rental: null })}
              >
                إلغاء
              </Button>
              <Button type="submit">حفظ التعديلات</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
