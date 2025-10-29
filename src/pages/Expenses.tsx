import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, Calendar, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useOfflineExpenses } from "@/hooks/useOfflineExpenses";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
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

const EXPENSE_CATEGORIES = [
  { value: "operational", label: "تشغيلية" },
  { value: "salaries", label: "رواتب" },
  { value: "maintenance", label: "صيانة" },
  { value: "rent", label: "إيجار" },
  { value: "utilities", label: "مرافق (كهرباء/ماء)" },
  { value: "fuel", label: "وقود" },
  { value: "other", label: "أخرى" },
];

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const { expenses, isLoading, createExpense, deleteExpense } =
    useOfflineExpenses();

  const handleCreate = async () => {
    try {
      if (!category || !description || !amount) {
        toast({
          title: "خطأ",
          description: "يرجى ملء جميع الحقول المطلوبة",
          variant: "destructive",
        });
        return;
      }

      await createExpense({
        expense_date: expenseDate,
        category,
        description,
        amount: parseFloat(amount),
        notes,
      });

      setIsDialogOpen(false);
      setCategory("");
      setDescription("");
      setAmount("");
      setNotes("");
      setExpenseDate(new Date().toISOString().split("T")[0]);

      toast({
        title: "تم بنجاح",
        description: isOnline
          ? "تم تسجيل المصروف"
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

  const totalExpenses =
    expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

  const groupedByCategory = expenses?.reduce((acc: any, exp) => {
    const cat = exp.category || "other";
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += exp.amount || 0;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">المصاريف</h2>
            <p className="text-muted-foreground">تسجيل ومتابعة جميع المصاريف</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة مصروف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>تسجيل مصروف جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-date">التاريخ *</Label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">الفئة *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">الوصف *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="تفاصيل المصروف..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">المبلغ (ريال) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات إضافية..."
                    rows={2}
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
                    disabled={!category || !description || !amount}
                  >
                    حفظ
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                إجمالي المصاريف
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {totalExpenses.toFixed(2)} ر.س
              </div>
            </CardContent>
          </Card>

          {Object.entries(groupedByCategory || {})
            .slice(0, 2)
            .map(([cat, total]: any) => {
              const catLabel =
                EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label || cat;
              return (
                <Card key={cat}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {catLabel}
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {total.toFixed(2)} ر.س
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Expenses List */}
        <Card>
          <CardHeader>
            <CardTitle>سجل المصاريف</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">
                جاري التحميل...
              </p>
            ) : expenses?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد مصاريف مسجلة
              </p>
            ) : (
              <div className="space-y-3">
                {expenses?.map((expense) => {
                  const catLabel =
                    EXPENSE_CATEGORIES.find((c) => c.value === expense.category)
                      ?.label || expense.category;

                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">
                            {expense.description}
                          </span>
                          <span className="text-xs px-2 py-1 bg-muted rounded-full">
                            {catLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(
                              new Date(expense.expense_date),
                              "dd MMM yyyy",
                              {
                                locale: ar,
                              }
                            )}
                          </span>
                          {expense.notes && (
                            <span className="text-xs">{expense.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-destructive">
                            {expense.amount.toFixed(2)} ر.س
                          </div>
                        </div>
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
                                هل أنت متأكد من حذف هذا المصروف؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  await deleteExpense(expense.id);
                                  toast({ title: "تم حذف المصروف" });
                                }}
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
