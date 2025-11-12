import { useState, useEffect } from "react";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  EquipmentData,
} from "@/lib/offline/db";
import { v4 as uuidv4 } from "uuid";

export function useOfflineEquipment(searchQuery: string = "") {
  const [equipment, setEquipment] = useState<EquipmentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEquipment();
  }, [searchQuery]);

  const loadEquipment = async () => {
    setIsLoading(true);
    try {
      // Load from local first for instant UI
      const localEquipment = await getAllFromLocal("equipment");
      let filtered = localEquipment as EquipmentData[];

      if (searchQuery) {
        filtered = filtered.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.category &&
              item.category.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      setEquipment(filtered);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading equipment:", error);
      setIsLoading(false);
    }
  };

  const loadFromLocal = async () => {
    const localEquipment = await getAllFromLocal("equipment");
    let filtered = localEquipment as EquipmentData[];

    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.category &&
            item.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setEquipment(filtered);
  };

  const addEquipment = async (
    data: Omit<EquipmentData, "id" | "created_at" | "updated_at" | "synced">
  ) => {
    const newEquipment: EquipmentData = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // حفظ محلياً دائماً
    await saveToLocal("equipment", newEquipment);
    await loadEquipment();
    return newEquipment;
  };

  const updateEquipment = async (id: string, data: Partial<EquipmentData>) => {
    const existing = equipment.find((e) => e.id === id);
    if (!existing) return;

    const updated: EquipmentData = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("equipment", updated);
    await loadEquipment();

    return updated;
  };

  const deleteEquipment = async (id: string) => {
    const existing = equipment.find((e) => e.id === id);
    if (!existing) return;

    // Prevent deletion if rented
    if (existing.status === "rented") {
      throw new Error("لا يمكن حذف معدة مؤجرة حالياً");
    }

    // Also prevent delete if referenced by active rental items locally
    const items = await getAllFromLocal("rental_items");
    const isReferenced = items?.some(
      (ri: any) => ri.equipment_id === id && !ri.return_date
    );
    if (isReferenced) {
      throw new Error("لا يمكن حذف المعدة لوجود بنود إيجار نشطة مرتبطة بها");
    }

    await deleteFromLocal("equipment", id);
    setEquipment((prev) => prev.filter((e) => e.id !== id));
  };

  return {
    equipment,
    isLoading,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    refresh: loadEquipment,
  };
}
