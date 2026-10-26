import { Suspense } from 'react';
import { KdsSection, KdsSectionSkeleton } from '@/features/kds/components/kds-section';

export default function KDSPage() {
  return (
    <Suspense fallback={<KdsSectionSkeleton />}>
      <KdsSection />
    </Suspense>
  );
}
