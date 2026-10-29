'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Order, PackingChecklist } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { getDeviceUuid } from '@/lib/utils';
import { broadcastKitchenEvent } from '@/lib/supabase/realtime-bus';
import { 
  fetchPackingOrdersClientAction, 
  toggleChecklistItemAction, 
  completePackingAction 
} from '@/features/packing/packing-actions';
import { NAV_COUNTS_QUERY_KEY } from '@/hooks/useNavCounts';
import { useOutlets } from '@/hooks/useOutlets';

export const PACKING_ORDERS_QUERY_KEY = ['packing-orders'] as const;

export function usePackingOrders(kitchenId?: string, initialOrders: Order[] = []) {
  const queryClient = useQueryClient();
  const { activeOutletId } = useOutlets();
  const effectiveKitchenId = (activeOutletId || kitchenId) && (activeOutletId || kitchenId) !== 'default' ? (activeOutletId || kitchenId) : undefined;
  const queryKey = [...PACKING_ORDERS_QUERY_KEY, effectiveKitchenId || 'all'];

  // 1. Authoritative Packing Query
  const query = useQuery<Order[]>({
    queryKey,
    queryFn: async (): Promise<Order[]> => {
      let targetId = effectiveKitchenId;
      if (!targetId && typeof window !== 'undefined') {
        const stored = localStorage.getItem('kitchflow_active_kitchen_id');
        if (stored) targetId = stored;
      }
      const raw = await fetchPackingOrdersClientAction(targetId);
      if (!Array.isArray(raw)) return [];
      return (raw as Order[]).filter(
        (o) => o.status === 'PREPARING' || o.status === 'READY'
      );
    },
    initialData: initialOrders.filter(
      (o) => o.status === 'PREPARING' || o.status === 'READY'
    ),
    staleTime: 4000,
    refetchInterval: 15000, // 15s passive background polling
  });

  // 2. Realtime Event Listener & Cache Synchronization
  useEffect(() => {
    const supabase = createClient();
    const myDeviceUuid = getDeviceUuid();
    const kid = effectiveKitchenId || 'all';
    const packingChannelName = kid === 'all' ? 'kitchen-global-packing' : `kitchen-${kid}-packing`;
    const ordersChannelName = kid === 'all' ? 'kitchen-all-orders' : `kitchen-${kid}-orders`;

    const channel = supabase
      .channel(packingChannelName, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'packing_checklist_toggled' }, ({ payload }) => {
        if (!payload?.orderId || !payload?.key) return;
        if (payload.senderId && payload.senderId === myDeviceUuid) return;

        queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
          prev.map((o) => {
            if (o.id !== payload.orderId) return o;
            return {
              ...o,
              version: typeof payload.version === 'number' ? payload.version : (o.version ?? 0) + 1,
              checklist: {
                ...o.checklist,
                [payload.key]: payload.checked,
              },
            };
          })
        );
      })
      .on('broadcast', { event: 'order_status_changed' }, ({ payload }) => {
        if (!payload?.orderId) return;
        if (payload.status === 'READY') {
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) => {
            const exists = prev.some((o) => o.id === payload.orderId);
            if (!exists) {
              queryClient.invalidateQueries({ queryKey });
              return prev;
            }
            return prev.map((o) =>
              o.id === payload.orderId
                ? { ...o, status: 'READY', readyAt: payload.timestamp || new Date().toISOString() }
                : o
            );
          });
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        } else if (payload.status === 'DISPATCHED' || payload.status === 'CANCELLED') {
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
            prev.filter((o) => o.id !== payload.orderId)
          );
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        }
      })
      .on('broadcast', { event: 'order_dispatched' }, ({ payload }) => {
        if (!payload?.orderId) return;
        queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
          prev.filter((o) => o.id !== payload.orderId)
        );
        queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
      })
      .on('broadcast', { event: 'nav_counter_delta' }, () => {
        queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
      })
      .subscribe();

    const ordersChannel = supabase
      .channel(ordersChannelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'order_status_changed' }, ({ payload }) => {
        if (!payload?.orderId) return;
        if (payload.status === 'READY') {
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) => {
            const exists = prev.some((o) => o.id === payload.orderId);
            if (!exists) {
              queryClient.invalidateQueries({ queryKey });
              return prev;
            }
            return prev.map((o) =>
              o.id === payload.orderId
                ? { ...o, status: 'READY', readyAt: payload.timestamp || new Date().toISOString() }
                : o
            );
          });
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        } else if (payload.status === 'DISPATCHED' || payload.status === 'CANCELLED') {
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
            prev.filter((o) => o.id !== payload.orderId)
          );
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        }
      })
      .subscribe();

    const pgChannel = supabase
      .channel(`pg-packing-orders-${kid}-${myDeviceUuid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(pgChannel);
    };
  }, [effectiveKitchenId, queryClient, queryKey]);

  // 3. Optimistic Mutation: Toggle Checklist Item
  const toggleChecklistMutation = useMutation({
    mutationFn: async ({
      orderId,
      key,
      nextChecked,
      clientVersion,
    }: {
      orderId: string;
      key: keyof PackingChecklist;
      nextChecked: boolean;
      clientVersion: number;
    }) => {
      const res = await toggleChecklistItemAction({
        orderId,
        itemKey: key,
        kitchenId: effectiveKitchenId,
        targetChecked: nextChecked,
        clientVersion,
      });
      if (!res.ok) throw new Error(res.error || 'Failed toggling checklist item');
      return res.data;
    },
    onMutate: async ({ orderId, key, nextChecked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<Order[]>(queryKey);

      // Instant optimistic update
      queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            version: (o.version ?? 0) + 1,
            checklist: {
              ...o.checklist,
              [key]: nextChecked,
            },
          };
        })
      );

      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData<Order[]>(queryKey, context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Optimistic Mutation: Complete Packing & Dispatch
  const completePackingMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await completePackingAction({ orderId, kitchenId: effectiveKitchenId });
      if (!res.ok) throw new Error(res.error || 'Failed completing packing dispatch');
      return res;
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<Order[]>(queryKey);

      // Instantly remove ticket from Packing queue
      queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
        prev.filter((o) => o.id !== orderId)
      );

      // Instantly update badge counts on all active query caches (both Orders count and Dispatch count decrement by 1)
      queryClient.setQueriesData({ queryKey: NAV_COUNTS_QUERY_KEY }, (prevCounts: any) => {
        let current = prevCounts;
        if (!current && typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('kitchflow_nav_counts_cache');
            if (cached) current = JSON.parse(cached);
          } catch {}
        }
        if (!current) return current;
        const updated = {
          ...current,
          ordersCount: Math.max(0, current.ordersCount - 1),
          packingCount: Math.max(0, current.packingCount - 1),
        };
        try {
          localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(updated));
          window.dispatchEvent(new Event('kitchflow_nav_counts_updated'));
        } catch {}
        return updated;
      });

      // Broadcast instant inter-station delta to all other devices on the kitchen LAN
      try {
        const kid = effectiveKitchenId || 'all';
        const senderId = getDeviceUuid();
        const channelName = kid && kid !== 'all' ? `kitchen-${kid}-counters` : 'kitchen-all-counters';
        broadcastKitchenEvent(channelName, 'nav_counter_delta', {
          action: { type: 'DISPATCH_COMPLETE' },
          eventId: `DISPATCH_COMPLETE-${orderId}`,
          senderId,
        });
      } catch {}

      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData<Order[]>(queryKey, context.previousOrders);
      }
      queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
    },
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    toggleChecklistItem: toggleChecklistMutation.mutate,
    completePacking: completePackingMutation.mutate,
    refetch: query.refetch,
  };
}

