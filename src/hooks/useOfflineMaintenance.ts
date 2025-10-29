import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
} from "@/lib/offline/db";
import { addToQueue, getQueue } from "@/lib/offline/queue";
import { syncWithBackend } from "@/lib/offline/sync";
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
  const isOnline = useOnlineStatus();
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    loadMaintenanceRequests();
  }, []);

  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, reloading maintenance requests...");
      loadMaintenanceRequests();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  const loadMaintenanceRequests = async () => {
    setIsLoading(true);
    try {
      // تحميل من المحلي أولاً للعرض الفوري
      await loadMaintenanceRequestsFromLocal();
      setIsLoading(false);

      // ثم تحديث من السيرفر إذا كان متصل
      if (isOnline) {
        try {
          // مزامنة البيانات المعلقة أولاً
          await syncWithBackend();

          const { data, error } = await (supabase as any)
            .from("maintenance_requests")
            .select(
              `
              *,
              customers(full_name, phone),
              equipment(name, code),
              branches(name)
            `
            )
            .order("created_at", { ascending: false });

          if (!error && data) {
            // استبعاد الصفوف المعلقة للحذف من إعادة الإضافة
            let filteredServer = data;
            try {
              const q = await getQueue();
              const deleteIds = new Set(
                q
                  .filter(
                    (qi) =>
                      qi.operation === "delete" &&
                      qi.table === "maintenance_requests"
                  )
                  .map((qi) => qi.data?.id)
              );
              if (deleteIds.size > 0) {
                filteredServer = filteredServer.filter(
                  (r: any) => !deleteIds.has(r.id)
                );
              }
            } catch {}

            // حفظ البيانات من السيرفر محلياً
            for (const request of filteredServer) {
              await saveToLocal("maintenance_requests" as any, {
                ...request,
                synced: true,
              });
            }
            setMaintenanceRequests(filteredServer);
          }
        } catch (error) {
          console.error(
            "Error fetching maintenance requests from server:",
            error
          );
        }
      }
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

    if (isOnline) {
      try {
        const { data: savedData, error } = await (supabase as any)
          .from("maintenance_requests")
          .insert({
            id: newRequest.id,
            customer_id: newRequest.customer_id,
            equipment_id: newRequest.equipment_id,
            branch_id: newRequest.branch_id,
            created_by: newRequest.created_by,
            request_date: newRequest.request_date,
            description: newRequest.description,
            status: newRequest.status,
            cost: newRequest.cost,
            notes: newRequest.notes,
          })
          .select()
          .single();

        if (!error && savedData) {
          // حفظ البيانات من السيرفر محلياً مع علامة synced
          await saveToLocal("maintenance_requests" as any, {
            ...savedData,
            synced: true,
          });
          setMaintenanceRequests((prev) =>
            prev.map((r: any) =>
              r.id === savedData.id
                ? {
                    ...r,
                    ...savedData,
                    synced: true,
                    customers: r.customers,
                    equipment: r.equipment,
                  }
                : r
            )
          );
        } else {
          // إضافة إلى الـ queue في حالة الفشل
          await addToQueue("maintenance_requests" as any, "insert", newRequest);
        }
      } catch (err) {
        console.error("Error syncing maintenance request:", err);
        await addToQueue("maintenance_requests" as any, "insert", newRequest);
      }
    } else {
      // حفظ في الـ queue للمزامنة لاحقاً
      await addToQueue("maintenance_requests" as any, "insert", newRequest);
    }

    return newRequest;
  };

  const updateMaintenanceRequest = async (
    id: string,
    updates: Partial<MaintenanceRequestData>
  ) => {
    const existing = maintenanceRequests.find((r: any) => r.id === id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("maintenance_requests" as any, updated);
    await addToQueue("maintenance_requests" as any, "update", updated);

    setMaintenanceRequests((prev) =>
      prev.map((r) => (r.id === id ? updated : r))
    );

    if (isOnline) {
      try {
        await (supabase as any)
          .from("maintenance_requests")
          .update(updates as any)
          .eq("id", id);
      } catch (error) {
        console.error("Error syncing maintenance request update:", error);
      }
    }

    return updated;
  };

  return {
    maintenanceRequests,
    isLoading,
    createMaintenanceRequest,
    updateMaintenanceRequest,
    refresh: loadMaintenanceRequests,
  };
}
