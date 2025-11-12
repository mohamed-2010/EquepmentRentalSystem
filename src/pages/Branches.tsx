import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
// Offline-only: Supabase removed
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building2, Phone, MapPin, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllFromLocal } from "@/lib/offline/db";
import { useOfflineBranches } from "@/hooks/useOfflineBranches";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Branches() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    phone: "",
    address: "",
    tax_number: "",
    commercial_registration: "",
  });
  const { toast } = useToast();
  const { branches, isLoading, addBranch, updateBranch, deleteBranch } =
    useOfflineBranches(searchQuery);

  const { data: userRole } = useQuery({
    queryKey: ["userRole"],
    queryFn: async () => {
      const cachedRole = localStorage.getItem("user_role");
      if (cachedRole) {
        try {
          return JSON.parse(cachedRole);
        } catch {
          return { role: cachedRole };
        }
      }
      return null;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await addBranch(formData);

      setIsDialogOpen(false);
      setFormData({
        name: "",
        company_name: "",
        phone: "",
        address: "",
        tax_number: "",
        commercial_registration: "",
      });

      toast({ title: "تم الحفظ", description: "تم إضافة الفرع بنجاح" });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    }
  };

  if (userRole?.role !== "admin") {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">غير مصرح</h3>
            <p className="text-muted-foreground">
              هذه الصفحة متاحة للمديرين فقط
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">الفروع</h2>
            <p className="text-muted-foreground">إدارة فروع الشركة</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة فرع جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة فرع جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم الفرع *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="فرع الرياض"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">اسم الشركة</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    placeholder="اسم الشركة"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_number">الرقم الضريبي</Label>
                  <Input
                    id="tax_number"
                    value={formData.tax_number}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_number: e.target.value })
                    }
                    placeholder="3xxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commercial_registration">السجل التجاري</Label>
                  <Input
                    id="commercial_registration"
                    value={formData.commercial_registration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commercial_registration: e.target.value,
                      })
                    }
                    placeholder="1xxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="05xxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="أدخل العنوان التفصيلي"
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
                  <Button type="submit">حفظ</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                جاري التحميل...
              </CardContent>
            </Card>
          ) : branches?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                لا توجد فروع بعد
              </CardContent>
            </Card>
          ) : (
            branches?.map((branch) => (
              <Card
                key={branch.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-6 w-6 text-primary" />
                      {branch.name}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {/* Edit */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="تعديل">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>تعديل الفرع</DialogTitle>
                          </DialogHeader>
                          <EditBranchForm
                            branch={branch as any}
                            onSubmit={async (values) => {
                              try {
                                await updateBranch(branch.id, values as any);
                              } catch (e: any) {
                                // toast not available here; relying on UX visible update
                                console.error(e);
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
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيؤدي حذف الفرع إلى إزالته نهائياً. لا يمكن الحذف
                              إذا كانت هناك بيانات مرتبطة.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await deleteBranch(branch.id);
                                } catch (e) {
                                  console.error(e);
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
                <CardContent className="space-y-3">
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">
                        {branch.address}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function EditBranchForm({
  branch,
  onSubmit,
}: {
  branch: any;
  onSubmit: (values: any) => Promise<void>;
}) {
  const [values, setValues] = useState({
    name: branch.name || "",
    company_name: branch.company_name || "",
    phone: branch.phone || "",
    address: branch.address || "",
    tax_number: branch.tax_number || "",
    commercial_registration: branch.commercial_registration || "",
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
        <Label htmlFor="bname">اسم الفرع *</Label>
        <Input
          id="bname"
          required
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bcompany">اسم الشركة</Label>
        <Input
          id="bcompany"
          value={values.company_name}
          onChange={(e) =>
            setValues({ ...values, company_name: e.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="btax">الرقم الضريبي</Label>
        <Input
          id="btax"
          value={values.tax_number}
          onChange={(e) => setValues({ ...values, tax_number: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bcr">السجل التجاري</Label>
        <Input
          id="bcr"
          value={values.commercial_registration}
          onChange={(e) =>
            setValues({ ...values, commercial_registration: e.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bphone">رقم الهاتف</Label>
        <Input
          id="bphone"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="baddress">العنوان</Label>
        <Textarea
          id="baddress"
          value={values.address}
          onChange={(e) => setValues({ ...values, address: e.target.value })}
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
