import { Suspense } from 'react';
import { MarginsSection, MarginsSectionSkeleton } from '@/features/margins/components/margins-section';

export default function MarginsPage() {
  return (
    <Suspense fallback={<MarginsSectionSkeleton />}>
      <MarginsSection />
    </Suspense>
  );
}
