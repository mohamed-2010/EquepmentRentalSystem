import { useState, useEffect } from "react";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  BranchData,
} from "@/lib/offline/db";
import { v4 as uuidv4 } from "uuid";

export function useOfflineBranches(searchQuery: string = "") {
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, [searchQuery]);

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      // Always load from local first for instant display
      await loadFromLocal();
      // fallback: لو المخزن المحلي فاضي، جرّب القراءة من localStorage cache
      const current = await getAllFromLocal("branches");
      if (!current || current.length === 0) {
        try {
          const cachedStr = localStorage.getItem("branches_cache");
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (Array.isArray(cached) && cached.length > 0) {
              for (const b of cached) {
                await saveToLocal("branches", { ...b, synced: true });
              }
              await loadFromLocal();
            }
          }
        } catch (e) {
          console.warn("Failed to load branches from cache", e);
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading branches:", error);
      setIsLoading(false);
    }
  };

  const loadFromLocal = async () => {
    const localBranches = await getAllFromLocal("branches");
    let filtered = localBranches as BranchData[];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.company_name &&
            item.company_name
              .toLowerCase()
              .includes(searchQuery.toLowerCase())) ||
          (item.phone &&
            item.phone.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setBranches(filtered);
  };

  const addBranch = async (
    data: Omit<BranchData, "id" | "created_at" | "updated_at" | "synced">
  ) => {
    const newBranch: BranchData = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // حفظ محلياً دائماً
    await saveToLocal("branches", newBranch);
    await loadFromLocal();

    return newBranch;
  };

  const updateBranch = async (id: string, data: Partial<BranchData>) => {
    const existing = branches.find((b) => b.id === id);
    if (!existing) return;

    const updated: BranchData = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("branches", updated);
    // Update local state immediately without reloading
    setBranches((prev) => prev.map((b) => (b.id === id ? updated : b)));

    return updated;
  };

  const deleteBranch = async (id: string) => {
    // Check dependencies locally
    const [customers, equipment, rentals] = await Promise.all([
      getAllFromLocal("customers"),
      getAllFromLocal("equipment"),
      getAllFromLocal("rentals"),
    ]);

    const hasDeps =
      customers?.some((c: any) => c.branch_id === id) ||
      equipment?.some((e: any) => e.branch_id === id) ||
      rentals?.some((r: any) => r.branch_id === id);
    if (hasDeps) {
      throw new Error(
        "لا يمكن حذف الفرع لوجود بيانات مرتبطة به (عملاء/معدات/إيجارات)"
      );
    }

    await deleteFromLocal("branches", id);
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  return {
    branches,
    isLoading,
    addBranch,
    updateBranch,
    deleteBranch,
    refresh: loadBranches,
  };
}
