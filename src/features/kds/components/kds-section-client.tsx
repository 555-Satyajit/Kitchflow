'use client';

import React from 'react';
import { KDSView } from '@/components/kds/KDSView';
import { useKitchen } from '@/context/KitchenContext';
import { Order } from '@/types';
import { ThermalPrintModal } from '@/components/pos/ThermalPrintModal';
import { useKitchenStore, selectKdsOrders } from '@/stores/useKitchenStore';
import { useShallow } from 'zustand/react/shallow';
import { updateOrderStatusAction } from '@/features/orders/order-actions';

interface KdsSectionClientProps {
  initialOrders: Order[];
  configuredStations?: string[];
  kitchenId?: string;
}

export function KdsSectionClient({ initialOrders, configuredStations = [], kitchenId }: KdsSectionClientProps) {
  const { userRole, brands } = useKitchen();
  
  const v2KdsOrders = useKitchenStore(useShallow(selectKdsOrders));
  const v2SetBulkOrders = useKitchenStore((s) => s.setBulkOrders);

  React.useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      v2SetBulkOrders(initialOrders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeKdsOrders = React.useMemo(() => {
    return v2KdsOrders.filter((o) => {
      return !kitchenId || kitchenId === 'all' || !o.kitchenId || o.kitchenId === kitchenId;
    });
  }, [v2KdsOrders, kitchenId]);

  const [printOrder, setPrintOrder] = React.useState<Order | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState<boolean>(false);

  // Ref map to prevent greasy-finger multi-tap duplicates
  const inFlightTogglesRef = React.useRef<{ [itemId: string]: boolean }>({});

  const handleToggleStationItem = (orderId: string, itemId: string) => {
    // 1. "Greasy Finger" Lock: If user is actively tapping, drop duplicate tap
    if (inFlightTogglesRef.current[itemId]) {
      return;
    }
    inFlightTogglesRef.current[itemId] = true;

    // Find current item in cache to determine targetDone
    const targetOrder = useKitchenStore.getState().orders[orderId];
    const targetItem = targetOrder?.items.find((it) => it.id === itemId);
    const nextDone = targetItem ? !targetItem.stationDone : true;

    useKitchenStore.getState().toggleStationItem(orderId, itemId, nextDone);

    setTimeout(() => {
      delete inFlightTogglesRef.current[itemId];
    }, 300);
  };

  const handleMarkOrderReady = (orderId: string) => {
    // Drop rapid multi-clicks
    if (inFlightTogglesRef.current[orderId]) return;
    inFlightTogglesRef.current[orderId] = true;

    useKitchenStore.getState().bumpOrderStatus(orderId, 'READY');

    setTimeout(() => {
      delete inFlightTogglesRef.current[orderId];
    }, 500);
  };

  const handlePrintKot = (order: Order) => {
    setPrintOrder(order);
    setIsPrintModalOpen(true);
  };

  const handleRecallLastBump = async () => {
    // Recall handled gracefully if supported
  };

  return (
    <>
      <KDSView
        orders={activeKdsOrders}
        configuredStations={configuredStations as any}
        onToggleStationItem={handleToggleStationItem}
        onMarkOrderReady={handleMarkOrderReady}
        onPrintKot={handlePrintKot}
        onRecallLastBump={handleRecallLastBump}
        canRecall={false}
        userRole={userRole}
      />

      <ThermalPrintModal
        order={printOrder}
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
        defaultMode="kot"
        outletConfig={{
          name: printOrder ? brands.find((b) => b.id === printOrder.brandId)?.name || printOrder.brandName : 'KITCHEN',
        }}
      />
    </>
  );
}
