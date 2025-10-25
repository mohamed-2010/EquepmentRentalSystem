import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Package, Search, Pencil, Trash2 } from "lucide-react";
import { useOfflineEquipment } from "@/hooks/useOfflineEquipment";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getAllFromLocal } from "@/lib/offline/db";

interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  daily_rate: number;
  status: "available" | "rented" | "maintenance";
  notes?: string;
}

const Equipment = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "",
    daily_rate: "",
    status: "available" as const,
    notes: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    code: "",
    category: "",
    daily_rate: "",
    status: "available" as const,
    notes: "",
  });

  const isOnline = useOnlineStatus();
  const {
    equipment,
    isLoading,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    refresh,
  } = useOfflineEquipment(searchTerm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Resolve branch id from multiple sources with robust fallbacks
      const resolveBranchId = async (): Promise<string | null> => {
        const isAdmin = (() => {
          try {
            const ur = localStorage.getItem("user_role");
            if (ur && JSON.parse(ur)?.role === "admin") return true;
          } catch {}
          try {
            const ss = sessionStorage.getItem("offline_session");
            if (ss && JSON.parse(ss)?.user_metadata?.role === "admin")
              return true;
          } catch {}
          return false;
        })();
        // 1) localStorage user_role
        try {
          const ur = localStorage.getItem("user_role");
          if (ur) {
            const parsed = JSON.parse(ur);
            if (parsed?.branch_id) return parsed.branch_id as string;
          }
        } catch {}

        // 2) sessionStorage offline_session
        try {
          const ss = sessionStorage.getItem("offline_session");
          if (ss) {
            const sess = JSON.parse(ss);
            if (sess?.user_metadata?.branch_id)
              return sess.user_metadata.branch_id as string;
          }
        } catch {}

        // 3) legacy cache
        const legacy = localStorage.getItem("user_branch_id");
        if (legacy) return legacy;

        // 4) single-branch fallback from local IndexedDB
        try {
          const localBranches = await getAllFromLocal("branches");
          if (Array.isArray(localBranches) && localBranches.length > 0) {
            // If only one branch, or admin, pick the first branch as default context
            if (localBranches.length === 1 || isAdmin) {
              return localBranches[0].id as string;
            }
          }
        } catch {}

        // 5) Online fallback: fetch user_roles with timeout
        if (isOnline) {
          try {
            const timeoutMs = 2000;
            const fetchPromise = supabase
              .from("user_roles")
              .select("branch_id")
              .limit(1)
              .maybeSingle();
            const timeoutPromise = new Promise<{ data: any | null }>((res) =>
              setTimeout(() => res({ data: null }), timeoutMs)
            );
            const { data } = await Promise.race([fetchPromise, timeoutPromise]);
            if (data?.branch_id) {
              try {
                localStorage.setItem("user_branch_id", data.branch_id);
                const role = localStorage.getItem("user_role");
                if (role) {
                  const parsed = JSON.parse(role);
                  localStorage.setItem(
                    "user_role",
                    JSON.stringify({ ...parsed, branch_id: data.branch_id })
                  );
                }
              } catch {}
              return data.branch_id as string;
            }
            // 6) As last resort: fetch a branch and pick first (admin can operate on any)
            const { data: branches } = await supabase
              .from("branches")
              .select("id")
              .limit(isAdmin ? 1 : 2);
            if (branches && branches.length > 0) {
              if (isAdmin || branches.length === 1) {
                return branches[0].id as string;
              }
            }
          } catch {}
        }
        return null;
      };

      const branchId = await resolveBranchId();
      if (!branchId) {
        toast.error(
          "لا يوجد فرع محدد للمستخدم. يرجى تحديد فرع من الإعدادات أو تواصل مع المسؤول."
        );
        return;
      }

      // استخدام الـ hook بدلاً من Supabase مباشرة
      await addEquipment({
        name: formData.name,
        code: formData.code,
        category: formData.category,
        daily_rate: parseFloat(formData.daily_rate),
        status: formData.status,
        notes: formData.notes,
        branch_id: branchId,
      });

      toast.success(
        isOnline
          ? "تمت إضافة المعدة بنجاح"
          : "تمت إضافة المعدة محلياً. سيتم المزامنة عند عودة الاتصال."
      );
      setDialogOpen(false);
      setFormData({
        name: "",
        code: "",
        category: "",
        daily_rate: "",
        status: "available",
        notes: "",
      });
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ في إضافة المعدة");
    }
  };

  const filteredEquipment = equipment.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      available: {
        label: "متاحة",
        className: "bg-success text-success-foreground",
      },
      rented: {
        label: "مؤجرة",
        className: "bg-destructive text-destructive-foreground",
      },
      maintenance: {
        label: "صيانة",
        className: "bg-muted text-muted-foreground",
      },
    };
    const variant = variants[status as keyof typeof variants];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const openEdit = (item: any) => {
    setSelected(item);
    setEditData({
      name: item.name || "",
      code: item.code || "",
      category: item.category || "",
      daily_rate: String(item.daily_rate ?? ""),
      status: item.status || "available",
      notes: item.notes || "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await updateEquipment(selected.id, {
        name: editData.name,
        code: editData.code,
        category: editData.category,
        daily_rate: parseFloat(editData.daily_rate || "0"),
        status: editData.status as any,
        notes: editData.notes,
      } as any);
      toast.success("تم تحديث المعدة");
      setEditOpen(false);
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحديث المعدة");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">المعدات</h2>
            <p className="text-muted-foreground">إدارة المعدات والمخزون</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <Plus className="h-5 w-5 ml-2" />
                إضافة معدة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة معدة جديدة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">اسم المعدة</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="code">الكود</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">الفئة</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="daily_rate">سعر الإيجار اليومي</Label>
                  <Input
                    id="daily_rate"
                    type="number"
                    step="0.01"
                    value={formData.daily_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, daily_rate: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">متاحة</SelectItem>
                      <SelectItem value="rented">مؤجرة</SelectItem>
                      <SelectItem value="maintenance">صيانة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
                <Button type="submit" className="w-full">
                  إضافة
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="البحث بالاسم أو الكود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">
                جاري التحميل...
              </p>
            ) : filteredEquipment.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد معدات مسجلة</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEquipment.map((item) => (
                  <Card
                    key={item.id}
                    className="hover:shadow-md transition-smooth"
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            كود: {item.code}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(item.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
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
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف هذه المعدة؟ لا يمكن
                                  التراجع عن هذا الإجراء.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    try {
                                      await deleteEquipment(item.id);
                                      toast.success("تم حذف المعدة");
                                    } catch (e: any) {
                                      toast.error(
                                        e?.message || "تعذر حذف المعدة"
                                      );
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
                      {item.category && (
                        <p className="text-sm text-muted-foreground mb-2">
                          الفئة: {item.category}
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-primary font-bold text-lg">
                          {item.daily_rate} ر.س / يوم
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>تعديل المعدة</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <Label htmlFor="ename">اسم المعدة</Label>
                <Input
                  id="ename"
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="ecode">الكود</Label>
                <Input
                  id="ecode"
                  value={editData.code}
                  onChange={(e) =>
                    setEditData({ ...editData, code: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="ecategory">الفئة</Label>
                <Input
                  id="ecategory"
                  value={editData.category}
                  onChange={(e) =>
                    setEditData({ ...editData, category: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edaily_rate">سعر الإيجار اليومي</Label>
                <Input
                  id="edaily_rate"
                  type="number"
                  step="0.01"
                  value={editData.daily_rate}
                  onChange={(e) =>
                    setEditData({ ...editData, daily_rate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="estatus">الحالة</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value: any) =>
                    setEditData({ ...editData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">متاحة</SelectItem>
                    <SelectItem value="rented">مؤجرة</SelectItem>
                    <SelectItem value="maintenance">صيانة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="enotes">ملاحظات</Label>
                <Input
                  id="enotes"
                  value={editData.notes}
                  onChange={(e) =>
                    setEditData({ ...editData, notes: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full">
                حفظ التعديلات
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Equipment;
