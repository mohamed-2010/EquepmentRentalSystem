import { useState, useEffect, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  saveToLocal,
  getAllFromLocal,
  RentalData,
  RentalItemData,
} from "@/lib/offline/db";
import { addToQueue } from "@/lib/offline/queue";
import { v4 as uuidv4 } from "uuid";

export function useOfflineRentals() {
  const [rentals, setRentals] = useState<any[]>([]);
  const [rentalItems, setRentalItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const previousOnlineStatus = useRef(isOnline);

  useEffect(() => {
    loadRentals();
  }, []);

  // Load from server only when transitioning to online
  useEffect(() => {
    const wasOffline = !previousOnlineStatus.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      console.log("🌐 Connection restored, reloading rentals...");
      loadRentals();
    }

    previousOnlineStatus.current = isOnline;
  }, [isOnline]);

  const loadRentals = async () => {
    setIsLoading(true);
    try {
      // Always load from local first for instant display
      await loadRentalsFromLocal();
      await loadRentalItemsFromLocal();
      setIsLoading(false);

      // Then fetch from backend if online
      if (isOnline) {
        try {
          // تحميل من Supabase
          const { data: rentalsData, error: rentalsError } = await supabase
            .from("rentals")
            .select(
              `
              *,
              customers(full_name, phone),
              branches(name, address, phone)
            `
            )
            .order("created_at", { ascending: false });

          const { data: itemsData, error: itemsError } = await supabase.from(
            "rental_items"
          ).select(`
              *,
              equipment(name, code, daily_rate)
            `);

          if (!rentalsError && rentalsData) {
            // حفظ في IndexedDB
            for (const rental of rentalsData) {
              await saveToLocal("rentals", {
                ...rental,
                synced: true,
              });
            }
            setRentals(rentalsData);
          }

          if (!itemsError && itemsData) {
            for (const item of itemsData) {
              await saveToLocal("rental_items", {
                ...item,
                synced: true,
              });
            }
            setRentalItems(itemsData);
          }
        } catch (error) {
          console.error("Error fetching rentals from server:", error);
        }
      }
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
            ? { full_name: customer.full_name, phone: customer.phone }
            : null,
          branches: branch ? { name: branch.name } : null,
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

    // احصل على المستخدم الحالي (لملء created_by المطلوب من Supabase)
    let currentUserId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      currentUserId = data.user?.id || null;
    } catch (e) {
      console.warn("Failed to get current user id", e);
      // حاول من localStorage (وضع offline)
      try {
        const offlineUserRaw = localStorage.getItem("supabase.auth.user");
        if (offlineUserRaw) {
          currentUserId = JSON.parse(offlineUserRaw).id;
        }
      } catch {}
    }
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

    // إذا كان online، حاول الحفظ في Supabase أولاً
    if (isOnline) {
      try {
        const { data: rental, error: rentalError } = await supabase
          .from("rentals")
          .insert({
            id: rentalId,
            customer_id: rentalData.customer_id,
            equipment_id: primaryEquipmentId,
            branch_id: rentalData.branch_id,
            created_by: currentUserId,
            start_date: startDate,
            status: "active",
            rental_type: rentalData.rental_type,
            is_fixed_duration: rentalData.is_fixed_duration,
            expected_end_date: rentalData.is_fixed_duration
              ? rentalData.expected_end_date
              : null,
            deposit_amount: rentalData.deposit_amount || 0,
          })
          .select()
          .single();

        if (rentalError) throw rentalError;

        if (rental) {
          // استخدم ID من Supabase
          newRental.id = rental.id;
          newRental.synced = true;

          // حفظ عناصر الإيجار في Supabase
          const itemsToInsert = normalizedItems.map((item) => ({
            rental_id: rental.id,
            equipment_id: item.equipment_id,
            start_date: startDate,
            quantity: item.quantity || 1,
            notes: item.notes || null,
          }));

          const { data: insertedItems } = await supabase
            .from("rental_items")
            .insert(itemsToInsert)
            .select();

          // تحديث حالة المعدات في Supabase (مع تجاهل العناصر غير الصالحة)
          for (const item of normalizedItems) {
            if (!item.equipment_id) continue;
            await supabase
              .from("equipment")
              .update({ status: "rented" })
              .eq("id", item.equipment_id);
          }

          // حفظ في IndexedDB مع synced=true
          await saveToLocal("rentals", newRental);

          // Get equipment data for enrichment
          const equipment = await getAllFromLocal("equipment");
          const enrichedItems = [];

          // حفظ عناصر الإيجار في IndexedDB
          if (insertedItems) {
            for (const item of insertedItems) {
              const rentalItem: RentalItemData = {
                ...item,
                synced: true,
              };

              await saveToLocal("rental_items", rentalItem);

              // Enrich rental item with equipment data
              const equip = equipment?.find(
                (e: any) => e.id === item.equipment_id
              );
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

              // تحديث حالة المعدة في IndexedDB
              const equipmentToUpdate = equipment.find(
                (e: any) => e.id === item.equipment_id
              );
              if (equipmentToUpdate) {
                const updatedEquipment = {
                  ...equipmentToUpdate,
                  status: "rented",
                  updated_at: new Date().toISOString(),
                  synced: true,
                };
                await saveToLocal("equipment", updatedEquipment);
              }
            }
          }

          // Enrich rental with customer and branch data
          const customers = await getAllFromLocal("customers");
          const branches = await getAllFromLocal("branches");

          const customer = customers?.find(
            (c: any) => c.id === rentalData.customer_id
          );
          const branch = branches?.find(
            (b: any) => b.id === rentalData.branch_id
          );

          const enrichedRental = {
            ...newRental,
            customers: customer
              ? { full_name: customer.full_name, phone: customer.phone }
              : null,
            branches: branch ? { name: branch.name } : null,
          };

          setRentals((prev) => [enrichedRental, ...prev]);
          setRentalItems((prev) => [...enrichedItems, ...prev]);

          return enrichedRental;
        }
      } catch (error) {
        console.error(
          "Error syncing rental to Supabase, falling back to offline mode:",
          error
        );
        // إذا فشل الحفظ في Supabase، استمر في الوضع offline
      }
    }

    // الوضع Offline أو فشل الحفظ في Supabase
    // حفظ الإيجار محلياً
    await saveToLocal("rentals", newRental);
    await addToQueue("rentals", "insert", newRental);

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
      await addToQueue("rental_items", "insert", rentalItem);

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
        await addToQueue("equipment", "update", updatedEquipment);
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
        ? { full_name: customer.full_name, phone: customer.phone }
        : null,
      branches: branch ? { name: branch.name } : null,
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
      await addToQueue("rental_items", "update", updatedItem);
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
        await addToQueue("equipment", "update", updatedEquipment);
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
    await addToQueue("rentals", "update", updatedRental);

    // تحديث في Supabase إن أمكن (اختياري/أفضلية)
    if (isOnline) {
      try {
        await supabase
          .from("rentals")
          .update({
            status: "completed",
            end_date: returnDate,
            total_amount: total,
          })
          .eq("id", rentalId);

        for (const ui of updatedItems) {
          await supabase
            .from("rental_items")
            .update({
              return_date: ui.return_date,
              days_count: ui.days_count,
              amount: ui.amount,
            })
            .eq("id", ui.id);
          await supabase
            .from("equipment")
            .update({ status: "available" })
            .eq("id", ui.equipment_id);
        }
        updatedRental.synced = true;
        await saveToLocal("rentals", updatedRental);
      } catch (e) {
        console.error("Error syncing full return:", e);
      }
    }

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
    await addToQueue("rental_items", "update", updatedItem);

    // تحديث حالة المعدة
    if (equip) {
      const updatedEquipment = {
        ...equip,
        status: "available",
        updated_at: new Date().toISOString(),
        synced: false,
      };
      await saveToLocal("equipment", updatedEquipment);
      await addToQueue("equipment", "update", updatedEquipment);
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
      await addToQueue("rentals", "update", updatedRental);
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

    // تزامن فوري اختياري عند الاتصال
    if (isOnline) {
      try {
        await supabase
          .from("rental_items")
          .update({
            return_date: updatedItem.return_date,
            days_count: updatedItem.days_count,
            amount: updatedItem.amount,
          })
          .eq("id", updatedItem.id);
        if (equip) {
          await supabase
            .from("equipment")
            .update({ status: "available" })
            .eq("id", equip.id);
        }
        if (allReturned) {
          await supabase
            .from("rentals")
            .update({
              status: "completed",
              end_date: updatedRental.end_date,
              total_amount: updatedRental.total_amount,
            })
            .eq("id", updatedRental.id);
        }
      } catch (e) {
        console.error("Error syncing item return:", e);
      }
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
    await addToQueue("rentals", "update", updated);

    setRentals((prev) => prev.map((r) => (r.id === rentalId ? updated : r)));

    if (isOnline) {
      try {
        await supabase
          .from("rentals")
          .update(data as any)
          .eq("id", rentalId);
      } catch (e) {
        console.error("Error syncing rental update:", e);
      }
    }

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
          await addToQueue("equipment", "update", updatedEquipment);
        }
      }
    }

    // Delete items locally and queue deletes BEFORE deleting rental
    for (const it of items) {
      await addToQueue("rental_items", "delete", { id: it.id });
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

    await addToQueue("rentals", "delete", { id: rentalId });
    try {
      const { deleteFromLocal } = await import("@/lib/offline/db");
      await deleteFromLocal("rentals", rentalId);
    } catch (e) {
      console.warn("Failed to delete rental locally", rentalId, e);
    }

    // Update in-memory state
    setRentalItems((prev) => prev.filter((i) => i.rental_id !== rentalId));
    setRentals((prev) => prev.filter((r) => r.id !== rentalId));

    // Best-effort online delete in correct order (child rows first)
    if (isOnline) {
      try {
        // delete child rows first
        for (const it of items) {
          await supabase.from("rental_items").delete().eq("id", it.id);
        }
        await supabase.from("rentals").delete().eq("id", rentalId);
      } catch (e) {
        console.error("Error syncing rental delete:", e);
      }
    }

    // If online and we queued deletes (in case online delete failed), try to sync now
    if (isOnline) {
      try {
        await (await import("@/lib/offline/sync")).syncWithBackend();
      } catch {}
    }
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
