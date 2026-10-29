import React from 'react';
import { getCurrentKitchenContext } from '@/lib/session';
import { getNavCountsAction } from '@/features/orders/order-actions';
import { NavigationBar } from './NavigationBar';

export async function NavigationBarServer() {
  let role: 'owner' | 'manager' | 'kitchen_staff' = 'owner';
  let permissions: string[] = ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings'];
  let initialCounts: any = null;

  try {
    const session = await getCurrentKitchenContext();
    if (session) {
      role = (session.role === 'owner' ? 'owner' : session.role === 'manager' ? 'manager' : 'kitchen_staff');
      permissions = session.permissions || ['orders', 'kds', 'packing'];

      const countsRes = await getNavCountsAction(session.kitchenId);
      if (countsRes.ok) {
        initialCounts = countsRes.data;
      }
    }
  } catch (e) {
    // Session resolution non-fatal on public/pre-auth routes
  }

  return (
    <NavigationBar
      initialRole={role}
      initialPermissions={permissions}
      initialNavCounts={initialCounts}
    />
  );
}

