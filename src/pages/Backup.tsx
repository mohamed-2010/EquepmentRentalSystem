import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Cloud,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  initializeGoogleAPIs,
  backupToGoogleDrive,
  listBackups,
  restoreFromGoogleDrive,
  deleteBackup,
  exportLocalBackup,
  importLocalBackup,
} from "@/lib/backup/googleDrive";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
}

const Backup = () => {
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);

  useEffect(() => {
    checkGoogleDriveStatus();
  }, []);

  const checkGoogleDriveStatus = async () => {
    const initialized = await initializeGoogleAPIs();
    setGoogleDriveEnabled(initialized);
    if (initialized) {
      loadBackups();
    }
  };

  const loadBackups = async () => {
    setLoading(true);
    try {
      const result = await listBackups();
      if (result.success && result.files) {
        setBackups(result.files);
      } else {
        toast.error(result.message || "فشل تحميل النسخ الاحتياطية");
      }
    } catch (error) {
      console.error("Error loading backups:", error);
      toast.error("حدث خطأ أثناء تحميل النسخ الاحتياطية");
    } finally {
      setLoading(false);
    }
  };

  const handleBackupToCloud = async () => {
    setLoading(true);
    try {
      const result = await backupToGoogleDrive();
      if (result.success) {
        toast.success(result.message);
        loadBackups();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Backup error:", error);
      toast.error("حدث خطأ أثناء إنشاء النسخة الاحتياطية");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!selectedBackup) return;
    setLoading(true);
    try {
      const result = await restoreFromGoogleDrive(selectedBackup.id);
      if (result.success) {
        toast.success(result.message);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("حدث خطأ أثناء استعادة النسخة الاحتياطية");
    } finally {
      setLoading(false);
      setShowRestoreDialog(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!selectedBackup) return;
    setLoading(true);
    try {
      const result = await deleteBackup(selectedBackup.id);
      if (result.success) {
        toast.success(result.message);
        loadBackups();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("حدث خطأ أثناء حذف النسخة الاحتياطية");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handleExportLocal = async () => {
    setLoading(true);
    try {
      await exportLocalBackup();
      toast.success("تم تصدير النسخة الاحتياطية بنجاح");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("حدث خطأ أثناء تصدير النسخة الاحتياطية");
    } finally {
      setLoading(false);
    }
  };

  const handleImportLocal = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await importLocalBackup(file);
      if (result.success) {
        toast.success(result.message);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("حدث خطأ أثناء استيراد النسخة الاحتياطية");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* <div className="mb-6">
        <h1 className="text-3xl font-bold">النسخ الاحتياطي والاستعادة</h1>
        <p className="text-muted-foreground mt-2">
          احفظ بياناتك واستعدها باستخدام Google Drive أو ملف محلي
        </p>
      </div> */}

      {/* <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                حالة Google Drive
              </CardTitle>
              <CardDescription>
                {googleDriveEnabled
                  ? "متصل ويعمل بنجاح"
                  : "غير متصل - يرجى إضافة بيانات API في ملف .env"}
              </CardDescription>
            </div>
            {googleDriveEnabled ? (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-500" />
            )}
          </div>
        </CardHeader>
        {!googleDriveEnabled && (
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm mb-2 font-semibold">
                للتفعيل، أضف المتغيرات التالية في ملف .env:
              </p>
              <code className="text-xs block bg-background p-2 rounded">
                VITE_GOOGLE_CLIENT_ID=your_client_id_here
                <br />
                VITE_GOOGLE_API_KEY=your_api_key_here
              </code>
            </div>
          </CardContent>
        )}
      </Card> */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>إنشاء نسخة احتياطية</CardTitle>
            <CardDescription>احفظ جميع بياناتك الحالية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {googleDriveEnabled && (
              <Button
                onClick={handleBackupToCloud}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري النسخ...
                  </>
                ) : (
                  <>
                    <Cloud className="ml-2 h-4 w-4" />
                    نسخ احتياطي إلى Google Drive
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleExportLocal}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="ml-2 h-4 w-4" />
                  تصدير ملف محلي
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>استيراد نسخة احتياطية</CardTitle>
            <CardDescription>استعد البيانات من ملف محلي</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-file" className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm font-medium">اضغط لاختيار ملف</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JSON فقط
                    </p>
                  </div>
                </Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImportLocal}
                  disabled={loading}
                  className="hidden"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {googleDriveEnabled && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>النسخ الاحتياطية المحفوظة</CardTitle>
                <CardDescription>
                  النسخ الاحتياطية المتوفرة على Google Drive
                </CardDescription>
              </div>
              <Button
                onClick={loadBackups}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && backups.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  جاري التحميل...
                </p>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileJson className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد نسخ احتياطية محفوظة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileJson className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{backup.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(backup.createdTime)} •{" "}
                          {formatSize(parseInt(backup.size || "0"))}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBackup(backup);
                          setShowRestoreDialog(true);
                        }}
                        disabled={loading}
                      >
                        <RefreshCw className="h-4 w-4 ml-1" />
                        استعادة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBackup(backup);
                          setShowDeleteDialog(true);
                        }}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استعادة النسخة الاحتياطية؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم استبدال جميع البيانات الحالية بالبيانات من النسخة الاحتياطية:{" "}
              <strong>{selectedBackup?.name}</strong>
              <br />
              <br />
              هذا الإجراء لا يمكن التراجع عنه!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreFromCloud}
              disabled={loading}
            >
              {loading ? "جاري الاستعادة..." : "استعادة"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف النسخة الاحتياطية؟</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف: <strong>{selectedBackup?.name}</strong>?
              <br />
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBackup}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Backup;
