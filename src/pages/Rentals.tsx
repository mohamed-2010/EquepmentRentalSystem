import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
// Offline-only: Supabase removed
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
import { getAllFromLocal } from "@/lib/offline/db";
import { useOfflineRentals } from "@/hooks/useOfflineRentals";
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
}

export default function Rentals() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [rentalType, setRentalType] = useState<"daily" | "monthly">("daily");
  const [isFixedDuration, setIsFixedDuration] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [rentalEquipment, setRentalEquipment] = useState<RentalEquipment[]>([
    { equipmentId: "", quantity: 1, notes: "" },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // استخدام الـ hook الجديد
  const {
    rentals,
    rentalItems,
    isLoading,
    createRental,
    returnRental,
    returnRentalItem,
    updateRental,
    deleteRental,
  } = useOfflineRentals();

  const { data: userRole } = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      // أوفلاين: قراءة الدور من التخزين المحلي
      const cachedRole = localStorage.getItem("user_role");
      if (cachedRole) {
        try {
          return JSON.parse(cachedRole);
        } catch {
          return {
            role: cachedRole,
            branch_id: localStorage.getItem("user_branch_id"),
          };
        }
      }
      return null;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // تحميل قائمة الفروع (للأدمن فقط)
  const { data: branches } = useQuery({
    queryKey: ["branches", userRole?.role],
    queryFn: async () => {
      if (userRole?.role !== "admin") return [] as any[];
      const data = await getAllFromLocal("branches" as any);
      return (data || []) as any[];
    },
    enabled: userRole?.role === "admin",
    staleTime: Infinity,
  });

  const handleCreateRental = async () => {
    // منع الضغط المتكرر
    if (isSubmitting) {
      console.log("[Rentals] Already submitting, ignoring duplicate request");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("[Rentals] Starting rental creation");

      // الحصول على بيانات المستخدم من التخزين المحلي (أوفلاين)
      const offlineUserRaw = localStorage.getItem("offline.user");
      const user = offlineUserRaw ? JSON.parse(offlineUserRaw) : null;

      if (!user) throw new Error("غير مسجل الدخول");

      console.log("[Rentals] Loaded user role:", userRole);

      // تحديد الفرع:
      // - إذا كان أدمن واختار فرع، استخدم المحدد
      // - إذا لم يكن أدمن، استخدم فرع المستخدم
      let branch_id;
      if (userRole?.role === "admin") {
        if (!selectedBranch) {
          throw new Error("يرجى اختيار الفرع");
        }
        branch_id = selectedBranch;
      } else {
        branch_id =
          userRole?.branch_id || localStorage.getItem("user_branch_id");
        if (!branch_id) throw new Error("لم يتم تعيين فرع للمستخدم");
      }

      // التحقق من تاريخ النهاية إذا كان الإيجار بمدة محددة
      if (isFixedDuration && !expectedEndDate) {
        throw new Error("يرجى تحديد تاريخ الإرجاع المتوقع");
      }

      // بيانات الإيجار
      const rentalData = {
        customer_id: selectedCustomer,
        equipment_id: rentalEquipment[0].equipmentId,
        branch_id,
        created_by: user.id,
        start_date: startDate,
        status: "active",
        rental_type: rentalType,
        is_fixed_duration: isFixedDuration,
        expected_end_date: isFixedDuration ? expectedEndDate : null,
      };

      // عناصر الإيجار
      const equipmentItems = rentalEquipment
        .filter((item) => item.equipmentId)
        .map((item) => ({
          equipment_id: item.equipmentId,
          start_date: startDate,
          quantity: item.quantity,
          notes: item.notes,
        }));

      // استخدام الـ hook لإنشاء الإيجار
      const newRental = await createRental(rentalData, equipmentItems);

      // إعادة تعيين النموذج
      setIsDialogOpen(false);
      setSelectedCustomer("");
      setRentalEquipment([{ equipmentId: "", quantity: 1, notes: "" }]);
      setRentalType("daily");
      setIsFixedDuration(true);
      setStartDate(new Date().toISOString().split("T")[0]);
      setExpectedEndDate("");

      toast({ title: "تم بنجاح", description: "تم تسجيل الإيجار بنجاح" });

      // فتح صفحة العقد للطباعة بعد التأكد من حفظ البيانات
      if (newRental && newRental.id) {
        setTimeout(() => {
          navigate(`/rentals/${newRental.id}/contract`);
        }, 1000);
      }
    } catch (error: any) {
      console.error("[Rentals] Error:", error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تسجيل الإيجار",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addEquipmentRow = () => {
    setRentalEquipment([
      ...rentalEquipment,
      { equipmentId: "", quantity: 1, notes: "" },
    ]);
  };

  const removeEquipmentRow = (index: number) => {
    if (rentalEquipment.length > 1) {
      setRentalEquipment(rentalEquipment.filter((_, i) => i !== index));
    }
  };

  const updateEquipmentRow = (
    index: number,
    field: keyof RentalEquipment,
    value: string | number
  ) => {
    const updated = [...rentalEquipment];
    updated[index] = { ...updated[index], [field]: value };
    setRentalEquipment(updated);
  };

  const getRentalItems = (rentalId: string) => {
    return rentalItems?.filter((item) => item.rental_id === rentalId) || [];
  };

  const activeRentals = rentals?.filter((r) => 1) || [];
  const completedRentals = rentals?.filter((r) => 1) || [];
  const dailyRentals = activeRentals.filter((r) => r.rental_type === "daily");
  const monthlyRentals = activeRentals.filter(
    (r) => r.rental_type === "monthly"
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
      const rentalType = rental.rental_type?.toLowerCase() || "";

      return (
        customerName.includes(query) ||
        customerPhone.includes(query) ||
        branchName.includes(query) ||
        invoiceNumber.includes(query) ||
        rentalType.includes(query)
      );
    });
  };

  const filteredDailyRentals = filterRentals(dailyRentals);
  const filteredMonthlyRentals = filterRentals(monthlyRentals);
  const filteredActiveRentals = filterRentals(activeRentals);
  const filteredCompletedRentals = filterRentals(completedRentals);

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
  };

  const handleSaveRentalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRentalOpen.rental) return;
    try {
      await updateRental(editRentalOpen.rental.id, {
        is_fixed_duration: editRentalValues.is_fixed_duration,
        expected_end_date: editRentalValues.is_fixed_duration
          ? editRentalValues.expected_end_date
          : null,
        notes: editRentalValues.notes,
        deposit_amount: editRentalValues.deposit_amount,
        discount_amount: editRentalValues.discount_amount,
      } as any);
      toast({ title: "تم تحديث عقد الإيجار" });
      setEditRentalOpen({ open: false, rental: null });
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "تعذر تحديث بيانات الإيجار",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">الإيجارات</h2>
            <p className="text-muted-foreground">
              متابعة عمليات الإيجار والإرجاع
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إيجار جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>عقد إيجار جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* اختيار الفرع - للأدمن فقط */}
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
                      // Refresh customers list
                      console.log("Customer added");
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>نوع الإيجار *</Label>
                  <Select
                    value={rentalType}
                    onValueChange={(v: any) => setRentalType(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="monthly">شهري (خاص)</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <p className="text-sm text-muted-foreground pr-6">
                    حدد هذا الخيار إذا كان الإيجار لمدة محددة مع تاريخ إرجاع
                    متوقع
                  </p>
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
                              placeholder="1"
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
                          <Label>ملاحظات على المعدة</Label>
                          <Textarea
                            value={item.notes}
                            onChange={(e) =>
                              updateEquipmentRow(index, "notes", e.target.value)
                            }
                            placeholder="حالة المعدة، ملاحظات خاصة..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleCreateRental}
                    disabled={
                      isSubmitting ||
                      !selectedCustomer ||
                      (userRole?.role === "admin" && !selectedBranch) ||
                      rentalEquipment.every((e) => !e.equipmentId) ||
                      (isFixedDuration && !expectedEndDate)
                    }
                  >
                    {isSubmitting ? "جاري الحفظ..." : "تأكيد وطباعة العقد"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* حقل البحث */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              placeholder="ابحث بالاسم، رقم الهاتف، الفرع، نوع الإيجار، أو رقم الفاتورة..."
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

        <Tabs defaultValue="daily" dir="rtl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">
              الإيجارات اليومية ({filteredDailyRentals.length})
            </TabsTrigger>
            <TabsTrigger value="monthly">
              الشهرية (خاص) ({filteredMonthlyRentals.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              الإيجارات المنتهية ({filteredCompletedRentals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            {filteredDailyRentals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "لا توجد نتائج للبحث"
                    : "لا توجد إيجارات يومية حالياً"}
                </CardContent>
              </Card>
            ) : (
              filteredDailyRentals.map((rental) => {
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
                          {/* Edit / Delete actions */}
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
                            بدأ في:{" "}
                            {format(
                              new Date(rental.start_date),
                              "dd MMMM yyyy",
                              { locale: ar }
                            )}
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
                                  "dd MMMM yyyy",
                                  { locale: ar }
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

          <TabsContent value="monthly" className="space-y-4">
            {filteredMonthlyRentals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "لا توجد نتائج للبحث"
                    : "لا توجد إيجارات شهرية (خاص) حالياً"}
                </CardContent>
              </Card>
            ) : (
              filteredMonthlyRentals.map((rental) => {
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
                          <Badge variant="outline">شهري (خاص)</Badge>
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
                          {/* Edit / Delete actions */}
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
                            بدأ في:{" "}
                            {format(
                              new Date(rental.start_date),
                              "dd MMMM yyyy",
                              { locale: ar }
                            )}
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
                                  "dd MMMM yyyy",
                                  { locale: ar }
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
                                  {item.equipment?.daily_rate || 0} ريال/شهر
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

          {/* <TabsContent value="completed" className="space-y-4">
            {activeRentals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  لا توجد إيجارات جارية حالياً
                </CardContent>
              </Card>
            ) : (
              activeRentals.map((rental) => {
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
                          <Badge variant="outline">
                            {rental.rental_type === "daily" ? "يومي" : "شهري"}
                          </Badge>
                          <Badge className="gap-1">
                            <Clock className="h-3 w-3" />
                            نشط
                          </Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/rentals/${rental.id}/contract`)}
                            title="طباعة العقد"
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            طباعة العقد
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigate(`/rentals/${rental.id}/invoice`)}
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
                            بدأ في:{" "}
                            {format(
                              new Date(rental.start_date),
                              "dd MMMM yyyy",
                              { locale: ar }
                            )}
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
                                  "dd MMMM yyyy",
                                  { locale: ar }
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
                                  {item.equipment?.daily_rate || 0} ريال/
                                  {rental.rental_type === "daily"
                                    ? "يوم"
                                    : "شهر"}
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
          </TabsContent> */}

          <TabsContent value="completed" className="space-y-4">
            {filteredCompletedRentals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "لا توجد نتائج للبحث"
                    : "لا توجد إيجارات منتهية بعد"}
                </CardContent>
              </Card>
            ) : (
              filteredCompletedRentals.map((rental) => {
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
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {rental.rental_type === "daily" ? "يومي" : "شهري"}
                          </Badge>
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            منتهي
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/rentals/${rental.id}/contract`)
                            }
                            title="عرض العقد"
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            العقد
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
                            فاتورة
                          </Button>
                          {/* Delete action for completed rental */}
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
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">من:</span>{" "}
                          {format(new Date(rental.start_date), "dd/MM/yyyy")}
                        </div>
                        <div>
                          <span className="text-muted-foreground">إلى:</span>{" "}
                          {rental.end_date &&
                            format(new Date(rental.end_date), "dd/MM/yyyy")}
                        </div>
                      </div>
                      {rental.is_fixed_duration && rental.expected_end_date && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            الإرجاع المتوقع كان:
                          </span>{" "}
                          {format(
                            new Date(rental.expected_end_date),
                            "dd/MM/yyyy"
                          )}
                          {rental.end_date &&
                            new Date(rental.end_date) >
                              new Date(rental.expected_end_date) && (
                              <Badge variant="outline" className="mr-2 text-xs">
                                تأخر في الإرجاع
                              </Badge>
                            )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm">المعدات:</Label>
                        {items.map((item) => (
                          <div key={item.id} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
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
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                الكمية: {item.quantity || 1} | المدة:{" "}
                                {item.days_count}{" "}
                                {rental.rental_type === "daily" ? "يوم" : "شهر"}
                              </span>
                              <span className="font-bold text-primary">
                                {(
                                  (item.equipment?.daily_rate || 0) *
                                  (item.days_count || 0) *
                                  (item.quantity || 1)
                                ).toFixed(2)}{" "}
                                ريال
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">
                          الإجمالي:
                        </span>
                        <span className="text-2xl font-bold text-primary">
                          {items
                            .reduce((sum, item) => {
                              const amount =
                                (item.equipment?.daily_rate || 0) *
                                (item.days_count || 0) *
                                (item.quantity || 1);
                              return sum + amount;
                            }, 0)
                            .toFixed(2)}{" "}
                          ريال
                        </span>
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
        <DialogContent className="max-w-md">
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
              <Label htmlFor="e-notes">ملاحظات</Label>
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

            <div className="flex gap-2 justify-end">
              <Button type="submit">حفظ</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
