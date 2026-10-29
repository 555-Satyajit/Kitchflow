import React from 'react';
import { getInventoryData } from '../inventory-queries';
import { InventorySectionClient } from './inventory-section-client';
import { Skeleton } from '@/components/ui/skeleton';
import { requirePermission } from '@/lib/session';

interface InventorySectionProps {
  kitchenId?: string;
}

export async function InventorySection({ kitchenId }: InventorySectionProps) {
  await requirePermission('inventory');
  const data = await getInventoryData(kitchenId);

  return (
    <InventorySectionClient
      initialIngredients={data.ingredients}
      initialMenuItems={data.menuItems}
      initialBrands={data.brands}
      initialStockLedger={data.stockLedger}
      initialPurchaseOrders={data.purchaseOrders}
      kitchenId={kitchenId}
    />
  );
}

export function InventorySectionSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header & Search Bar Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Tabs & Table Skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-border/60 pb-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden">
          <div className="p-4 border-b border-border/60 flex justify-between">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <div className="divide-y divide-border/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
