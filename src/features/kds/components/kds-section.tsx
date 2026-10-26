import React from 'react';
import { getKdsOrders, getKdsConfiguredStations } from '../kds-queries';
import { KdsSectionClient } from './kds-section-client';
import { Skeleton } from '@/components/ui/skeleton';

interface KdsSectionProps {
  kitchenId?: string;
}

export async function KdsSection({ kitchenId }: KdsSectionProps) {
  const [orders, configuredStations] = await Promise.all([
    getKdsOrders(kitchenId),
    getKdsConfiguredStations(kitchenId),
  ]);

  return (
    <KdsSectionClient
      initialOrders={orders}
      configuredStations={configuredStations}
      kitchenId={kitchenId}
    />
  );
}

export function KdsSectionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Station Filters Strip Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Station Pills Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Ticket Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/70 bg-card/70 p-4 space-y-4">
            <div className="flex justify-between items-start border-b border-border/40 pb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            <div className="pt-2 border-t border-border/40 flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
