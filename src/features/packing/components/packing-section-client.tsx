'use client';

import React from 'react';
import { PackingView } from '@/components/packing/PackingView';
import { Order, PackingChecklist } from '@/types';
import { usePackingOrders } from '../hooks/usePackingOrders';
import { getDeviceUuid } from '@/lib/utils';
import { broadcastKitchenEvent } from '@/lib/supabase/realtime-bus';

interface PackingSectionClientProps {
  initialOrders: Order[];
  kitchenId?: string;
}

export function PackingSectionClient({ initialOrders, kitchenId }: PackingSectionClientProps) {
  const { orders, toggleChecklistItem, completePacking } = usePackingOrders(kitchenId, initialOrders);

  // Ref map to prevent greasy-finger multi-tap duplicates and debounce broadcast payloads
  const inFlightTogglesRef = React.useRef<{ [checkId: string]: boolean }>({});
  const debounceTimersRef = React.useRef<{ [checkId: string]: NodeJS.Timeout }>({});

  const handleToggleChecklistItem = (orderId: string, key: keyof PackingChecklist) => {
    const lockKey = `${orderId}-${key}`;
    if (inFlightTogglesRef.current[lockKey]) {
      return;
    }
    inFlightTogglesRef.current[lockKey] = true;

    const targetOrder = orders.find((o) => o.id === orderId);
    const nextChecked = targetOrder?.checklist ? !targetOrder.checklist[key] : true;
    const currentVersion = targetOrder?.version ?? 0;

    // Fire TanStack Query optimistic mutation
    toggleChecklistItem({
      orderId,
      key,
      nextChecked,
      clientVersion: currentVersion,
    });

    // Debounce Broadcast payload to peer devices
    if (debounceTimersRef.current[lockKey]) {
      clearTimeout(debounceTimersRef.current[lockKey]);
    }

    debounceTimersRef.current[lockKey] = setTimeout(() => {
      try {
        const channelName = kitchenId ? `kitchen-${kitchenId}-packing` : 'kitchen-global-packing';
        const payload = { 
          orderId, 
          key, 
          checked: nextChecked,
          version: currentVersion + 1,
          senderId: getDeviceUuid(),
        };
        broadcastKitchenEvent(channelName, 'packing_checklist_toggled', payload);
        if (kitchenId) {
          broadcastKitchenEvent('kitchen-global-packing', 'packing_checklist_toggled', payload);
        }
      } catch {
        // ignore
      }
    }, 250);

    setTimeout(() => {
      delete inFlightTogglesRef.current[lockKey];
    }, 300);
  };

  const handleCompletePacking = (orderId: string) => {
    if (inFlightTogglesRef.current[orderId]) return;
    inFlightTogglesRef.current[orderId] = true;

    // Broadcast instant dispatch to peer screens
    try {
      const targetKid = kitchenId || (typeof window !== 'undefined' ? localStorage.getItem('kitchflow_active_kitchen_id') : undefined);
      const channelName = targetKid && targetKid !== 'default' ? `kitchen-${targetKid}-packing` : 'kitchen-global-packing';
      const senderId = getDeviceUuid();
      const payload = { orderId, senderId, timestamp: new Date().toISOString() };

      broadcastKitchenEvent(channelName, 'order_dispatched', payload);
      if (targetKid && targetKid !== 'default') {
        broadcastKitchenEvent('kitchen-global-packing', 'order_dispatched', payload);
      }
    } catch {
      // ignore
    }

    // Fire TanStack Query optimistic mutation (instantly drops order and decrements badge counts)
    completePacking({ orderId });

    setTimeout(() => {
      delete inFlightTogglesRef.current[orderId];
    }, 500);
  };

  return (
    <PackingView
      orders={orders}
      onToggleChecklistItem={handleToggleChecklistItem}
      onCompletePacking={handleCompletePacking}
    />
  );
}
