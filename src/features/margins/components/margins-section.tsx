import React from 'react';
import { getMarginsOrders } from '../margins-queries';
import { MarginsSectionClient } from './margins-section-client';
import { Skeleton } from '@/components/ui/skeleton';

interface MarginsSectionProps {
  kitchenId?: string;
}

export async function MarginsSection({ kitchenId }: MarginsSectionProps) {
  const orders = await getMarginsOrders(kitchenId);

  return <MarginsSectionClient initialOrders={orders} />;
}

export function MarginsSectionSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded-md" />
            </div>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Analytics Breakdown & Table Skeleton */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3.5 rounded-xl border border-border/40 bg-muted/20 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
