'use client';

import React from 'react';
import { PackingView } from '@/components/packing/PackingView';
import { Order, PackingChecklist } from '@/types';
import { useKitchenStore, selectPackingOrders } from '@/stores/useKitchenStore';
import { useShallow } from 'zustand/react/shallow';

interface PackingSectionClientProps {
  initialOrders: Order[];
  kitchenId?: string;
}

export function PackingSectionClient({ initialOrders, kitchenId }: PackingSectionClientProps) {
  const v2PackingOrders = useKitchenStore(useShallow(selectPackingOrders));
  const v2SetBulkOrders = useKitchenStore((s) => s.setBulkOrders);

  React.useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      v2SetBulkOrders(initialOrders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePackingOrders = React.useMemo(() => {
    return v2PackingOrders.filter((o) => {
      return !kitchenId || kitchenId === 'all' || !o.kitchenId || o.kitchenId === kitchenId;
    });
  }, [v2PackingOrders, kitchenId]);

  // Ref map to prevent greasy-finger multi-tap duplicates
  const inFlightTogglesRef = React.useRef<{ [checkId: string]: boolean }>({});

  const handleToggleChecklistItem = (orderId: string, key: keyof PackingChecklist) => {
    const lockKey = `${orderId}-${key}`;
    if (inFlightTogglesRef.current[lockKey]) {
      return;
    }
    inFlightTogglesRef.current[lockKey] = true;

    // Toggle checklist item in local store
    const targetOrder = useKitchenStore.getState().orders[orderId];
    if (targetOrder) {
      const nextChecked = targetOrder.checklist ? !targetOrder.checklist[key] : true;
      const updatedOrder = {
        ...targetOrder,
        checklist: {
          ...targetOrder.checklist,
          [key]: nextChecked,
        },
      };
      useKitchenStore.setState((state) => {
        const nextOrders = { ...state.orders, [orderId]: updatedOrder };
        return {
          orders: nextOrders,
          navCounts: state.navCounts, // Checklist doesn't change nav counts
        };
      });
    }

    setTimeout(() => {
      delete inFlightTogglesRef.current[lockKey];
    }, 300);
  };

  const handleCompletePacking = (orderId: string) => {
    if (inFlightTogglesRef.current[orderId]) return;
    inFlightTogglesRef.current[orderId] = true;

    useKitchenStore.getState().bumpOrderStatus(orderId, 'DISPATCHED');

    setTimeout(() => {
      delete inFlightTogglesRef.current[orderId];
    }, 500);
  };

  return (
    <PackingView
      orders={activePackingOrders}
      onToggleChecklistItem={handleToggleChecklistItem}
      onCompletePacking={handleCompletePacking}
    />
  );
}
