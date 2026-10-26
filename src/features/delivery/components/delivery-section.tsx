import React, { Suspense } from 'react';
import { getDeliveryOrders } from '../delivery-queries';
import { DeliveryPortalClient } from './delivery-portal-client';
import { Skeleton } from '@/components/ui/skeleton';

interface DeliverySectionProps {
  kitchenId?: string;
}

export async function DeliverySection({ kitchenId }: DeliverySectionProps) {
  const orders = await getDeliveryOrders(kitchenId);

  return <DeliveryPortalClient initialOrders={orders} kitchenId={kitchenId} />;
}

export function DeliverySectionSkeleton() {
  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24 p-4 animate-in fade-in duration-200">
      {/* Subheader Skeleton */}
      <div className="flex items-center justify-between py-1">
        <Skeleton className="h-6 w-28 rounded-lg" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Active Driver Card Skeleton */}
      <div className="p-3.5 rounded-2xl border border-border/70 bg-card/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="space-y-1.5 flex flex-col items-end">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-20 rounded-lg" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-2xl border border-border/50">
        <Skeleton className="h-9 rounded-xl" />
        <Skeleton className="h-9 rounded-xl" />
        <Skeleton className="h-9 rounded-xl" />
      </div>

      {/* Search Input Skeleton */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* Delivery Cards Skeleton */}
      <div className="space-y-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border/70 bg-card/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-md" />
              </div>
              <Skeleton className="h-6 w-24 rounded-lg" />
            </div>

            <div className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-48 mt-1" />
            </div>

            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
            </div>

            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
