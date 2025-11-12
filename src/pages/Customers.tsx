import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Phone,
  IdCard,
  User,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOfflineCustomers } from "@/hooks/useOfflineCustomers";
import { getAllFromLocal } from "@/lib/offline/db";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    id_number: "",
    id_source: "",
    address: "",
    notes: "",
  });
  const { toast } = useToast();
  const { customers, isLoading, addCustomer, updateCustomer, deleteCustomer } =
    useOfflineCustomers(searchQuery);

  const { data: userRole } = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get branch_id from multiple cache sources for offline reliability
    const branchId =
      userRole?.branch_id ||
      ((): string | null => {
        const fromUserRole = (() => {
          try {
            const ur = localStorage.getItem("user_role");
            return ur ? JSON.parse(ur)?.branch_id ?? null : null;
          } catch {
            return null;
          }
        })();
        const fromSession = (() => {
          try {
            const ss = sessionStorage.getItem("offline_session");
            return ss ? JSON.parse(ss)?.user_metadata?.branch_id ?? null : null;
          } catch {
            return null;
          }
        })();
        const fromLegacy = localStorage.getItem("user_branch_id");
        return fromUserRole || fromSession || fromLegacy;
      })();

    if (!branchId) {
      // Admin override and branch auto-pick logic
      const isAdmin =
        userRole?.role === "admin" ||
        (() => {
          try {
            const ur = localStorage.getItem("user_role");
            return ur && JSON.parse(ur)?.role === "admin";
          } catch {
            return false;
          }
        })();

      try {
        const localBranches = await getAllFromLocal("branches");
        if (Array.isArray(localBranches) && localBranches.length > 0) {
          // If there's only one branch or user is admin, auto-pick first
          if (localBranches.length === 1 || isAdmin) {
            const chosenId = localBranches[0].id as string;
            await addCustomer({ ...formData, branch_id: chosenId });
            setIsDialogOpen(false);
            setFormData({
              full_name: "",
              phone: "",
              id_number: "",
              id_source: "",
              address: "",
              notes: "",
            });
            toast({ title: "تم الحفظ", description: "تم إضافة العميل بنجاح" });
            // Offline-only: no pending sync update
            return;
          }
        }

        // If online and admin, pick first remote branch if local is empty
        // Online fetch removed in offline-only mode
      } catch {}

      toast({
        title: "خطأ",
        description: "لم يتم تعيين فرع للمستخدم",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addCustomer({
        ...formData,
        branch_id: branchId,
      });

      setIsDialogOpen(false);
      setFormData({
        full_name: "",
        phone: "",
        id_number: "",
        id_source: "",
        address: "",
        notes: "",
      });

      toast({
        title: "تم الحفظ",
        description: "تم إضافة العميل بنجاح",
      });

      // Offline-only: no pending sync update
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
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
            <h2 className="text-3xl font-bold">العملاء</h2>
            <p className="text-muted-foreground">إدارة بيانات العملاء</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة عميل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>إضافة عميل جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">الاسم الثلاثي *</Label>
                  <Input
                    id="full_name"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="أدخل الاسم الثلاثي"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف *</Label>
                  <Input
                    id="phone"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id_number">رقم الهوية</Label>
                  <Input
                    id="id_number"
                    value={formData.id_number}
                    onChange={(e) =>
                      setFormData({ ...formData, id_number: e.target.value })
                    }
                    placeholder="أدخل رقم الهوية"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id_source">مصدر الهوية</Label>
                  <Input
                    id="id_source"
                    value={formData.id_source}
                    onChange={(e) =>
                      setFormData({ ...formData, id_source: e.target.value })
                    }
                    placeholder="مثال: الرياض، جدة، إلخ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="أدخل عنوان العميل"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="ملاحظات إضافية"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end">
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

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث باسم العميل أو رقم الهاتف أو رقم الهويه..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                جاري التحميل...
              </div>
            ) : customers?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا يوجد عملاء بعد
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customers?.map((customer) => (
                  <Card
                    key={customer.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" />
                          {customer.full_name}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          {/* Edit */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="تعديل">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>تعديل بيانات العميل</DialogTitle>
                              </DialogHeader>
                              <EditCustomerForm
                                customer={customer as any}
                                onSubmit={async (values) => {
                                  try {
                                    await updateCustomer(
                                      customer.id,
                                      values as any
                                    );
                                    toast({ title: "تم التحديث" });
                                  } catch (e: any) {
                                    toast({
                                      title: "خطأ",
                                      description:
                                        e?.message || "تعذر تحديث العميل",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              />
                            </DialogContent>
                          </Dialog>

                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="حذف">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذا العميل نهائياً ولا يمكن التراجع
                                  عن ذلك.
                                </AlertDialogDescription>
                              </AlertHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    try {
                                      await deleteCustomer(customer.id);
                                      toast({ title: "تم الحذف" });
                                    } catch (e: any) {
                                      toast({
                                        title: "خطأ",
                                        description:
                                          e?.message ||
                                          "تعذر حذف العميل (قد تكون هناك إيجارات مرتبطة)",
                                        variant: "destructive",
                                      });
                                    }
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
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.id_number && (
                        <div className="flex items-center gap-2 text-sm">
                          <IdCard className="h-4 w-4 text-muted-foreground" />
                          <span>{customer.id_number}</span>
                          {customer.id_source && (
                            <span className="text-muted-foreground">
                              ({customer.id_source})
                            </span>
                          )}
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">📍</span>
                          <span>{customer.address}</span>
                        </div>
                      )}
                      {customer.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {customer.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function EditCustomerForm({
  customer,
  onSubmit,
}: {
  customer: any;
  onSubmit: (values: {
    full_name: string;
    phone: string;
    id_number?: string;
    id_source?: string;
    address?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [values, setValues] = useState({
    full_name: customer.full_name || "",
    phone: customer.phone || "",
    id_number: customer.id_number || "",
    id_source: customer.id_source || "",
    address: customer.address || "",
    notes: customer.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="efull_name">الاسم الثلاثي *</Label>
        <Input
          id="efull_name"
          required
          value={values.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ephone">رقم الهاتف *</Label>
        <Input
          id="ephone"
          required
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eid_number">رقم الهوية</Label>
        <Input
          id="eid_number"
          value={values.id_number}
          onChange={(e) => setValues({ ...values, id_number: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eid_source">مصدر الهوية</Label>
        <Input
          id="eid_source"
          value={values.id_source}
          onChange={(e) => setValues({ ...values, id_source: e.target.value })}
          placeholder="مثال: الرياض، جدة، إلخ"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eaddress">العنوان</Label>
        <Input
          id="eaddress"
          value={values.address}
          onChange={(e) => setValues({ ...values, address: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="enotes">ملاحظات</Label>
        <Textarea
          id="enotes"
          value={values.notes}
          onChange={(e) => setValues({ ...values, notes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </Button>
      </div>
    </form>
  );
}
