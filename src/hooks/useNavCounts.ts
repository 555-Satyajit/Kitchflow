'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNavCountsAction, NavCountsResult } from '@/features/orders/order-actions';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDeviceUuid } from '@/lib/utils';

export const NAV_COUNTS_QUERY_KEY = ['nav-counts'] as const;

export function useNavCounts(kitchenId?: string, initialData?: NavCountsResult | null) {
  const queryClient = useQueryClient();
  const effectiveKitchenId = kitchenId && kitchenId !== 'default' ? kitchenId : undefined;

  const query = useQuery({
    queryKey: [...NAV_COUNTS_QUERY_KEY, effectiveKitchenId || 'all'],
    queryFn: async (): Promise<NavCountsResult> => {
      const res = await getNavCountsAction(effectiveKitchenId);
      if (!res.ok) {
        throw new Error(res.error || 'Failed fetching nav counts');
      }
      try {
        localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(res.data));
      } catch {}
      return res.data;
    },
    initialData: () => {
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('kitchflow_nav_counts_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed.ordersCount === 'number') return parsed;
          }
        } catch {}
      }
      if (initialData) return initialData;
      return undefined;
    },
    staleTime: 4000,
    refetchInterval: 12000, // 12s passive polling fallback
  });

  // Track processed event IDs to prevent duplicate delta processing
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Supabase Realtime: Invalidate TanStack Query whenever ANY order changes in Postgres OR broadcast arrives
  useEffect(() => {
    const supabase = createClient();
    const kid = effectiveKitchenId || 'all';
    const myDeviceUuid = getDeviceUuid();

    // Tenant-isolated broadcast channel
    const broadcastChannelName = kid === 'all' ? 'kitchen-all-counters' : `kitchen-${kid}-counters`;
    // Dedicated postgres_changes channel
    const postgresChannelName = `pg-orders-${kid}-${Math.random().toString(36).substring(2, 9)}`;

    const onCounterDelta = ({ payload }: any) => {
      // Loopback protection: local optimistic mutation already updated the sender device
      if (payload?.senderId && payload.senderId === myDeviceUuid) {
        return;
      }

      // Idempotency guard: prevent duplicate delta processing if received across multiple channels
      if (payload?.eventId) {
        if (processedEventsRef.current.has(payload.eventId)) {
          return;
        }
        processedEventsRef.current.add(payload.eventId);
        if (processedEventsRef.current.size > 200) {
          const first = processedEventsRef.current.values().next().value;
          if (first) processedEventsRef.current.delete(first);
        }
      }

      if (payload?.action?.type) {
        queryClient.setQueriesData({ queryKey: NAV_COUNTS_QUERY_KEY }, (prevCounts: any) => {
          let current = prevCounts;
          if (!current && typeof window !== 'undefined') {
            try {
              const cached = localStorage.getItem('kitchflow_nav_counts_cache');
              if (cached) current = JSON.parse(cached);
            } catch {}
          }
          if (!current) return current;
          const updated = { ...current };
          switch (payload.action.type) {
            case 'ORDER_PUNCHED':
              updated.ordersCount += 1;
              updated.kdsCount += 1;
              break;
            case 'KDS_START_COOKING':
              updated.packingCount += 1;
              break;
            case 'KDS_COMPLETE':
              // Order leaves KDS cook screen.
              // Note: Do NOT increment packingCount because in KitchFlow, Dispatch already lists PREPARING orders.
              updated.kdsCount = Math.max(0, updated.kdsCount - 1);
              break;
            case 'DISPATCH_COMPLETE':
              updated.ordersCount = Math.max(0, updated.ordersCount - 1);
              updated.packingCount = Math.max(0, updated.packingCount - 1);
              break;
          }
          try {
            localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(updated));
            window.dispatchEvent(new Event('kitchflow_nav_counts_updated'));
          } catch {}
          return updated;
        });
      }
    };

    const broadcastChannel = supabase
      .channel(broadcastChannelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'nav_counter_delta' }, onCounterDelta)
      .subscribe();

    const globalBroadcastChannel = kid !== 'all' ? supabase
      .channel('kitchen-all-counters', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'nav_counter_delta' }, onCounterDelta)
      .subscribe() : null;

    const postgresChannel = supabase
      .channel(postgresChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Authoritative DB sync ONLY after transaction is committed to PostgreSQL WAL
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      if (globalBroadcastChannel) {
        supabase.removeChannel(globalBroadcastChannel);
      }
      supabase.removeChannel(postgresChannel);
    };
  }, [effectiveKitchenId, queryClient]);

  return query;
}

