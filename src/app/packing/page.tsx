import { Suspense } from 'react';
import { PackingSection, PackingSectionSkeleton } from '@/features/packing/components/packing-section';

export default function PackingPage() {
  return (
    <Suspense fallback={<PackingSectionSkeleton />}>
      <PackingSection />
    </Suspense>
  );
}
