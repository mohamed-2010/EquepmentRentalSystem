import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  saveToLocal,
  getAllFromLocal,
  getFromLocal,
  deleteFromLocal,
} from "./db";
import { addToQueue } from "./queue";
import { toast } from "sonner";
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
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      if (isOnline) {
        // Online: جلب من Supabase
        try {
          let query = supabase.from(table as any).select(select);

          if (filter) {
            Object.entries(filter).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }

          if (orderBy) {
            query = query.order(orderBy.column, {
              ascending: orderBy.ascending ?? true,
            });
          }

          const { data, error } = await query;

          if (error) throw error;

          // حفظ في IndexedDB
          if (data) {
            for (const item of data) {
              await saveToLocal(table as any, {
                ...(item as Record<string, any>),
                synced: true,
              });
            }
          }

          return (data as T[]) || [];
        } catch (error) {
          console.error("Online fetch failed, falling back to local:", error);
          // في حالة فشل الاتصال، استخدم البيانات المحلية
          return await getAllFromLocal(table as any);
        }
      } else {
        // Offline: جلب من IndexedDB
        return await getAllFromLocal(table as any);
      }
    },
    enabled,
    staleTime: isOnline ? 1000 * 60 : Infinity, // إذا offline، البيانات لا تصبح قديمة
    gcTime: Infinity, // احتفظ بالبيانات في الكاش دائماً
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
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async (data: any) => {
      const itemWithId =
        operation === "insert" && !data.id ? { ...data, id: uuidv4() } : data;

      if (isOnline) {
        // Online: حفظ مباشرة في Supabase
        try {
          let result;
          switch (operation) {
            case "insert":
              const { data: insertData, error: insertError } = await supabase
                .from(table as any)
                .insert(itemWithId)
                .select()
                .single();
              if (insertError) throw insertError;
              result = insertData;
              break;

            case "update":
              const { data: updateData, error: updateError } = await supabase
                .from(table as any)
                .update(data)
                .eq("id", data.id)
                .select()
                .single();
              if (updateError) throw updateError;
              result = updateData;
              break;

            case "delete":
              const { error: deleteError } = await supabase
                .from(table as any)
                .delete()
                .eq("id", data.id);
              if (deleteError) throw deleteError;
              result = data;
              break;
          }

          // حفظ في IndexedDB أيضاً
          if (operation === "delete") {
            await deleteFromLocal(table as any, data.id);
          } else {
            await saveToLocal(table as any, { ...result, synced: true });
          }

          return result;
        } catch (error: any) {
          console.error("Online mutation failed, queuing for later:", error);
          // إذا فشل الاتصال، أضف للـ queue
          await addToQueue(table as any, operation, itemWithId);

          if (operation === "delete") {
            await deleteFromLocal(table as any, itemWithId.id);
          } else {
            await saveToLocal(table as any, { ...itemWithId, synced: false });
          }

          toast.info(
            "تم حفظ العملية محلياً، سيتم المزامنة عند الاتصال بالإنترنت"
          );
          return itemWithId;
        }
      } else {
        // Offline: حفظ في IndexedDB وqueue
        await addToQueue(table as any, operation, itemWithId);

        if (operation === "delete") {
          await deleteFromLocal(table as any, itemWithId.id);
        } else {
          await saveToLocal(table as any, { ...itemWithId, synced: false });
        }

        toast.info("لا يوجد اتصال بالإنترنت، تم حفظ العملية محلياً");
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
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: [table, id],
    queryFn: async (): Promise<T | null> => {
      if (!id) return null;

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from(table as any)
            .select(select)
            .eq("id", id)
            .single();

          if (error) throw error;

          // حفظ في IndexedDB
          if (data) {
            await saveToLocal(table as any, {
              ...(data as Record<string, any>),
              synced: true,
            });
          }

          return data as T;
        } catch (error) {
          console.error("Online fetch failed, falling back to local:", error);
          return await getFromLocal(table as any, id);
        }
      } else {
        return await getFromLocal(table as any, id);
      }
    },
    enabled: !!id,
    staleTime: isOnline ? 1000 * 60 : Infinity,
    gcTime: Infinity,
  });
}
