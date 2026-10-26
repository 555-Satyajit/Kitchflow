'use client';

import React, { useState, useEffect } from 'react';
import { PackingView } from '@/components/packing/PackingView';
import { useKitchen } from '@/context/KitchenContext';
import { Order, PackingChecklist } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { getDeviceUuid } from '@/lib/utils';
import { useRealtimeReconnection } from '@/hooks/useRealtimeReconnection';
import { 
  toggleChecklistItemAction, 
  completePackingAction, 
  fetchPackingOrdersClientAction 
} from '../packing-actions';

interface PackingSectionClientProps {
  initialOrders: Order[];
  kitchenId?: string;
}

export function PackingSectionClient({ initialOrders, kitchenId }: PackingSectionClientProps) {
  const { setOrders: setContextOrders, setIsOrdersLoaded } = useKitchen();
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  const refreshAuthoritativeOrders = React.useCallback(async () => {
    try {
      const fresh = await fetchPackingOrdersClientAction(kitchenId);
      if (fresh && Array.isArray(fresh)) {
        setOrders(fresh as Order[]);
        setContextOrders((prev) => {
          const nonPackingOrders = prev.filter((o) => o.status !== 'PREPARING' && o.status !== 'READY');
          return [...(fresh as Order[]), ...nonPackingOrders];
        });
      }
    } catch (err) {
      console.warn('Packing reconnect resync fallback:', err);
    }
  }, [kitchenId, setContextOrders]);

  // Sync when initialOrders changes from RSC
  useEffect(() => {
    setOrders(initialOrders);
    setIsOrdersLoaded(true);
    setContextOrders((prev) => {
      const nonPackingOrders = prev.filter((o) => o.status !== 'PREPARING' && o.status !== 'READY');
      return [...initialOrders, ...nonPackingOrders];
    });
  }, [initialOrders, setIsOrdersLoaded, setContextOrders]);

  // Resynchronization & Heartbeat Hook (handles screen wake, Wi-Fi failover, & channel drops)
  useRealtimeReconnection({
    channelName: kitchenId ? `kitchen-${kitchenId}-packing` : 'kitchen-global-packing',
    onReconnect: refreshAuthoritativeOrders,
    heartbeatIntervalMs: 30000,
  });

  // Connect to Supabase Realtime pub/sub:
  // Combines high-speed zero-disk Broadcast channels with postgres_changes fallback
  useEffect(() => {
    const supabase = createClient();
    const channelName = kitchenId ? `kitchen-${kitchenId}-packing` : 'kitchen-global-packing';
    const myDeviceUuid = getDeviceUuid();

    let wasDisconnected = false;

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      // High-speed WebSocket Broadcast (zero disk / WAL pressure)
      .on('broadcast', { event: 'packing_checklist_toggled' }, ({ payload }) => {
        if (!payload?.orderId || !payload?.key) return;
        // 1. Ignore own echo if received
        if (payload.senderId && payload.senderId === myDeviceUuid) return;

        // 2. Strict Realtime Broadcast Serialization:
        // Only accept update if incoming payload.version > currently rendered version
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== payload.orderId) return o;
            const currentVersion = o.version ?? 0;
            const incomingVersion = typeof payload.version === 'number' ? payload.version : currentVersion + 1;

            // If incoming frame has older or equal sequence version, silently discard as obsolete network noise
            if (incomingVersion <= currentVersion) {
              return o;
            }

            return {
              ...o,
              version: incomingVersion,
              checklist: {
                ...o.checklist,
                [payload.key]: payload.checked,
              },
            };
          })
        );
      })
      .on('broadcast', { event: 'order_dispatched' }, ({ payload }) => {
        if (!payload?.orderId) return;
        setOrders((prev) => prev.filter((o) => o.id !== payload.orderId));
      })
      // Postgres replication fallback for DB writes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          const fresh = await fetchPackingOrdersClientAction(kitchenId);
          setOrders(fresh as Order[]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        async () => {
          const fresh = await fetchPackingOrdersClientAction(kitchenId);
          setOrders(fresh as Order[]);
        }
      )
      .subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          wasDisconnected = true;
        } else if (status === 'SUBSCRIBED') {
          if (wasDisconnected) {
            wasDisconnected = false;
            refreshAuthoritativeOrders();
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [kitchenId, refreshAuthoritativeOrders]);

  // Ref map to prevent greasy-finger multi-tap duplicates and debounce broadcast payloads
  const inFlightTogglesRef = React.useRef<{ [checkId: string]: boolean }>({});
  const debounceTimersRef = React.useRef<{ [checkId: string]: NodeJS.Timeout }>({});

  const handleToggleChecklistItem = async (orderId: string, key: keyof PackingChecklist) => {
    const lockKey = `${orderId}-${key}`;
    // 1. "Greasy Finger" Lock: Drop duplicate rapid taps while mutation is in-flight
    if (inFlightTogglesRef.current[lockKey]) {
      return;
    }
    inFlightTogglesRef.current[lockKey] = true;

    let nextChecked = false;
    let currentOrderVersion = 0;

    // 2. Immediate optimistic UI update (instant touch responsiveness)
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        nextChecked = !o.checklist[key];
        currentOrderVersion = o.version ?? 0;
        return {
          ...o,
          version: currentOrderVersion + 1,
          updatedAt: new Date().toISOString(),
          checklist: {
            ...o.checklist,
            [key]: nextChecked,
          },
        };
      })
    );

    // 3. Debounce Broadcast payload (prevents spamming duplicate WS frames within 250ms)
    if (debounceTimersRef.current[lockKey]) {
      clearTimeout(debounceTimersRef.current[lockKey]);
    }

    debounceTimersRef.current[lockKey] = setTimeout(() => {
      try {
        const supabase = createClient();
        const channelName = kitchenId ? `kitchen-${kitchenId}-packing` : 'kitchen-global-packing';
        supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'packing_checklist_toggled',
          payload: { 
            orderId, 
            key, 
            checked: nextChecked,
            version: currentOrderVersion + 1,
            senderId: getDeviceUuid(),
            updatedAt: new Date().toISOString(),
          },
        });
      } catch {
        // ignore
      }
    }, 250);

    // 4. Hardened Concurrency Check via Integer Sequence Version (Zero Clock Drift Risk)
    // Pass targetChecked and clientVersion so late packets cannot overwrite newer modifications
    try {
      const res = await toggleChecklistItemAction({ 
        orderId, 
        itemKey: key, 
        kitchenId,
        targetChecked: nextChecked,
        clientVersion: currentOrderVersion,
      });

      if (res.ok && res.data) {
        const serverChecklist = res.data.checklist;
        const serverVersion = res.data.version;
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              version: serverVersion,
              checklist: serverChecklist,
            };
          })
        );
      }
    } finally {
      setTimeout(() => {
        delete inFlightTogglesRef.current[lockKey];
      }, 300);
    }
  };

  const handleCompletePacking = async (orderId: string) => {
    // Drop rapid clicks
    if (inFlightTogglesRef.current[orderId]) return;
    inFlightTogglesRef.current[orderId] = true;

    // Optimistic removal from packing screen
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    try {
      const supabase = createClient();
      const channelName = kitchenId ? `kitchen-${kitchenId}-packing` : 'kitchen-global-packing';
      supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'order_dispatched',
        payload: { orderId, timestamp: new Date().toISOString() },
      });
    } catch {
      // ignore
    }

    try {
      await completePackingAction({ orderId, kitchenId });
    } finally {
      setTimeout(() => {
        delete inFlightTogglesRef.current[orderId];
      }, 500);
    }
  };

  return (
    <PackingView
      orders={orders}
      onToggleChecklistItem={handleToggleChecklistItem}
      onCompletePacking={handleCompletePacking}
    />
  );
}
