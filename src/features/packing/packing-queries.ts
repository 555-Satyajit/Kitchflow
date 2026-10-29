import 'server-only';
import { prisma } from '@/lib/prisma';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { Order } from '@/types';

import { getCurrentKitchenContext } from '@/lib/session';

export async function getPackingOrders(kitchenId?: string): Promise<Order[]> {
  try {
    let targetKitchenId = kitchenId;
    let allowedKitchenIds: string[] = [];

    if (!targetKitchenId) {
      const sessionCtx = await getCurrentKitchenContext();
      targetKitchenId = sessionCtx.kitchenId;
      allowedKitchenIds = sessionCtx.kitchenIds || [];
    } else if (targetKitchenId === 'ALL') {
      const sessionCtx = await getCurrentKitchenContext('ALL');
      allowedKitchenIds = sessionCtx.kitchenIds || [];
    }

    if (!targetKitchenId || targetKitchenId === 'default') {
      return [];
    }

    const isAll = targetKitchenId === 'ALL';
    const kitchenWhere = isAll ? { in: allowedKitchenIds } : targetKitchenId;

    const dbOrders = await prisma.order.findMany({
      where: {
        kitchenId: kitchenWhere,
        status: { in: ['PREPARING', 'READY'] },
      },
      include: {
        brand: true,
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (dbOrders.length > 0) {
      return dbOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        channel: o.channel as Order['channel'],
        brandId: o.brandId,
        brandName: o.brand.name,
        customerName: o.customerName ?? 'Guest Customer',
        customerPhone: o.customerPhone ?? undefined,
        customerAddress: o.customerAddress ?? undefined,
        status: o.status as Order['status'],
        paymentMethod: (o.paymentMethod as Order['paymentMethod']) ?? 'COD',
        paymentStatus: (o.paymentStatus as Order['paymentStatus']) ?? 'PENDING',
        targetPrepMinutes: o.targetPrepMinutes,
        createdAt: o.createdAt.toISOString(),
        acknowledgedAt: o.acknowledgedAt?.toISOString(),
        readyAt: o.readyAt?.toISOString(),
        checklist: (o.checklist as unknown as Order['checklist']) ?? {
          cutlery: false,
          saucesDips: false,
          napkins: false,
          tamperSeal: false,
          beverageSeparated: false,
        },
        dynamicChecklist: (o.dynamicChecklist as unknown as Order['dynamicChecklist']) ?? undefined,
        financials: {
          grossAmount: o.grossAmount,
          discount: o.discount,
          commissionRate: o.commissionRate,
          commissionAmount: o.commissionAmount,
          taxes: o.taxes,
          packagingFeeCollected: o.packagingFeeCollected,
          ingredientCost: o.ingredientCost,
          packagingCost: o.packagingCost,
          netMargin: o.netMargin,
          netMarginPercentage: o.netMarginPercentage,
        },
        items: o.items.map((it) => ({
          id: it.id,
          menuItemId: it.menuItemId ?? '',
          name: it.name,
          station: it.station as Order['items'][number]['station'],
          secondaryStations: it.secondaryStations as Order['items'][number]['secondaryStations'],
          quantity: it.quantity,
          price: it.price,
          stationDone: it.stationDone,
        })),
      }));
    }

    return [];
  } catch (error: any) {
    if (error?.digest === 'HANGING_PROMISE_REJECTION' || error?.digest === 'NEXT_PRERENDER_SIGNAL') {
      throw error;
    }
    console.error('Error in getPackingOrders, returning empty list:', error);
    return [];
  }
}
