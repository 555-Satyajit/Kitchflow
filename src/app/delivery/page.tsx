import { Suspense } from 'react';
import { DeliverySection, DeliverySectionSkeleton } from '@/features/delivery/components/delivery-section';

export default function DeliveryPage() {
  return (
    <Suspense fallback={<DeliverySectionSkeleton />}>
      <DeliverySection />
    </Suspense>
  );
}
