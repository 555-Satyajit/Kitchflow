import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getCustomerDirectoryAction } from '@/features/customers/customer-actions';
import { CustomerDirectoryView } from '@/features/customers/components/customer-directory-view';
import { requirePermission } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Customer Directory | KitchFlow',
  description: 'Manage customers, lifetime spend, loyalty tiers, and phone order history.',
};

async function CustomerDirectoryContent() {
  await requirePermission('customers', '/orders');
  const cookieStore = await cookies();
  const activeKitchenId = cookieStore.get('kitchflow_active_kitchen_id')?.value;

  const initialData = await getCustomerDirectoryAction({
    kitchenId: activeKitchenId,
    search: '',
    tier: 'ALL',
    limit: 0, // Load initial customer dataset for TanStack Table
  });

  return (
    <CustomerDirectoryView
      initialCustomers={initialData.customers}
      initialTotal={initialData.totalCustomers}
      initialRevenue={initialData.totalRevenue}
      initialVipCount={initialData.vipCount}
      initialRepeatRate={initialData.repeatRate}
      kitchenId={activeKitchenId}
    />
  );
}

function CustomerDirectorySkeleton() {
  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-4 animate-pulse">
      <div className="h-10 bg-muted/50 rounded-xl w-48" />
      <div className="grid grid-cols-4 gap-3">
        <div className="h-20 bg-muted/50 rounded-2xl" />
        <div className="h-20 bg-muted/50 rounded-2xl" />
        <div className="h-20 bg-muted/50 rounded-2xl" />
        <div className="h-20 bg-muted/50 rounded-2xl" />
      </div>
      <div className="h-64 bg-muted/40 rounded-2xl w-full" />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomerDirectorySkeleton />}>
      <CustomerDirectoryContent />
    </Suspense>
  );
}
