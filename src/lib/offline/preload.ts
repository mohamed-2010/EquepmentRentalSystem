// Offline-only: disable any preload from remote sources while keeping API shape.

/**
 * تحميل كل البيانات من Supabase إلى IndexedDB
 * يتم استدعاء هذه الدالة عند تسجيل الدخول أو عند الاتصال بالإنترنت
 */
export async function preloadAllData() {
  console.log("[PreloadData] Offline mode - preload disabled");
  return false;
}
