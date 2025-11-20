import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign,
  User,
  Package,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { EquipmentAutocomplete } from "@/components/EquipmentAutocomplete";
import { useOfflineMaintenance } from "@/hooks/useOfflineMaintenance";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Maintenance() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const {
    maintenanceRequests,
    isLoading,
    createMaintenanceRequest,
    updateMaintenanceRequest,
  } = useOfflineMaintenance();

  const handleCreate = async () => {
    try {
      if (!selectedCustomer || !description) {
        toast({
          title: "خطأ",
          description: "يرجى ملء جميع الحقول المطلوبة",
          variant: "destructive",
        });
        return;
      }

      await createMaintenanceRequest({
        customer_id: selectedCustomer,
        equipment_id: selectedEquipment || null,
        request_date: requestDate,
        description,
        cost: parseFloat(cost) || 0,
        status: "pending",
      });

      setIsDialogOpen(false);
      setSelectedCustomer("");
      setSelectedEquipment("");
      setDescription("");
      setCost("");
      setRequestDate(new Date().toISOString().split("T")[0]);

      toast({
        title: "تم بنجاح",
        description: isOnline
          ? "تم تسجيل طلب الصيانة"
          : "تم التسجيل محلياً. سيتم المزامنة عند عودة الاتصال.",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء التسجيل",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === "completed") {
        updates.completed_date = new Date().toISOString().split("T")[0];
      }
      await updateMaintenanceRequest(id, updates);
      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة الطلب",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء التحديث",
        variant: "destructive",
      });
    }
  };

  const pendingRequests =
    maintenanceRequests?.filter((r) => r.status === "pending") || [];
  const inProgressRequests =
    maintenanceRequests?.filter((r) => r.status === "in_progress") || [];
  const completedRequests =
    maintenanceRequests?.filter((r) => r.status === "completed") || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">الصيانة</h2>
            <p className="text-muted-foreground">إدارة طلبات صيانة المعدات</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                طلب صيانة جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>طلب صيانة جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>العميل *</Label>
                  <CustomerAutocomplete
                    value={selectedCustomer}
                    onChange={setSelectedCustomer}
                  />
                </div>

                <div className="space-y-2">
                  <Label>المعدة (اختياري)</Label>
                  <EquipmentAutocomplete
                    value={selectedEquipment}
                    onChange={setSelectedEquipment}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-date">تاريخ الطلب *</Label>
                  <Input
                    id="request-date"
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">وصف المشكلة *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="اكتب وصف المشكلة أو نوع الصيانة المطلوبة..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">التكلفة (ريال)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!selectedCustomer || !description}
                  >
                    حفظ
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="pending" dir="rtl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              قيد الانتظار ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              جاري التنفيذ ({inProgressRequests.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              مكتمل ({completedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  لا توجد طلبات قيد الانتظار
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {request.customers?.full_name || "عميل غير معروف"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {request.customers?.phone || "-"}
                        </p>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        قيد الانتظار
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          تاريخ الطلب:{" "}
                          {format(
                            new Date(request.request_date),
                            "dd MMMM yyyy",
                            { locale: ar }
                          )}
                        </span>
                      </div>
                      {request.equipment_id && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>
                            المعدة: {request.equipment?.name || "غير محدد"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>التكلفة: {request.cost || 0} ريال</span>
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">وصف المشكلة:</p>
                      <p className="text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          handleUpdateStatus(request.id, "in_progress")
                        }
                        className="gap-2"
                      >
                        <Wrench className="h-4 w-4" />
                        بدء التنفيذ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleUpdateStatus(request.id, "cancelled")
                        }
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        إلغاء
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="in_progress" className="space-y-4">
            {inProgressRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  لا توجد طلبات جاري تنفيذها
                </CardContent>
              </Card>
            ) : (
              inProgressRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {request.customers?.full_name || "عميل غير معروف"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {request.customers?.phone || "-"}
                        </p>
                      </div>
                      <Badge className="gap-1">
                        <Wrench className="h-3 w-3" />
                        جاري التنفيذ
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          تاريخ الطلب:{" "}
                          {format(
                            new Date(request.request_date),
                            "dd MMMM yyyy",
                            { locale: ar }
                          )}
                        </span>
                      </div>
                      {request.equipment_id && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>
                            المعدة: {request.equipment?.name || "غير محدد"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>التكلفة: {request.cost || 0} ريال</span>
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">وصف المشكلة:</p>
                      <p className="text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() =>
                        handleUpdateStatus(request.id, "completed")
                      }
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      إكمال الصيانة
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  لا توجد طلبات مكتملة بعد
                </CardContent>
              </Card>
            ) : (
              completedRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {request.customers?.full_name || "عميل غير معروف"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {request.customers?.phone || "-"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        مكتمل
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          تاريخ الطلب:
                        </span>{" "}
                        {format(new Date(request.request_date), "dd/MM/yyyy")}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          تاريخ الإكمال:
                        </span>{" "}
                        {request.completed_date
                          ? format(
                              new Date(request.completed_date),
                              "dd/MM/yyyy"
                            )
                          : "-"}
                      </div>
                    </div>

                    {request.equipment_id && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>
                          المعدة: {request.equipment?.name || "غير محدد"}
                        </span>
                      </div>
                    )}

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">وصف المشكلة:</p>
                      <p className="text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">
                        التكلفة:
                      </span>
                      <span className="text-xl font-bold text-primary">
                        {request.cost || 0} ريال
                      </span>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button
                        size="sm"
                        onClick={() => {
                          // حفظ بيانات الفاتورة للطباعة
                          const maintenanceData = {
                            id: request.id,
                            customer_id: request.customer_id,
                            date:
                              request.completed_date || request.request_date,
                            total_cost: request.cost || 0,
                            notes: request.description,
                            items: [
                              {
                                id: request.id,
                                equipmentId: request.equipment_id || "",
                                description: request.description,
                                cost: request.cost || 0,
                                notes: "",
                              },
                            ],
                            status: "completed",
                            created_at: request.created_at,
                          };
                          // حفظ مؤقت في sessionStorage
                          sessionStorage.setItem(
                            "temp_maintenance_invoice",
                            JSON.stringify(maintenanceData)
                          );
                          navigate(`/maintenance-invoice/${request.id}`);
                        }}
                        className="gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة الفاتورة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
