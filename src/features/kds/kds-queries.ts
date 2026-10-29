import 'server-only';
import { prisma } from '@/lib/prisma';
import { INITIAL_ORDERS } from '@/lib/mockData';
import { Order } from '@/types';

import { getCurrentKitchenContext } from '@/lib/session';

export async function getKdsOrders(kitchenId?: string): Promise<Order[]> {
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
        status: { in: ['ACCEPTED', 'PREPARING'] },
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
        updatedAt: (o as any).updatedAt ? (o as any).updatedAt.toISOString() : undefined,
        version: (o as any).version ?? 0,
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
          updatedAt: (it as any).updatedAt ? (it as any).updatedAt.toISOString() : undefined,
          version: (it as any).version ?? 0,
        })),
      }));
    }

    // Return empty array when no active cooking orders exist in database
    return [];
  } catch (error: any) {
    if (error?.digest === 'HANGING_PROMISE_REJECTION' || error?.digest === 'NEXT_PRERENDER_SIGNAL') {
      throw error;
    }
    console.error('Error in getKdsOrders, returning empty queue:', error);
    return [];
  }
}

export async function getKdsConfiguredStations(kitchenId?: string): Promise<string[]> {
  try {
    let targetKitchenId = kitchenId;
    let allowedKitchenIds: string[] = [];

    if (!targetKitchenId) {
      const sessionCtx = await getCurrentKitchenContext().catch(() => null);
      if (sessionCtx) {
        targetKitchenId = sessionCtx.kitchenId;
        allowedKitchenIds = sessionCtx.kitchenIds || [];
      } else {
        const defaultKitchen = await prisma.kitchen.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        targetKitchenId = defaultKitchen?.id;
      }
    } else if (targetKitchenId === 'ALL') {
      const sessionCtx = await getCurrentKitchenContext('ALL').catch(() => null);
      allowedKitchenIds = sessionCtx?.kitchenIds || [];
    }

    if (!targetKitchenId) return [];

    const isAll = targetKitchenId === 'ALL';
    const brandWhere = isAll && allowedKitchenIds.length > 0 
      ? { kitchenId: { in: allowedKitchenIds } } 
      : !isAll ? { kitchenId: targetKitchenId } : {};

    const items = await prisma.menuItem.findMany({
      where: {
        brand: brandWhere,
      },
      select: { station: true, description: true },
    });

    const set = new Set<string>();
    items.forEach((item) => {
      if (item.station && item.station !== 'ASSEMBLY') {
        set.add(item.station);
      }
      // Check for custom station metadata tag [Station: XYZ]
      const match = item.description?.match(/\[Station:\s*([^\]]+)\]/);
      if (match && match[1]) {
        set.add(match[1].trim());
      }
    });

    return Array.from(set);
  } catch (error: any) {
    if (error?.digest === 'HANGING_PROMISE_REJECTION' || error?.digest === 'NEXT_PRERENDER_SIGNAL') {
      throw error;
    }
    console.error('Error in getKdsConfiguredStations:', error);
    return [];
  }
}
