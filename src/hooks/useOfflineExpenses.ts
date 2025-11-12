import { useState, useEffect } from "react";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
} from "@/lib/offline/db";
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

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      // تحميل من المحلي أولاً للعرض الفوري
      const localExpenses = await getAllFromLocal("expenses" as any);
      setExpenses(localExpenses || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading expenses:", error);
      setIsLoading(false);
    }
  };

  const createExpense = async (data: Partial<ExpenseData>) => {
    const expenseId = uuidv4();

    // مستخدم أوفلاين فقط
    let user: any = null;
    try {
      const offlineSession = sessionStorage.getItem("offline_session");
      if (offlineSession) user = JSON.parse(offlineSession);
    } catch {}
    if (!user) {
      const cachedUser = localStorage.getItem("offline.user");
      if (cachedUser) {
        try {
          user = JSON.parse(cachedUser);
        } catch {}
      }
    }
    if (!user) throw new Error("غير مسجل الدخول (وضع أوفلاين)");

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

      // أوفلاين فقط: لا شبكة

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

    return newExpense;
  };

  const deleteExpense = async (id: string) => {
    // حذف من المحلي والـ UI فوراً (أوفلاين فقط)
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteFromLocal("expenses" as any, id);
    // لا تعامل شبكة
  };

  return {
    expenses,
    isLoading,
    createExpense,
    deleteExpense,
    refresh: loadExpenses,
  };
}
