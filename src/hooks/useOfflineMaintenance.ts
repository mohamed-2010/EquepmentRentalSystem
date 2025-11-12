import { useState, useEffect } from "react";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  getFromLocal,
} from "@/lib/offline/db";
import { v4 as uuidv4 } from "uuid";

export interface MaintenanceRequestData {
  id?: string;
  customer_id: string;
  equipment_id?: string | null;
  branch_id?: string;
  created_by?: string;
  request_date: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  cost?: number;
  notes?: string;
  completed_date?: string | null;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
  customers?: any;
  equipment?: any;
  branches?: any;
}

export function useOfflineMaintenance() {
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMaintenanceRequests();
  }, []);

  const loadMaintenanceRequests = async () => {
    setIsLoading(true);
    try {
      // تحميل من المحلي أولاً للعرض الفوري
      await loadMaintenanceRequestsFromLocal();
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading maintenance requests:", error);
      setIsLoading(false);
    }
  };

  const loadMaintenanceRequestsFromLocal = async () => {
    const localRequests = await getAllFromLocal("maintenance_requests" as any);
    const customers = await getAllFromLocal("customers");
    const equipment = await getAllFromLocal("equipment");
    const branches = await getAllFromLocal("branches");

    const enrichedRequests =
      localRequests?.map((request: any) => {
        const customer = customers?.find(
          (c: any) => c.id === request.customer_id
        );
        const equip = equipment?.find(
          (e: any) => e.id === request.equipment_id
        );
        const branch = branches?.find((b: any) => b.id === request.branch_id);

        return {
          ...request,
          customers: customer
            ? { full_name: customer.full_name, phone: customer.phone }
            : null,
          equipment: equip ? { name: equip.name, code: equip.code } : null,
          branches: branch ? { name: branch.name } : null,
        };
      }) || [];

    setMaintenanceRequests(enrichedRequests);
  };

  const createMaintenanceRequest = async (
    data: Partial<MaintenanceRequestData>
  ) => {
    const requestId = uuidv4();

    // استرجاع المستخدم أوفلاين فقط
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

      // الوضع أوفلاين: لا محاولة شبكة

      return null;
    };

    const branch_id = await resolveBranchId();
    if (!branch_id) throw new Error("لم يتم تعيين فرع للمستخدم");

    const newRequest: MaintenanceRequestData = {
      ...data,
      id: requestId,
      branch_id,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    } as MaintenanceRequestData;

    await saveToLocal("maintenance_requests" as any, newRequest);

    const customers = await getAllFromLocal("customers");
    const equipment = await getAllFromLocal("equipment");
    const customer = customers?.find(
      (c: any) => c.id === newRequest.customer_id
    );
    const equip = equipment?.find((e: any) => e.id === newRequest.equipment_id);

    const enrichedRequest = {
      ...newRequest,
      customers: customer
        ? { full_name: customer.full_name, phone: customer.phone }
        : null,
      equipment: equip ? { name: equip.name, code: equip.code } : null,
    };

    setMaintenanceRequests((prev) => [enrichedRequest, ...prev]);

    // أوفلاين فقط: لا مزامنة شبكة
    return enrichedRequest;
  };

  const updateMaintenanceRequest = async (
    id: string,
    updates: Partial<MaintenanceRequestData>
  ) => {
    // اجلب الطلب الحالي من المحلي
    const current = (await getFromLocal(
      "maintenance_requests" as any,
      id
    )) as any;
    if (!current) throw new Error("طلب الصيانة غير موجود");

    const updated = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("maintenance_requests" as any, updated);

    // إعادة الإثراء لبيانات العرض
    const customers = await getAllFromLocal("customers");
    const equipment = await getAllFromLocal("equipment");
    const customer = customers?.find((c: any) => c.id === updated.customer_id);
    const equip = equipment?.find((e: any) => e.id === updated.equipment_id);

    const enriched = {
      ...updated,
      customers: customer
        ? { full_name: customer.full_name, phone: customer.phone }
        : null,
      equipment: equip ? { name: equip.name, code: equip.code } : null,
    };

    setMaintenanceRequests((prev) =>
      prev.map((r) => (r.id === id ? enriched : r))
    );

    return enriched;
  };

  return {
    maintenanceRequests,
    isLoading,
    createMaintenanceRequest,
    updateMaintenanceRequest,
    refresh: loadMaintenanceRequests,
  };
}
