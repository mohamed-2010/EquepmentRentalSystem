import { useState, useEffect } from "react";
import {
  saveToLocal,
  getAllFromLocal,
  deleteFromLocal,
  CustomerData,
} from "@/lib/offline/db";
import { v4 as uuidv4 } from "uuid";

export function useOfflineCustomers(searchQuery: string = "") {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      // Always load from local first for instant display
      const localCustomers = await getAllFromLocal("customers");
      let filtered = localCustomers as CustomerData[];

      if (searchQuery) {
        filtered = filtered.filter(
          (customer) =>
            customer.full_name
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            customer.phone.includes(searchQuery) ||
            (customer.id_number && customer.id_number.includes(searchQuery))
        );
      }

      setCustomers(filtered);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading customers:", error);
      setIsLoading(false);
    }
  };

  const loadFromLocal = async () => {
    const localCustomers = await getAllFromLocal("customers");
    let filtered = localCustomers as CustomerData[];

    if (searchQuery) {
      filtered = filtered.filter(
        (customer) =>
          customer.full_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery) ||
          (customer.id_number && customer.id_number.includes(searchQuery))
      );
    }

    setCustomers(filtered);
  };

  const addCustomer = async (
    data: Omit<CustomerData, "id" | "created_at" | "updated_at" | "synced">
  ) => {
    const newCustomer: CustomerData = {
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    // Save to local and refresh list
    await saveToLocal("customers", newCustomer);
    await loadFromLocal();

    return newCustomer;
  };

  const updateCustomer = async (id: string, data: Partial<CustomerData>) => {
    const existing = customers.find((c) => c.id === id);
    if (!existing) return;

    const updated: CustomerData = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await saveToLocal("customers", updated);
    // optimistic update
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteCustomer = async (id: string) => {
    // prevent deleting if there are rentals referencing this customer locally
    const rentals = await getAllFromLocal("rentals");
    const hasRentals = rentals?.some((r: any) => r.customer_id === id);
    if (hasRentals) {
      throw new Error("لا يمكن حذف العميل لوجود إيجارات مرتبطة به");
    }

    const existing = customers.find((c) => c.id === id);
    if (!existing) return;

    // Local-only delete
    await deleteFromLocal("customers", id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  return {
    customers,
    isLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refresh: loadCustomers,
  };
}
