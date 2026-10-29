'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Order, OrderStatus } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { playKitchenSound } from '@/lib/sound-engine';
import { getDeviceUuid } from '@/lib/utils';
import { broadcastKitchenEvent } from '@/lib/supabase/realtime-bus';
import { 
  getLatestOrdersSnapshotAction, 
  updateOrderStatusAction 
} from '@/features/orders/order-actions';
import { NAV_COUNTS_QUERY_KEY } from '@/hooks/useNavCounts';
import { PACKING_ORDERS_QUERY_KEY } from '@/features/packing/hooks/usePackingOrders';
import { KDS_ORDERS_QUERY_KEY } from '@/features/kds/hooks/useKdsOrders';
import { useOutlets } from '@/hooks/useOutlets';

export const LIVE_ORDERS_QUERY_KEY = ['live-orders'] as const;

export function useLiveOrders(kitchenId?: string, initialOrders: Order[] = []) {
  const queryClient = useQueryClient();
  const { activeOutletId } = useOutlets();
  const effectiveKitchenId = (activeOutletId || kitchenId) && (activeOutletId || kitchenId) !== 'default' ? (activeOutletId || kitchenId) : undefined;
  const queryKey = [...LIVE_ORDERS_QUERY_KEY, effectiveKitchenId || 'all'];

  // 1. Authoritative Live Orders Query
  const query = useQuery<Order[]>({
    queryKey,
    queryFn: async (): Promise<Order[]> => {
      let targetId = effectiveKitchenId;
      if (!targetId && typeof window !== 'undefined') {
        const stored = localStorage.getItem('kitchflow_active_kitchen_id');
        if (stored) targetId = stored;
      }
      const raw = await getLatestOrdersSnapshotAction(targetId);
      if (!Array.isArray(raw)) return [];
      return raw as Order[];
    },
    initialData: () => {
      // Only use SSR initialOrders if matching current effectiveKitchenId
      return initialOrders;
    },
    staleTime: 4000,
    refetchInterval: 15000, // 15s passive background polling
  });

  // 2. Realtime Event Listener & Cache Synchronization
  useEffect(() => {
    const supabase = createClient();
    const myDeviceUuid = getDeviceUuid();
    const kid = effectiveKitchenId || 'all';
    const ordersChannelName = kid === 'all' ? 'kitchen-all-orders' : `kitchen-${kid}-orders`;
    const postgresChannelName = `pg-live-orders-${kid}-${myDeviceUuid}`;

    // Dedicated broadcast channel
    const channel = supabase
      .channel(ordersChannelName, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'new_order_placed' }, ({ payload }) => {
        if (!payload?.order) {
          queryClient.invalidateQueries({ queryKey });
          return;
        }
        const incomingOrder = payload.order as Order;
        playKitchenSound('NEW_ORDER', 0.35);
        queryClient.setQueryData<Order[]>(queryKey, (prev = []) => {
          if (prev.some((o) => o.id === incomingOrder.id)) return prev;
          return [incomingOrder, ...prev];
        });
      })
      .on('broadcast', { event: 'order_status_changed' }, ({ payload }) => {
        if (!payload?.orderId || !payload?.status) return;
        if (payload.senderId && payload.senderId === myDeviceUuid) return;

        queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
          prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status } : o))
        );
      })
      .subscribe();

    const globalOrdersChannel = kid !== 'all' ? supabase
      .channel('kitchen-all-orders', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'new_order_placed' }, ({ payload }) => {
        if (!payload?.order) return;
        const incomingOrder = payload.order as Order;
        playKitchenSound('NEW_ORDER', 0.35);
        queryClient.setQueryData<Order[]>(queryKey, (prev = []) => {
          if (prev.some((o) => o.id === incomingOrder.id)) return prev;
          return [incomingOrder, ...prev];
        });
      })
      .on('broadcast', { event: 'order_status_changed' }, ({ payload }) => {
        if (!payload?.orderId || !payload?.status) return;
        if (payload.senderId && payload.senderId === myDeviceUuid) return;

        queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
          prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status } : o))
        );
      })
      .subscribe() : null;

    // Dedicated postgres_changes channel with unique topic
    const pgChannel = supabase
      .channel(postgresChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
          const changedOrder = payload?.new as Order | undefined;
          if (changedOrder?.id && payload?.eventType === 'UPDATE') {
            queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
              prev.map((o) => (o.id === changedOrder.id ? { ...o, ...changedOrder } : o))
            );
            return;
          }
          queryClient.invalidateQueries({ queryKey });
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (globalOrdersChannel) {
        supabase.removeChannel(globalOrdersChannel);
      }
      supabase.removeChannel(pgChannel);
    };
  }, [effectiveKitchenId, queryClient, queryKey]);

  // 3. Optimistic Mutation: Update Order Status (e.g. RECEIVED -> ACCEPTED / PREPARING / READY / DISPATCHED / CANCELLED)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const res = await updateOrderStatusAction({
        orderId,
        status,
        kitchenId: effectiveKitchenId,
      });
      if (!res.ok) throw new Error(res.error || 'Failed updating order status');
      return res;
    },
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<Order[]>(queryKey);

      // 1. Instantly update ticket status in live queue cache
      queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );

      // 2. Immediately cross-update Dispatch / Packing query caches
      if (status === 'DISPATCHED' || status === 'CANCELLED') {
        queryClient.setQueriesData({ queryKey: PACKING_ORDERS_QUERY_KEY }, (prev: Order[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.filter((o) => o.id !== orderId);
        });
        queryClient.setQueriesData({ queryKey: KDS_ORDERS_QUERY_KEY }, (prev: Order[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.filter((o) => o.id !== orderId);
        });
      }

      // 3. Optimistically update nav counts for status transitions
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

        if (status === 'ACCEPTED') {
          updated.kdsCount += 1;
        } else if (status === 'DISPATCHED' || status === 'CANCELLED') {
          updated.ordersCount = Math.max(0, updated.ordersCount - 1);
          updated.packingCount = Math.max(0, updated.packingCount - 1);
        }

        try {
          localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(updated));
          window.dispatchEvent(new Event('kitchflow_nav_counts_updated'));
        } catch {}

        return updated;
      });

      // 4. Inter-station LAN broadcast to all peer displays (Dispatch, KDS, Counters)
      try {
        const kid = effectiveKitchenId || 'all';
        const senderId = getDeviceUuid();

        // Broadcast to status channels
        broadcastKitchenEvent(`kitchen-${kid}-orders`, 'order_status_changed', { orderId, status, senderId });
        broadcastKitchenEvent('kitchen-all-orders', 'order_status_changed', { orderId, status, senderId });

        if (status === 'DISPATCHED') {
          // Dedicated dispatch event listened by usePackingOrders
          const packingChannel = kid && kid !== 'all' ? `kitchen-${kid}-packing` : 'kitchen-global-packing';
          broadcastKitchenEvent(packingChannel, 'order_dispatched', { orderId, senderId });

          // Dedicated nav counter delta
          const counterChannel = kid && kid !== 'all' ? `kitchen-${kid}-counters` : 'kitchen-all-counters';
          broadcastKitchenEvent(counterChannel, 'nav_counter_delta', {
            action: { type: 'DISPATCH_COMPLETE' },
            eventId: `DISPATCH_COMPLETE-${orderId}`,
            senderId,
          });
        } else if (status === 'ACCEPTED') {
          const counterChannel = kid && kid !== 'all' ? `kitchen-${kid}-counters` : 'kitchen-all-counters';
          broadcastKitchenEvent(counterChannel, 'nav_counter_delta', {
            action: { type: 'ORDER_PUNCHED' },
            eventId: `ORDER_ACCEPTED-${orderId}`,
            senderId,
          });
        }
      } catch {}

      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData<Order[]>(queryKey, context.previousOrders);
      }
      queryClient.invalidateQueries({ queryKey: PACKING_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
    },
    // Keep optimistic state stable; background polling or realtime events will settle any diffs
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    updateStatus: updateStatusMutation.mutate,
    refetch: query.refetch,
  };
}
