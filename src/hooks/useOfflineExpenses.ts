import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
} from "@/lib/offline/db";
import { addToQueue, getQueue, removeFromQueue } from "@/lib/offline/queue";
import { syncWithBackend } from "@/lib/offline/sync";
import { v4 as uuidv4 } from "uuid";

export interface ExpenseData {
  id?: string;
  branch_id?: string;
  created_by?: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
}

export function useOfflineExpenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, reloading expenses...");
      loadExpenses();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      // تحميل من المحلي أولاً للعرض الفوري
      const localExpenses = await getAllFromLocal("expenses" as any);
      setExpenses(localExpenses || []);
      setIsLoading(false);

      // ثم تحديث من السيرفر إذا كان متصل
      if (isOnline) {
        try {
          // مزامنة البيانات المعلقة أولاً
          await syncWithBackend();

          const { data, error } = await (supabase as any)
            .from("expenses")
            .select("*")
            .order("expense_date", { ascending: false });

          if (!error && data) {
            // استبعاد الصفوف المعلقة للحذف من إعادة الإضافة
            let filteredServer = data;
            try {
              const q = await getQueue();
              const deleteIds = new Set(
                q
                  .filter(
                    (qi) => qi.operation === "delete" && qi.table === "expenses"
                  )
                  .map((qi) => qi.data?.id)
              );
              if (deleteIds.size > 0) {
                filteredServer = filteredServer.filter(
                  (e: any) => !deleteIds.has(e.id)
                );
              }
            } catch {}

            // حفظ البيانات من السيرفر محلياً
            for (const expense of filteredServer) {
              await saveToLocal("expenses" as any, {
                ...expense,
                synced: true,
              });
            }
            setExpenses(filteredServer);
          }
        } catch (error) {
          console.error("Error fetching expenses from server:", error);
        }
      }
    } catch (error) {
      console.error("Error loading expenses:", error);
      setIsLoading(false);
    }
  };

  const createExpense = async (data: Partial<ExpenseData>) => {
    const expenseId = uuidv4();

    let user;
    if (isOnline) {
      const {
        data: { user: onlineUser },
      } = await supabase.auth.getUser();
      user = onlineUser;
    } else {
      const cachedUser = localStorage.getItem("supabase.auth.user");
      if (cachedUser) {
        user = JSON.parse(cachedUser);
      }
    }

    if (!user) throw new Error("غير مسجل الدخول");

    // حل مشكلة branch_id للـ Admin
    const resolveBranchId = async (): Promise<string | null> => {
      const isAdmin = (() => {
        try {
          const ur = localStorage.getItem("user_role");
          if (ur && JSON.parse(ur)?.role === "admin") return true;
        } catch {}
        return false;
      })();

      // 1) من user_role في localStorage
      const userRoleData = localStorage.getItem("user_role");
      const userRole = userRoleData ? JSON.parse(userRoleData) : null;
      if (userRole?.branch_id) return userRole.branch_id;

      // 2) من user_branch_id في localStorage
      const legacy = localStorage.getItem("user_branch_id");
      if (legacy) return legacy;

      // 3) إذا كان Admin أو فرع واحد فقط، استخدم أول فرع
      try {
        const { getAllFromLocal } = await import("@/lib/offline/db");
        const localBranches = await getAllFromLocal("branches");
        if (Array.isArray(localBranches) && localBranches.length > 0) {
          if (localBranches.length === 1 || isAdmin) {
            return localBranches[0].id as string;
          }
        }
      } catch {}

      // 4) محاولة من Supabase (online)
      if (isOnline) {
        try {
          const { data: branches } = await supabase
            .from("branches")
            .select("id")
            .limit(1);
          if (branches && branches.length > 0) {
            return branches[0].id as string;
          }
        } catch {}
      }

      return null;
    };

    const branch_id = await resolveBranchId();
    if (!branch_id) throw new Error("لم يتم تعيين فرع للمستخدم");

    const newExpense: ExpenseData = {
      ...data,
      id: expenseId,
      branch_id,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    } as ExpenseData;

    await saveToLocal("expenses" as any, newExpense);
    setExpenses((prev) => [newExpense, ...prev]);

    if (isOnline) {
      try {
        const { data: savedData, error } = await (supabase as any)
          .from("expenses")
          .insert({
            id: newExpense.id,
            branch_id: newExpense.branch_id,
            created_by: newExpense.created_by,
            expense_date: newExpense.expense_date,
            category: newExpense.category,
            description: newExpense.description,
            amount: newExpense.amount,
            notes: newExpense.notes,
          })
          .select()
          .single();

        if (!error && savedData) {
          // حفظ البيانات من السيرفر محلياً مع علامة synced
          await saveToLocal("expenses" as any, { ...savedData, synced: true });
          setExpenses((prev) =>
            prev.map((e) =>
              e.id === savedData.id ? { ...savedData, synced: true } : e
            )
          );
        } else {
          // إضافة إلى الـ queue في حالة الفشل
          await addToQueue("expenses" as any, "insert", newExpense);
        }
      } catch (error) {
        console.error("Error syncing expense:", error);
        await addToQueue("expenses" as any, "insert", newExpense);
      }
    } else {
      // حفظ في الـ queue للمزامنة لاحقاً
      await addToQueue("expenses" as any, "insert", newExpense);
    }

    return newExpense;
  };

  const deleteExpense = async (id: string) => {
    // حذف من المحلي والـ UI فوراً
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteFromLocal("expenses" as any, id);

    if (isOnline) {
      try {
        const { error } = await (supabase as any)
          .from("expenses")
          .delete()
          .eq("id", id);
        if (!error) {
          // نجح الحذف من السيرفر - لا حاجة لإزالة من الـ queue
          console.log("Expense deleted from server successfully");
        } else {
          // فشل الحذف، أضفه للـ queue
          await addToQueue("expenses" as any, "delete", { id });
        }
      } catch (err) {
        console.error("Error deleting expense:", err);
        await addToQueue("expenses" as any, "delete", { id });
      }
    } else {
      // حفظ في الـ queue للمزامنة لاحقاً
      await addToQueue("expenses" as any, "delete", { id });
    }
  };

  return {
    expenses,
    isLoading,
    createExpense,
    deleteExpense,
    refresh: loadExpenses,
  };
}
