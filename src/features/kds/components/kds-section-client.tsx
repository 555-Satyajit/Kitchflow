'use client';

import React from 'react';
import { KDSView } from '@/components/kds/KDSView';
import { useKitchen } from '@/context/KitchenContext';
import { Order } from '@/types';
import { useKdsOrders } from '../hooks/useKdsOrders';
import { getDeviceUuid } from '@/lib/utils';
import { broadcastKitchenEvent } from '@/lib/supabase/realtime-bus';

interface KdsSectionClientProps {
  initialOrders: Order[];
  configuredStations?: string[];
  kitchenId?: string;
}

export function KdsSectionClient({ initialOrders, configuredStations = [], kitchenId }: KdsSectionClientProps) {
  const { userRole } = useKitchen();
  const { orders, toggleItem, markOrderReady } = useKdsOrders(kitchenId, initialOrders);

  // Ref map to prevent greasy-finger multi-tap duplicates and debounce broadcast payloads
  const inFlightTogglesRef = React.useRef<{ [itemId: string]: boolean }>({});
  const debounceTimersRef = React.useRef<{ [itemId: string]: NodeJS.Timeout }>({});

  const handleToggleStationItem = (orderId: string, itemId: string) => {
    // 1. "Greasy Finger" Lock: If user is actively tapping or a mutation is in flight, drop duplicate tap
    if (inFlightTogglesRef.current[itemId]) {
      return;
    }
    inFlightTogglesRef.current[itemId] = true;

    // Find current item in cache to determine targetDone and clientVersion
    const targetOrder = orders.find((o) => o.id === orderId);
    const targetItem = targetOrder?.items.find((it) => it.id === itemId);
    const nextDone = targetItem ? !targetItem.stationDone : true;
    const currentVersion = targetItem?.version ?? 0;

    // Fire TanStack Query optimistic mutation
    toggleItem({
      orderId,
      itemId,
      nextDone,
      clientVersion: currentVersion,
    });

    // Debounce Broadcast payload for other kitchen displays (<250ms)
    if (debounceTimersRef.current[itemId]) {
      clearTimeout(debounceTimersRef.current[itemId]);
    }

    debounceTimersRef.current[itemId] = setTimeout(() => {
      try {
        const channelName = kitchenId ? `kitchen-${kitchenId}-kds` : 'kitchen-global-kds';
        const payload = { 
          orderId, 
          itemId, 
          isDone: nextDone,
          stationDone: nextDone, 
          version: currentVersion + 1,
          senderId: getDeviceUuid(),
          updatedAt: new Date().toISOString() 
        };
        broadcastKitchenEvent(channelName, 'kds_item_toggled', payload);
        if (kitchenId) {
          broadcastKitchenEvent('kitchen-global-kds', 'kds_item_toggled', payload);
        }
      } catch {
        // ignore
      }
    }, 250);

    setTimeout(() => {
      delete inFlightTogglesRef.current[itemId];
    }, 300);
  };

  const handleMarkOrderReady = (orderId: string) => {
    // Drop rapid multi-clicks
    if (inFlightTogglesRef.current[orderId]) return;
    inFlightTogglesRef.current[orderId] = true;

    // Broadcast instant READY notice to dispatch screens
    try {
      const kdsChannel = kitchenId ? `kitchen-${kitchenId}-kds` : 'kitchen-global-kds';
      const packingChannel = kitchenId ? `kitchen-${kitchenId}-packing` : 'kitchen-global-packing';
      const payload = { orderId, status: 'READY', timestamp: new Date().toISOString(), senderId: getDeviceUuid() };

      broadcastKitchenEvent(kdsChannel, 'order_status_changed', payload);
      broadcastKitchenEvent(packingChannel, 'order_status_changed', payload);
      if (kitchenId) {
        broadcastKitchenEvent('kitchen-global-kds', 'order_status_changed', payload);
        broadcastKitchenEvent('kitchen-global-packing', 'order_status_changed', payload);
      }
    } catch {
      // ignore
    }

    // Fire TanStack Query optimistic mutation (instantly drops order from KDS and bumps packing count)
    markOrderReady({ orderId });

    setTimeout(() => {
      delete inFlightTogglesRef.current[orderId];
    }, 500);
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
