import { supabase } from "@/integrations/supabase/client";
import { saveToLocal, clearStore } from "./db";

/**
 * تحميل كل البيانات من Supabase إلى IndexedDB
 * يتم استدعاء هذه الدالة عند تسجيل الدخول أو عند الاتصال بالإنترنت
 */
export async function preloadAllData() {
  try {
    console.log("[PreloadData] Starting to preload all data from Supabase");

    // الحصول على branch_id للمستخدم الحالي
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[PreloadData] No user found, skipping preload");
      return false;
    }

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role, branch_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const branch_id = userRole?.branch_id;
    if (!branch_id) {
      console.warn(
        "[PreloadData] No branch_id found for user, skipping preload"
      );
      return false;
    }

    console.log("[PreloadData] Branch ID:", branch_id);

    // حفظ user_role في localStorage للاستخدام offline
    localStorage.setItem("user_role", JSON.stringify(userRole));
    console.log("[PreloadData] User role saved to localStorage");

    // 1. تحميل العملاء
    console.log("[PreloadData] Loading customers...");
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .eq("branch_id", branch_id);

    if (customers) {
      await clearStore("customers");
      for (const customer of customers) {
        await saveToLocal("customers", { ...customer, synced: true });
      }
      console.log(`[PreloadData] Loaded ${customers.length} customers`);
    }

    // 2. تحميل المعدات
    console.log("[PreloadData] Loading equipment...");
    const { data: equipment } = await supabase
      .from("equipment")
      .select("*")
      .eq("branch_id", branch_id);

    if (equipment) {
      await clearStore("equipment");
      for (const item of equipment) {
        await saveToLocal("equipment", { ...item, synced: true });
      }
      console.log(`[PreloadData] Loaded ${equipment.length} equipment items`);
    }

    // 3. تحميل الإيجارات مع العلاقات
    console.log("[PreloadData] Loading rentals...");
    const { data: rentals } = await supabase
      .from("rentals")
      .select(
        `
        *,
        customers(full_name, phone),
        branches(name)
      `
      )
      .eq("branch_id", branch_id);

    if (rentals) {
      await clearStore("rentals");
      for (const rental of rentals) {
        await saveToLocal("rentals", { ...rental, synced: true });
      }
      console.log(`[PreloadData] Loaded ${rentals.length} rentals`);
    }

    // 4. تحميل rental_items مع بيانات المعدات
    console.log("[PreloadData] Loading rental items...");
    const { data: rentalItems } = await supabase.from("rental_items").select(`
        *,
        equipment(name, code, daily_rate)
      `);

    if (rentalItems) {
      await clearStore("rental_items");
      for (const item of rentalItems) {
        await saveToLocal("rental_items", { ...item, synced: true });
      }
      console.log(`[PreloadData] Loaded ${rentalItems.length} rental items`);
    }

    // 5. تحميل الفروع (للمسؤولين)
    console.log("[PreloadData] Loading branches...");
    const { data: branches } = await supabase.from("branches").select("*");

    if (branches) {
      await clearStore("branches");
      for (const branch of branches) {
        await saveToLocal("branches", { ...branch, synced: true });
      }
      // احفظ نسخة في localStorage للفولباك السريع
      try {
        localStorage.setItem("branches_cache", JSON.stringify(branches));
      } catch {}
      console.log(`[PreloadData] Loaded ${branches.length} branches`);
    }

    console.log("[PreloadData] ✅ All data preloaded successfully!");
    return true;
  } catch (error) {
    console.error("[PreloadData] Error preloading data:", error);
    return false;
  }
}
