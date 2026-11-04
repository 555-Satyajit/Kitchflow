'use client';

import React, { useState } from 'react';
import { OrdersQueueView } from '@/components/orders/OrdersQueueView';
import { MarginModal } from '@/components/margins/MarginModal';
import { ManualOrderModal } from '@/components/orders/ManualOrderModal';
import { useKitchen } from '@/context/KitchenContext';
import { Order, Brand, MenuItem, OrderStatus, Channel } from '@/types';
import { useKitchenStore, selectLiveQueueOrders } from '@/stores/useKitchenStore';
import { useShallow } from 'zustand/react/shallow';

interface OrdersSectionClientProps {
  initialOrders: Order[];
  initialBrands: Brand[];
  initialMenuItems: MenuItem[];
  kitchenId?: string;
}

export function OrdersSectionClient({
  initialOrders,
  initialBrands,
  initialMenuItems,
  kitchenId,
}: OrdersSectionClientProps) {
  const {
    brands,
    menuItems,
    setBrands,
    setMenuItems,
    userRole,
    setUserRole,
    inspectingOrder,
    setInspectingOrder,
  } = useKitchen();

  const storeOrders = useKitchenStore(useShallow(selectLiveQueueOrders));
  const bumpOrderStatus = useKitchenStore((s) => s.bumpOrderStatus);
  const setBulkOrders = useKitchenStore((s) => s.setBulkOrders);

  // Hydrate local-first store on initial load if SSR has data
  React.useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setBulkOrders(initialOrders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orders = storeOrders;

  // Sync brands and menu items from server
  React.useEffect(() => {
    if (initialBrands) {
      setBrands(initialBrands);
    }
    if (initialMenuItems) {
      setMenuItems(initialMenuItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);

  const handleManualOrder = async (params: {
    brandId: string;
    channel: Channel;
    customerName: string;
    customerPhone?: string;
    customerAddress?: string;
    items: { menuItemId: string; quantity: number }[];
  }) => {
    const brand = (brands.length ? brands : initialBrands).find((b) => b.id === params.brandId) || (brands.length ? brands : initialBrands)[0];
    const availableMenuItems = menuItems.length ? menuItems : initialMenuItems;
    const tempOrderId = crypto.randomUUID();
    const prefix = params.channel === 'WALK_IN' ? 'POS' : params.channel === 'DIRECT' ? 'DIR' : 'ORD';
    const tempOrderNumber = `#${prefix}-${Math.floor(100 + Math.random() * 900)}`;

    let itemSubtotal = 0;
    const mappedItems = params.items.map((it, idx) => {
      const mi = availableMenuItems.find((m) => m.id === it.menuItemId);
      const price = mi ? mi.sellingPrice : 150;
      itemSubtotal += price * it.quantity;
      return {
        id: `item-${tempOrderId}-${idx}`,
        menuItemId: it.menuItemId,
        name: mi?.name || 'Item',
        station: mi?.station || 'GRILL',
        quantity: it.quantity,
        price,
        stationDone: false,
      };
    });

    const finalOrder: Order = {
      id: tempOrderId,
      orderNumber: tempOrderNumber,
      channel: params.channel,
      brandId: brand?.id || 'default',
      brandName: brand?.name || 'Kitchen',
      customerName: params.customerName || 'Direct Customer',
      customerPhone: params.customerPhone,
      customerAddress: params.customerAddress,
      status: 'PREPARING',
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      targetPrepMinutes: 12,
      createdAt: new Date().toISOString(),
      acknowledgedAt: new Date().toISOString(),
      items: mappedItems,
      kitchenId,
      checklist: {
        cutlery: false,
        saucesDips: false,
        napkins: false,
        tamperSeal: false,
        beverageSeparated: false,
      },
      financials: {
        grossAmount: itemSubtotal,
        discount: 0,
        commissionRate: 0,
        commissionAmount: 0,
        taxes: 0,
        packagingFeeCollected: params.channel === 'WALK_IN' ? 0 : 25,
        ingredientCost: 0,
        packagingCost: params.channel === 'WALK_IN' ? 0 : 25,
        netMargin: itemSubtotal,
        netMarginPercentage: 100,
      },
    };

    await useKitchenStore.getState().punchOrder(finalOrder);
  };

  const onUpdateStatus = async (orderId: string, status: OrderStatus) => {
    await bumpOrderStatus(orderId, status);
  };

  // Guard: Cook station mode
  if (userRole === 'LINE_COOK') {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-md w-full p-8 bg-card border border-border/80 rounded-2xl shadow-sm space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20 shadow-xs">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Cook Station Mode Active
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cooks work directly from the Kitchen Display (KDS) and Dispatch Station. Order financials, fee breakdowns, and aggregator queues are managed by store operators.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <a
              href="/kds"
              className="w-full sm:w-auto inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors"
            >
              Open KDS Cook Screen
            </a>
            <button
              onClick={() => setUserRole('OWNER')}
              className="w-full sm:w-auto inline-flex items-center justify-center min-h-[42px] px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              Switch to Owner View
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <OrdersQueueView
        orders={orders}
        onUpdateStatus={onUpdateStatus}
        onInspectFinancials={(o) => setInspectingOrder(o)}
        onOpenManualOrder={() => setIsManualOrderOpen(true)}
      />
      <ManualOrderModal
        open={isManualOrderOpen}
        onOpenChange={setIsManualOrderOpen}
        brands={brands.length ? brands : initialBrands}
        menuItems={menuItems.length ? menuItems : initialMenuItems}
        onCreateOrder={handleManualOrder}
      />
      <MarginModal
        order={inspectingOrder}
        onClose={() => setInspectingOrder(null)}
      />
    </>
  );
}
