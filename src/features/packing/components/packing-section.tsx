import React from 'react';
import { getPackingOrders } from '../packing-queries';
import { PackingSectionClient } from './packing-section-client';
import { Skeleton } from '@/components/ui/skeleton';

interface PackingSectionProps {
  kitchenId?: string;
}

export async function PackingSection({ kitchenId }: PackingSectionProps) {
  const orders = await getPackingOrders(kitchenId);

  return <PackingSectionClient initialOrders={orders} kitchenId={kitchenId} />;
}

export function PackingSectionSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Packing Order Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/70 bg-card/60 p-5 space-y-4">
            <div className="flex justify-between items-start border-b border-border/40 pb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Checklist Skeletons */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded-md" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>

            <Skeleton className="h-10 w-full rounded-xl mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
