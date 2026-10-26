import { Suspense } from 'react';
import { OrdersSection, OrdersSectionSkeleton } from '@/features/orders/components/orders-section';

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersSectionSkeleton />}>
      <OrdersSection />
    </Suspense>
  );
}
