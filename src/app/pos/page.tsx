import { Suspense } from 'react';
import { POSClient } from './pos-client';
import { Skeleton } from '@/components/ui/skeleton';

function POSSkeleton() {
  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-4">
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  return (
    <Suspense fallback={<POSSkeleton />}>
      <POSClient />
    </Suspense>
  );
}
