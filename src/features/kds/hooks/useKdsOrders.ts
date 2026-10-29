'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Order } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { playKitchenSound } from '@/lib/sound-engine';
import { getDeviceUuid } from '@/lib/utils';
import { broadcastKitchenEvent } from '@/lib/supabase/realtime-bus';
import { 
  getLatestKdsSnapshotAction, 
  toggleStationItemAction, 
  markOrderReadyAction 
} from '@/features/kds/kds-actions';
import { NAV_COUNTS_QUERY_KEY } from '@/hooks/useNavCounts';
import { PACKING_ORDERS_QUERY_KEY } from '@/features/packing/hooks/usePackingOrders';
import { useOutlets } from '@/hooks/useOutlets';

export const KDS_ORDERS_QUERY_KEY = ['kds-orders'] as const;

export function useKdsOrders(kitchenId?: string, initialOrders: Order[] = []) {
  const queryClient = useQueryClient();
  const { activeOutletId } = useOutlets();
  const effectiveKitchenId = (activeOutletId || kitchenId) && (activeOutletId || kitchenId) !== 'default' ? (activeOutletId || kitchenId) : undefined;
  const queryKey = [...KDS_ORDERS_QUERY_KEY, effectiveKitchenId || 'all'];

  // 1. Authoritative KDS Query with initial SSR hydration
  const query = useQuery<Order[]>({
    queryKey,
    queryFn: async (): Promise<Order[]> => {
      let targetId = effectiveKitchenId;
      if (!targetId && typeof window !== 'undefined') {
        const stored = localStorage.getItem('kitchflow_active_kitchen_id');
        if (stored) targetId = stored;
      }
      const raw = await getLatestKdsSnapshotAction(targetId);
      if (!Array.isArray(raw)) return [];
      return (raw as Order[]).filter(
        (o) => o.status === 'ACCEPTED' || o.status === 'PREPARING'
      );
    },
    initialData: initialOrders.filter(
      (o) => o.status === 'ACCEPTED' || o.status === 'PREPARING'
    ),
    staleTime: 4000,
    refetchInterval: 15000, // 15s passive background polling fallback
  });

  // 2. Realtime Event Listener & Cache Synchronization
  useEffect(() => {
    const supabase = createClient();
    const myDeviceUuid = getDeviceUuid();
    const kid = effectiveKitchenId || 'all';
    const kdsChannelName = kid === 'all' ? 'kitchen-global-kds' : `kitchen-${kid}-kds`;
    const ordersChannelName = kid === 'all' ? 'kitchen-all-orders' : `kitchen-${kid}-orders`;

    const channel = supabase
      .channel(kdsChannelName, {
        config: { broadcast: { self: false } },
      })
      // Instantly receive new orders punched at POS or aggregators (<10ms single-frame update)
      .on('broadcast', { event: 'new_order_placed' }, ({ payload }) => {
        if (!payload?.order) {
          queryClient.invalidateQueries({ queryKey });
          return;
        }
        const incomingOrder = payload.order as Order;
        if (incomingOrder.status === 'ACCEPTED' || incomingOrder.status === 'PREPARING') {
          playKitchenSound('NEW_ORDER', 0.35);
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) => {
            if (prev.some((o) => o.id === incomingOrder.id)) return prev;
            return [...prev, incomingOrder];
          });
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        }
      })
      // High-frequency in-memory Broadcast event for station item ticking
      .on('broadcast', { event: 'kds_item_toggled' }, ({ payload }) => {
        if (!payload?.orderId || !payload?.itemId) return;
        if (payload.senderId && payload.senderId === myDeviceUuid) return;

        queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
          prev.map((o) => {
            if (o.id !== payload.orderId) return o;
            return {
              ...o,
              items: o.items.map((it) => {
                if (it.id !== payload.itemId) return it;
                const currentVersion = it.version ?? 0;
                const incomingVersion =
                  typeof payload.version === 'number' ? payload.version : currentVersion + 1;

                if (incomingVersion <= currentVersion) return it;

                return {
                  ...it,
                  stationDone:
                    payload.isDone !== undefined ? payload.isDone : payload.stationDone,
                  version: incomingVersion,
                };
              }),
            };
          })
        );
      })
      .on('broadcast', { event: 'order_status_changed' }, ({ payload }) => {
        if (!payload?.orderId) return;
        if (payload.status === 'READY' || payload.status === 'DISPATCHED') {
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
            prev.filter((o) => o.id !== payload.orderId)
          );
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        } else {
          queryClient.invalidateQueries({ queryKey });
        }
      })
      .subscribe();

    const ordersChannel = supabase
      .channel(ordersChannelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'order_status_changed' }, ({ payload }) => {
        if (!payload?.orderId) return;
        if (payload.status === 'READY' || payload.status === 'DISPATCHED') {
          queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
            prev.filter((o) => o.id !== payload.orderId)
          );
          queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
        } else {
          queryClient.invalidateQueries({ queryKey });
        }
      })
      .subscribe();

    const pgChannel = supabase
      .channel(`pg-kds-orders-${kid}-${myDeviceUuid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
          // If the update was triggered by our own client/mutation, ignore the postgres change event
          // to prevent overwriting active optimistic state.
          const changedOrder = payload?.new as Order | undefined;
          if (changedOrder?.id) {
            if (changedOrder.status === 'READY' || changedOrder.status === 'DISPATCHED' || changedOrder.status === 'CANCELLED') {
              queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
                prev.filter((o) => o.id !== changedOrder.id)
              );
              queryClient.invalidateQueries({ queryKey: NAV_COUNTS_QUERY_KEY });
              return;
            }
          }
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

  // 3. Optimistic Mutation: Toggle Individual Dish / Item Done
  const toggleItemMutation = useMutation({
    mutationFn: async ({
      orderId,
      itemId,
      nextDone,
      clientVersion,
    }: {
      orderId: string;
      itemId: string;
      nextDone: boolean;
      clientVersion: number;
    }) => {
      const res = await toggleStationItemAction({
        orderId,
        itemId,
        kitchenId: effectiveKitchenId,
        targetDone: nextDone,
        clientVersion,
      });
      if (!res.ok) throw new Error(res.error || 'Failed toggling item');
      return res.data;
    },
    onMutate: async ({ orderId, itemId, nextDone }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<Order[]>(queryKey);

      // Instant optimistic UI update in TanStack Query cache (0ms perceived lag)
      queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            items: o.items.map((it) => {
              if (it.id !== itemId) return it;
              return {
                ...it,
                stationDone: nextDone,
                version: (it.version ?? 0) + 1,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        })
      );

      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      // Rollback only on actual network/server rejection
      if (context?.previousOrders) {
        queryClient.setQueryData<Order[]>(queryKey, context.previousOrders);
      }
    },
    // Do NOT aggressively invalidate onSettled; the optimistic state is already exact and
    // refetching immediately races against the database commit, which causes the item to pop back!
  });

  // 4. Optimistic Mutation: Mark Entire Order Ready (Sent to Packing / Dispatch)
  const markReadyMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const res = await markOrderReadyAction({ orderId, kitchenId: effectiveKitchenId });
      if (!res.ok) throw new Error(res.error || 'Failed marking order ready');
      return res;
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousOrders = queryClient.getQueryData<Order[]>(queryKey);

      // 1. Instantly remove ticket from KDS screen
      queryClient.setQueryData<Order[]>(queryKey, (prev = []) =>
        prev.filter((o) => o.id !== orderId)
      );

      // 2. Instantly optimistically update packing orders cache so Dispatch screen is 100% ready immediately
      queryClient.setQueriesData({ queryKey: PACKING_ORDERS_QUERY_KEY }, (prev: Order[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((o) =>
          o.id === orderId ? { ...o, status: 'READY', readyAt: new Date().toISOString() } : o
        );
      });

      // 3. Instantly update badge counts optimistically on all nav queries
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
          kdsCount: Math.max(0, current.kdsCount - 1),
        };
        try {
          localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(updated));
          window.dispatchEvent(new Event('kitchflow_nav_counts_updated'));
        } catch {}
        return updated;
      });

      // 4. Broadcast inter-station delta and status change to all connected peer devices on LAN (<10ms)
      try {
        const kid = effectiveKitchenId || 'all';
        const senderId = getDeviceUuid();

        // Dedicated inter-station counter delta
        const counterChannelName = kid && kid !== 'all' ? `kitchen-${kid}-counters` : 'kitchen-all-counters';
        broadcastKitchenEvent(counterChannelName, 'nav_counter_delta', {
          action: { type: 'KDS_COMPLETE' },
          eventId: `KDS_COMPLETE-${orderId}`,
          senderId,
        });

        // Dedicated status broadcast to packing & orders channels
        const statusPayload = { orderId, status: 'READY', timestamp: new Date().toISOString(), senderId };
        const packingChannelName = kid === 'all' ? 'kitchen-global-packing' : `kitchen-${kid}-packing`;
        broadcastKitchenEvent(packingChannelName, 'order_status_changed', statusPayload);
        if (kid !== 'all') {
          broadcastKitchenEvent('kitchen-global-packing', 'order_status_changed', statusPayload);
        }

        const ordersChannelName = kid === 'all' ? 'kitchen-all-orders' : `kitchen-${kid}-orders`;
        broadcastKitchenEvent(ordersChannelName, 'order_status_changed', statusPayload);
        if (kid !== 'all') {
          broadcastKitchenEvent('kitchen-all-orders', 'order_status_changed', statusPayload);
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
    toggleItem: toggleItemMutation.mutate,
    markOrderReady: markReadyMutation.mutate,
    refetch: query.refetch,
  };
}
