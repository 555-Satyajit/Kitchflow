import { Suspense } from 'react';
import { InventorySection, InventorySectionSkeleton } from '@/features/inventory/components/inventory-section';

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventorySectionSkeleton />}>
      <InventorySection />
    </Suspense>
  );
}
