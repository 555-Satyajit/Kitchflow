import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getOrderHistoryAction } from '@/features/orders/order-actions';
import { OrderHistoryView } from '@/features/orders/components/order-history-view';
import { requirePermission } from '@/lib/session';
import { getOrganizationKitchensAction } from '@/actions/settings';

export const metadata: Metadata = {
  title: 'Order History | KitchFlow',
  description: 'View archived and delivered orders, financial breakdowns, and print receipts.',
};

async function OrderHistoryContent() {
  await requirePermission('history', '/orders');
  const cookieStore = await cookies();
  const activeKitchenId = cookieStore.get('kitchflow_active_kitchen_id')?.value;

  const [historyResult, kitchensResult] = await Promise.all([
    getOrderHistoryAction({
      kitchenId: activeKitchenId,
      dateRange: 'ALL',
      status: 'ALL',
      channel: 'ALL',
      page: 1,
      limit: 20,
    }),
    getOrganizationKitchensAction(activeKitchenId),
  ]);

  const payload = historyResult.ok
    ? historyResult.data
    : {
        orders: [],
        totalCount: 0,
        totalRevenue: 0,
        totalFulfilled: 0,
        totalCancelled: 0,
        page: 1,
        totalPages: 1,
      };

  const outlets = kitchensResult.ok && kitchensResult.data ? kitchensResult.data.kitchens : [];
  const brands = kitchensResult.ok && kitchensResult.data ? kitchensResult.data.allBrands || kitchensResult.data.brands || [] : [];

  return (
    <OrderHistoryView
      initialOrders={payload.orders}
      initialTotal={payload.totalCount}
      initialRevenue={payload.totalRevenue}
      initialFulfilled={payload.totalFulfilled}
      initialCancelled={payload.totalCancelled}
      kitchenId={activeKitchenId}
      outlets={outlets}
      brandsList={brands}
    />
  );
}

function OrderHistorySkeleton() {
  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-4 animate-pulse">
      <div className="h-10 bg-muted/50 rounded-xl w-48" />
      <div className="h-12 bg-muted/50 rounded-2xl w-full" />
      <div className="h-64 bg-muted/40 rounded-2xl w-full" />
    </div>
  );
}

export default function OrderHistoryPage() {
  return (
    <Suspense fallback={<OrderHistorySkeleton />}>
      <OrderHistoryContent />
    </Suspense>
  );
}
