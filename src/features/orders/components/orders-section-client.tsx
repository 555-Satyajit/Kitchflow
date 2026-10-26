'use client';

import React, { useState } from 'react';
import { OrdersQueueView } from '@/components/orders/OrdersQueueView';
import { MarginModal } from '@/components/margins/MarginModal';
import { ManualOrderModal } from '@/components/orders/ManualOrderModal';
import { useKitchen } from '@/context/KitchenContext';
import { Order, Brand, MenuItem } from '@/types';

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
}: OrdersSectionClientProps) {
  const {
    orders,
    brands,
    menuItems,
    setOrders,
    setIsOrdersLoaded,
    setBrands,
    setMenuItems,
    userRole,
    setUserRole,
    handleUpdateStatus,
    inspectingOrder,
    setInspectingOrder,
    handleSimulateNewOrder,
    handleCreateManualOrder,
  } = useKitchen();

  // Sync live database orders and brands from server component into context state
  React.useEffect(() => {
    if (initialOrders) {
      setOrders(initialOrders);
      setIsOrdersLoaded(true);
    }
    if (initialBrands && initialBrands.length > 0) {
      setBrands(initialBrands);
    }
    if (initialMenuItems && initialMenuItems.length > 0) {
      setMenuItems(initialMenuItems);
    }
  }, [initialOrders, initialBrands, initialMenuItems, setOrders, setIsOrdersLoaded, setBrands, setMenuItems]);

  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);

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
        onUpdateStatus={handleUpdateStatus}
        onInspectFinancials={(o) => setInspectingOrder(o)}
        onSimulateNewOrder={handleSimulateNewOrder}
        onOpenManualOrder={() => setIsManualOrderOpen(true)}
      />
      <ManualOrderModal
        open={isManualOrderOpen}
        onOpenChange={setIsManualOrderOpen}
        brands={brands.length ? brands : initialBrands}
        menuItems={menuItems.length ? menuItems : initialMenuItems}
        onCreateOrder={handleCreateManualOrder}
      />
      <MarginModal
        order={inspectingOrder}
        onClose={() => setInspectingOrder(null)}
      />
    </>
  );
}
