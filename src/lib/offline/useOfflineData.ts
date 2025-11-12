import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveToLocal,
  getAllFromLocal,
  getFromLocal,
  deleteFromLocal,
} from "./db";
import { v4 as uuidv4 } from "uuid";

export interface UseOfflineQueryOptions<T> {
  queryKey: string[];
  table: string;
  select?: string;
  filter?: any;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
}

export interface UseOfflineMutationOptions<T> {
  table: string;
  operation: "insert" | "update" | "delete";
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook للقراءة من قاعدة البيانات مع دعم offline
 */
export function useOfflineQuery<T = any>({
  queryKey,
  table,
  select = "*",
  filter,
  orderBy,
  enabled = true,
}: UseOfflineQueryOptions<T>) {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      const all = (await getAllFromLocal(table as any)) as T[];
      let filtered = all;
      if (filter) {
        filtered = filtered.filter((item: any) =>
          Object.entries(filter).every(([k, v]) => item[k] === v)
        );
      }
      if (orderBy) {
        const asc = orderBy.ascending ?? true;
        filtered = [...filtered].sort((a: any, b: any) => {
          const av = a[orderBy.column];
          const bv = b[orderBy.column];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (av === bv) return 0;
          return (av < bv ? -1 : 1) * (asc ? 1 : -1);
        });
      }
      return filtered;
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Hook للكتابة إلى قاعدة البيانات مع دعم offline
 */
export function useOfflineMutation<T = any>({
  table,
  operation,
  onSuccess,
  onError,
}: UseOfflineMutationOptions<T>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const itemWithId =
        operation === "insert" && !data.id ? { ...data, id: uuidv4() } : data;

      // Offline-only mutation: save immediately to IndexedDB, no queue
      if (operation === "delete") {
        await deleteFromLocal(table as any, itemWithId.id);
        return itemWithId;
      } else {
        await saveToLocal(table as any, { ...itemWithId, synced: false });
        return itemWithId;
      }
    },
    onSuccess: (data) => {
      // تحديث الكاش
      queryClient.invalidateQueries({ queryKey: [table] });
      onSuccess?.(data as T);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

/**
 * Hook لجلب عنصر واحد بالـ ID
 */
export function useOfflineQueryById<T = any>(
  table: string,
  id: string | undefined,
  select = "*"
) {
  return useQuery({
    queryKey: [table, id],
    queryFn: async (): Promise<T | null> => {
      if (!id) return null;

      return await getFromLocal(table as any, id);
    },
    enabled: !!id,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
