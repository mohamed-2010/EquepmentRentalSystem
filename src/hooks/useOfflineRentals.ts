import { useState, useEffect } from "react";
import {
  saveToLocal,
  getAllFromLocal,
  RentalData,
  RentalItemData,
} from "@/lib/offline/db";
import { v4 as uuidv4 } from "uuid";

export function useOfflineRentals() {
  const [rentals, setRentals] = useState<any[]>([]);
  const [rentalItems, setRentalItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRentals();
  }, []);

  const loadRentals = async () => {
    setIsLoading(true);
    try {
      // Always load from local first for instant display
      await loadRentalsFromLocal();
      await loadRentalItemsFromLocal();
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading rentals:", error);
      setIsLoading(false);
    }
  };

  const loadRentalsFromLocal = async () => {
    const localRentals = await getAllFromLocal("rentals");
    const customers = await getAllFromLocal("customers");
    const branches = await getAllFromLocal("branches");

    // دمج البيانات المرتبطة
    const enrichedRentals =
      localRentals?.map((rental: any) => {
        const customer = customers?.find(
          (c: any) => c.id === rental.customer_id
        );
        const branch = branches?.find((b: any) => b.id === rental.branch_id);

        return {
          ...rental,
          customers: customer
            ? {
                full_name: customer.full_name,
                phone: customer.phone,
                id_number: customer.id_number,
                id_source: customer.id_source,
              }
            : null,
          branches: branch
            ? {
                name: branch.name,
                phone: branch.phone,
                company_name: branch.company_name,
              }
            : null,
        };
      }) || [];

    setRentals(enrichedRentals);
  };

  const loadRentalItemsFromLocal = async () => {
    const localItems = await getAllFromLocal("rental_items");
    const equipment = await getAllFromLocal("equipment");

    // دمج بيانات المعدات
    const enrichedItems =
      localItems?.map((item: any) => {
        const equip = equipment?.find((e: any) => e.id === item.equipment_id);

        return {
          ...item,
          equipment: equip
            ? {
                name: equip.name,
                code: equip.code,
                daily_rate: equip.daily_rate,
              }
            : null,
        };
      }) || [];

    setRentalItems(enrichedItems);
  };

  const daysBetween = (start: string, end: string) => {
    const startDate = new Date(
      start + (start.length === 10 ? "T00:00:00" : "")
    );
    const endDate = new Date(end + (end.length === 10 ? "T00:00:00" : ""));
    const msPerDay = 1000 * 60 * 60 * 24;
    const diff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / msPerDay
    );
    return Math.max(1, diff); // على الأقل يوم واحد
  };

  const computeItemCharge = (
    item: RentalItemData,
    rental: any,
    equipmentRate: number
  ) => {
    if (!item.return_date) return { days: 0, amount: 0 };
    const quantity = item.quantity || 1; // الكمية
    if (rental.rental_type === "monthly") {
      const days = daysBetween(item.start_date, item.return_date);
      const months = Math.max(1, Math.ceil(days / 30));
      return { days: months, amount: months * (equipmentRate || 0) * quantity };
    } else {
      const days = daysBetween(item.start_date, item.return_date);
      return { days, amount: days * (equipmentRate || 0) * quantity };
    }
  };

  const createRental = async (rentalData: any, equipmentItems: any[]) => {
    const rentalId = uuidv4();
    // طبيع شكل عناصر المعدات لتكون equipment_id بدل equipmentId
    const normalizedItems = (equipmentItems || [])
      .map((it) => ({
        equipment_id: it.equipment_id || it.equipmentId,
        quantity: it.quantity || 1,
        notes: it.notes || null,
        start_date: it.start_date,
      }))
      .filter((it) => !!it.equipment_id);

    // استخدم أول معدة كمرجع لـ equipment_id في جدول rentals (مطلوب حالياً في المخطط)
    const primaryEquipmentId = normalizedItems[0]?.equipment_id;
    if (!primaryEquipmentId) {
      throw new Error(
        "لا توجد معدة رئيسية، تأكد من اختيار معدة واحدة على الأقل."
      );
    }

    // احصل على المستخدم الحالي من التخزين المحلي (وضع Offline فقط)
    let currentUserId: string | null = null;
    try {
      const offlineUserRaw = sessionStorage.getItem("offline_session");
      if (offlineUserRaw) {
        currentUserId = JSON.parse(offlineUserRaw).id;
      } else {
        const cachedUser = localStorage.getItem("offline.user");
        if (cachedUser) currentUserId = JSON.parse(cachedUser).id;
      }
    } catch {}
    if (!currentUserId) {
      // للسماح بالعمل أوفلاين خالي، استخدم معرف وهمي ثابت؛ سيمنع الإدخال الأونلاين لكنه يحفظ محلياً بدون تعطل
      currentUserId = "offline-user";
    }

    // تأكد من وجود start_date وإلا استخدم تاريخ اليوم
    const startDate =
      rentalData.start_date || new Date().toISOString().split("T")[0];
    const newRental: RentalData = {
      ...rentalData,
      id: rentalId,
      start_date: startDate,
      equipment_id: primaryEquipmentId,
      created_by: currentUserId,
      deposit_amount: rentalData.deposit_amount || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    } as any; // casting لأن RentalData في المخطط الأصلي كان يحتوي الحقول الإضافية الإلزامية

    // الوضع Offline فقط
    // حفظ الإيجار محلياً
    await saveToLocal("rentals", newRental);

    // Get equipment data once for enrichment
    const equipment = await getAllFromLocal("equipment");
    const enrichedItems = [];

    // حفظ عناصر الإيجار
    for (const item of normalizedItems) {
      const rentalItem: RentalItemData = {
        id: uuidv4(),
        rental_id: rentalId,
        equipment_id: item.equipment_id,
        start_date: item.start_date || startDate,
        quantity: item.quantity || 1,
        notes: item.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false,
      };

      await saveToLocal("rental_items", rentalItem);

      // Enrich rental item with equipment data
      const equip = equipment?.find((e: any) => e.id === item.equipment_id);
      enrichedItems.push({
        ...rentalItem,
        equipment: equip
          ? {
              name: equip.name,
              code: equip.code,
              daily_rate: equip.daily_rate,
            }
          : null,
      });

      // تحديث حالة المعدة
      const equipmentToUpdate = equipment.find(
        (e: any) => e.id === item.equipment_id
      );
      if (equipmentToUpdate) {
        const updatedEquipment = {
          ...equipmentToUpdate,
          status: "rented",
          updated_at: new Date().toISOString(),
          synced: false,
        };
        await saveToLocal("equipment", updatedEquipment);
      }
    }

    // Enrich rental with customer and branch data for immediate display
    const customers = await getAllFromLocal("customers");
    const branches = await getAllFromLocal("branches");

    const customer = customers?.find(
      (c: any) => c.id === rentalData.customer_id
    );
    const branch = branches?.find((b: any) => b.id === rentalData.branch_id);

    const enrichedRental = {
      ...newRental,
      customers: customer
        ? {
            full_name: customer.full_name,
            phone: customer.phone,
            id_number: customer.id_number,
            id_source: customer.id_source,
          }
        : null,
      branches: branch
        ? {
            name: branch.name,
            phone: branch.phone,
            company_name: branch.company_name,
          }
        : null,
    };

    // Update states immediately
    setRentals((prev) => [enrichedRental, ...prev]);
    setRentalItems((prev) => [...enrichedItems, ...prev]);

    return newRental;
  };

  const returnRental = async (rentalId: string, returnDate: string) => {
    const rental = rentals.find((r: any) => r.id === rentalId);
    if (!rental) return;

    const items = rentalItems.filter(
      (item: any) => item.rental_id === rentalId
    );
    const equipmentList = await getAllFromLocal("equipment");

    // حدّث كل عنصر بإرجاع كامل
    let total = 0;
    const updatedItems: any[] = [];
    for (const item of items) {
      const equip = equipmentList.find((e: any) => e.id === item.equipment_id);
      const updatedItem = {
        ...item,
        return_date: returnDate,
        updated_at: new Date().toISOString(),
        synced: false,
      } as any;
      const { days, amount } = computeItemCharge(
        updatedItem,
        rental,
        equip?.daily_rate || 0
      );
      updatedItem.days_count = days;
      updatedItem.amount = amount;
      total += amount;

      await saveToLocal("rental_items", updatedItem);
      updatedItems.push(updatedItem);

      // تحديث حالة المعدة
      if (equip) {
        const updatedEquipment = {
          ...equip,
          status: "available",
          updated_at: new Date().toISOString(),
          synced: false,
        };
        await saveToLocal("equipment", updatedEquipment);
      }
    }

    const updatedRental = {
      ...rental,
      status: "completed",
      end_date: returnDate,
      total_amount: total,
      updated_at: new Date().toISOString(),
      synced: false,
    };
    await saveToLocal("rentals", updatedRental);

    // تحديث الحالة محلياً
    setRentalItems((prev) =>
      prev.map((it) => {
        const ui = updatedItems.find((x) => x.id === it.id);
        return ui ? ui : it;
      })
    );
    setRentals((prev) =>
      prev.map((r) => (r.id === rentalId ? updatedRental : r))
    );

    return updatedRental;
  };

  const returnRentalItem = async (rentalItemId: string, returnDate: string) => {
    const item = rentalItems.find((i: any) => i.id === rentalItemId);
    if (!item) return null;
    const rental = rentals.find((r: any) => r.id === item.rental_id);
    if (!rental) return null;

    const equipmentList = await getAllFromLocal("equipment");
    const equip = equipmentList.find((e: any) => e.id === item.equipment_id);

    const updatedItem = {
      ...item,
      return_date: returnDate,
      updated_at: new Date().toISOString(),
      synced: false,
    } as any;
    const { days, amount } = computeItemCharge(
      updatedItem,
      rental,
      equip?.daily_rate || 0
    );
    updatedItem.days_count = days;
    updatedItem.amount = amount;

    await saveToLocal("rental_items", updatedItem);

    // تحديث حالة المعدة
    if (equip) {
      const updatedEquipment = {
        ...equip,
        status: "available",
        updated_at: new Date().toISOString(),
        synced: false,
      };
      await saveToLocal("equipment", updatedEquipment);
    }

    // هل كل العناصر تم إرجاعها؟
    const siblingItems = rentalItems.filter(
      (i: any) => i.rental_id === item.rental_id
    );
    const allReturned = siblingItems.every((i: any) =>
      i.id === rentalItemId ? true : !!i.return_date
    );

    let updatedRental = rental;
    if (allReturned) {
      // احسب الإجمالي
      const computedTotal = siblingItems.reduce((sum: number, si: any) => {
        const rate =
          equipmentList.find((e: any) => e.id === si.equipment_id)
            ?.daily_rate || 0;
        const retDate = si.id === rentalItemId ? returnDate : si.return_date;
        if (!retDate) return sum;
        const tmpItem = { ...si, return_date: retDate } as any;
        const { amount } = computeItemCharge(tmpItem, rental, rate);
        return sum + amount;
      }, 0);

      updatedRental = {
        ...rental,
        status: "completed",
        end_date: returnDate,
        total_amount: computedTotal,
        updated_at: new Date().toISOString(),
        synced: false,
      };
      await saveToLocal("rentals", updatedRental);
    }

    // تحديث الحالة محلياً
    setRentalItems((prev) =>
      prev.map((i) => (i.id === rentalItemId ? updatedItem : i))
    );
    if (allReturned) {
      const finalRental = updatedRental;
      setRentals((prev) =>
        prev.map((r) => (r.id === finalRental.id ? finalRental : r))
      );
    }

    return updatedItem;
  };

  const updateRental = async (rentalId: string, data: Partial<RentalData>) => {
    const existing = rentals.find((r: any) => r.id === rentalId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    } as any;

    await saveToLocal("rentals", updated);

    setRentals((prev) => prev.map((r) => (r.id === rentalId ? updated : r)));

    return updated;
  };

  const deleteRental = async (rentalId: string) => {
    const rental = rentals.find((r: any) => r.id === rentalId);
    if (!rental) return;

    // Collect related items
    const items = rentalItems.filter((i: any) => i.rental_id === rentalId);

    // For any active items, free equipment
    const equipmentList = await getAllFromLocal("equipment");
    for (const item of items) {
      if (!item.return_date) {
        const equip = equipmentList.find(
          (e: any) => e.id === item.equipment_id
        );
        if (equip) {
          const updatedEquipment = {
            ...equip,
            status: "available",
            updated_at: new Date().toISOString(),
            synced: false,
          };
          await saveToLocal("equipment", updatedEquipment);
        }
      }
    }

    // Delete items locally and queue deletes BEFORE deleting rental
    for (const it of items) {
      // delete locally from IndexedDB
      try {
        const { deleteFromLocal } = await import("@/lib/offline/db");
        await deleteFromLocal("rental_items", it.id);
      } catch (e) {
        console.warn("Failed to delete rental_item locally", it.id, e);
      }
    }

    // Remove from local IndexedDB stores
    // Remove rental items locally
    // We don't have direct bulk delete helper, state will be updated below

    try {
      const { deleteFromLocal } = await import("@/lib/offline/db");
      await deleteFromLocal("rentals", rentalId);
    } catch (e) {
      console.warn("Failed to delete rental locally", rentalId, e);
    }

    // Update in-memory state
    setRentalItems((prev) => prev.filter((i) => i.rental_id !== rentalId));
    setRentals((prev) => prev.filter((r) => r.id !== rentalId));

    // Offline-only: no online delete or syncing
  };

  return {
    rentals,
    rentalItems,
    isLoading,
    createRental,
    returnRental,
    returnRentalItem,
    updateRental,
    deleteRental,
    refresh: loadRentals,
  };
}
