import {
  useQuery as useReactQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getAllFromLocal } from "./offline/db";

type TableName =
  | "customers"
  | "equipment"
  | "rentals"
  | "rental_items"
  | "branches";

interface OfflineQueryOptions {
  tableName?: TableName;
  offlineData?: any[];
}

/**
 * Enhanced useQuery that automatically handles offline mode
 * Will use IndexedDB when offline and Supabase when online
 */
export function useQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError> & OfflineQueryOptions
): UseQueryResult<TData, TError> {
  const isOnline = useOnlineStatus();
  const { tableName, offlineData, queryFn, ...restOptions } = options;

  // Modify query function to handle offline mode
  const enhancedQueryFn = async () => {
    // If online, use the provided queryFn
    if (isOnline && queryFn && typeof queryFn === "function") {
      return await queryFn({} as any);
    }

    // If offline
    if (!isOnline) {
      // If offlineData provided, use it
      if (offlineData !== undefined) {
        console.log("[useQuery] Using provided offline data");
        return offlineData as TData;
      }

      // If tableName provided, fetch from IndexedDB
      if (tableName) {
        console.log(`[useQuery] Fetching from IndexedDB: ${tableName}`);
        const data = await getAllFromLocal(tableName);
        return data as TData;
      }

      // If queryFn exists, try it (might work offline if it doesn't hit network)
      if (queryFn && typeof queryFn === "function") {
        try {
          return await queryFn({} as any);
        } catch (error) {
          console.warn(
            "[useQuery] Query failed offline, returning empty array"
          );
          return [] as TData;
        }
      }
    }

    return [] as TData;
  };

  return useReactQuery({
    ...restOptions,
    queryFn: enhancedQueryFn,
    // Cache data indefinitely in offline mode
    staleTime: isOnline ? restOptions.staleTime : Infinity,
    gcTime: isOnline ? restOptions.gcTime : Infinity,
    // Disable refetch when offline
    refetchOnWindowFocus:
      isOnline && restOptions.refetchOnWindowFocus !== false,
    refetchOnReconnect: isOnline && restOptions.refetchOnReconnect !== false,
    refetchOnMount: isOnline && restOptions.refetchOnMount !== false,
  });
}
