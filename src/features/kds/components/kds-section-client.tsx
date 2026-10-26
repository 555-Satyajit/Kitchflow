'use client';

import React, { useState, useEffect } from 'react';
import { KDSView } from '@/components/kds/KDSView';
import { useKitchen } from '@/context/KitchenContext';
import { Order } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { getDeviceUuid } from '@/lib/utils';
import { useRealtimeReconnection } from '@/hooks/useRealtimeReconnection';
import { 
  toggleStationItemAction, 
  markOrderReadyAction, 
  getLatestKdsSnapshotAction 
} from '../kds-actions';

interface KdsSectionClientProps {
  initialOrders: Order[];
  configuredStations?: string[];
  kitchenId?: string;
}

export function KdsSectionClient({ initialOrders, configuredStations = [], kitchenId }: KdsSectionClientProps) {
  const { userRole, setOrders: setContextOrders, setIsOrdersLoaded } = useKitchen();
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  const refreshAuthoritativeOrders = React.useCallback(async () => {
    try {
      const fresh = await getLatestKdsSnapshotAction(kitchenId);
      if (fresh && Array.isArray(fresh)) {
        setOrders(fresh as Order[]);
        setContextOrders((prev) => {
          // Merge fresh KDS orders into context so nav badges stay in sync
          const otherOrders = prev.filter((o) => o.status === 'READY' || o.status === 'DISPATCHED' || o.status === 'CANCELLED');
          return [...(fresh as Order[]), ...otherOrders];
        });
      }
    } catch (err) {
      console.warn('KDS reconnect resync fallback:', err);
    }
  }, [kitchenId, setContextOrders]);

  // Sync when initialOrders changes from RSC
  useEffect(() => {
    setOrders(initialOrders);
    setIsOrdersLoaded(true);
    setContextOrders((prev) => {
      const otherOrders = prev.filter((o) => o.status === 'READY' || o.status === 'DISPATCHED' || o.status === 'CANCELLED');
      return [...initialOrders, ...otherOrders];
    });
  }, [initialOrders, setIsOrdersLoaded, setContextOrders]);

  // Resynchronization & Heartbeat Hook (handles screen wake, Wi-Fi failover, & channel drops)
  useRealtimeReconnection({
    channelName: kitchenId ? `kitchen-${kitchenId}-kds` : 'kitchen-global-kds',
    onReconnect: refreshAuthoritativeOrders,
    heartbeatIntervalMs: 30000,
  });

  // Connect to Supabase Realtime pub/sub:
  // Combines high-speed zero-disk Broadcast channels with postgres_changes fallback
  useEffect(() => {
    const supabase = createClient();
    const channelName = kitchenId ? `kitchen-${kitchenId}-kds` : 'kitchen-global-kds';
    const myDeviceUuid = getDeviceUuid();

    let wasDisconnected = false;

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      // High-frequency in-memory Broadcast event (Zero DB Disk / WAL bottleneck)
      .on('broadcast', { event: 'kds_item_toggled' }, ({ payload }) => {
        if (!payload?.orderId || !payload?.itemId) return;
        // 1. Ignore own echo if accidentally received
        if (payload.senderId && payload.senderId === myDeviceUuid) return;

        // 2. Strict Realtime Broadcast Serialization:
        // Only accept update if incoming payload.version > currently rendered version
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== payload.orderId) return o;
            return {
              ...o,
              items: o.items.map((it) => {
                if (it.id !== payload.itemId) return it;
                const currentVersion = it.version ?? 0;
                const incomingVersion = typeof payload.version === 'number' ? payload.version : currentVersion + 1;
                
                // If incoming frame has older or equal sequence version, silently drop as obsolete network noise
                if (incomingVersion <= currentVersion) {
                  return it;
                }

                return { 
                  ...it, 
                  stationDone: payload.isDone !== undefined ? payload.isDone : payload.stationDone,
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
          setOrders((prev) => prev.filter((o) => o.id !== payload.orderId));
        } else {
          getLatestKdsSnapshotAction(kitchenId).then((fresh) => setOrders(fresh as Order[]));
        }
      })
      // Fallback: Postgres logical replication event for external writes (e.g. Swiggy/Zomato webhooks)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          const fresh = await getLatestKdsSnapshotAction(kitchenId);
          setOrders(fresh as Order[]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        async () => {
          const fresh = await getLatestKdsSnapshotAction(kitchenId);
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
  const inFlightTogglesRef = React.useRef<{ [itemId: string]: boolean }>({});
  const debounceTimersRef = React.useRef<{ [itemId: string]: NodeJS.Timeout }>({});

  const handleToggleStationItem = async (orderId: string, itemId: string) => {
    // 1. "Greasy Finger" Lock: If user is actively tapping or a mutation is currently in flight for this item, drop duplicate tap
    if (inFlightTogglesRef.current[itemId]) {
      return;
    }
    inFlightTogglesRef.current[itemId] = true;

    let nextDone = false;
    let currentItemVersion = 0;

    // 2. Immediate optimistic UI update (instant touch responsiveness)
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          items: o.items.map((it) => {
            if (it.id === itemId) {
              nextDone = !it.stationDone;
              currentItemVersion = it.version ?? 0;
              return { 
                ...it, 
                stationDone: nextDone,
                version: currentItemVersion + 1,
                updatedAt: new Date().toISOString() 
              };
            }
            return it;
          }),
        };
      })
    );

    // 3. Debounce Broadcast payload (prevents spamming 5 duplicate WS frames down the pipe within 250ms)
    if (debounceTimersRef.current[itemId]) {
      clearTimeout(debounceTimersRef.current[itemId]);
    }

    debounceTimersRef.current[itemId] = setTimeout(() => {
      try {
        const supabase = createClient();
        const channelName = kitchenId ? `kitchen-${kitchenId}-kds` : 'kitchen-global-kds';
        supabase.channel(channelName).send({
          type: 'broadcast',
          event: 'kds_item_toggled',
          payload: { 
            orderId, 
            itemId, 
            isDone: nextDone,
            stationDone: nextDone, 
            version: currentItemVersion + 1,
            senderId: getDeviceUuid(),
            updatedAt: new Date().toISOString() 
          },
        });
      } catch {
        // ignore
      }
    }, 250);

    // 4. Hardened Concurrency Check via Integer Sequence Version (Zero Clock Drift Risk)
    // Pass targetDone and clientVersion so late-arriving packets cannot overwrite newer writes
    try {
      const res = await toggleStationItemAction({ 
        orderId, 
        itemId, 
        kitchenId,
        targetDone: nextDone,
        clientVersion: currentItemVersion,
      });

      if (res.ok && res.data) {
        // Re-align with server's confirmed state if server rejected a stale packet
        const serverDone = res.data.isDone;
        const serverVersion = res.data.version;
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              items: o.items.map((it) =>
                it.id === itemId ? { ...it, stationDone: serverDone, version: serverVersion } : it
              ),
            };
          })
        );
      }
    } finally {
      // Release lock with small buffer to absorb multi-touch bounces
      setTimeout(() => {
        delete inFlightTogglesRef.current[itemId];
      }, 300);
    }
  };

  const handleMarkOrderReady = async (orderId: string) => {
    // Drop rapid multi-clicks
    if (inFlightTogglesRef.current[orderId]) return;
    inFlightTogglesRef.current[orderId] = true;

    // Optimistic removal from cooking queue
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    try {
      const supabase = createClient();
      const channelName = kitchenId ? `kitchen-${kitchenId}-kds` : 'kitchen-global-kds';
      supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'order_status_changed',
        payload: { orderId, status: 'READY', timestamp: new Date().toISOString() },
      });
    } catch {
      // ignore
    }

    try {
      await markOrderReadyAction({ orderId, kitchenId });
    } finally {
      setTimeout(() => {
        delete inFlightTogglesRef.current[orderId];
      }, 500);
    }
  };

  return (
    <KDSView
      orders={orders}
      configuredStations={configuredStations as any}
      onToggleStationItem={handleToggleStationItem}
      onMarkOrderReady={handleMarkOrderReady}
      userRole={userRole}
    />
  );
}
