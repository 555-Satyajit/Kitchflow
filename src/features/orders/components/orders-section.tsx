import React from 'react';
import { getOrdersData } from '../order-queries';
import { OrdersSectionClient } from './orders-section-client';
import { Skeleton } from '@/components/ui/skeleton';
import { requirePermission } from '@/lib/session';

interface OrdersSectionProps {
  kitchenId?: string;
}

export async function OrdersSection({ kitchenId }: OrdersSectionProps) {
  await requirePermission('orders');
  const data = await getOrdersData(kitchenId);

  return (
    <OrdersSectionClient
      initialOrders={data.orders}
      initialBrands={data.brands}
      initialMenuItems={data.menuItems}
      kitchenId={kitchenId}
    />
  );
}

export function OrdersSectionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* KPI Financial Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Orders Queue List Skeleton */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-border/40 bg-muted/20 flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>

              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
