'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';
import { kdsTags } from './kds-cache';

export type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function toggleStationItemAction(params: {
  orderId: string;
  itemId: string;
  kitchenId?: string;
  targetDone?: boolean;
  clientVersion?: number;
}): Promise<ActionResult<{ isDone: boolean; version: number }>> {
  try {
    const { orderId, itemId, kitchenId, targetDone, clientVersion } = params;

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      select: { id: true, stationDone: true, version: true },
    });

    if (!item) {
      return { ok: false, error: 'Order item not found' };
    }

    // Hardened Concurrency Gate: Deterministic Integer Sequence Matching (Zero Clock Drift Risk)
    // If the database version is HIGHER than the version the cook was looking at,
    // another station cook updated the item first. Drop the stale modification.
    if (typeof clientVersion === 'number' && typeof (item as any).version === 'number') {
      if ((item as any).version > clientVersion) {
        return { 
          ok: true, 
          data: { 
            isDone: item.stationDone, 
            version: (item as any).version 
          } 
        };
      }
    }

    const nextDone = typeof targetDone === 'boolean' ? targetDone : !item.stationDone;

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { 
        stationDone: nextDone,
        updatedAt: new Date(),
        version: { increment: 1 },
      },
      select: { id: true, stationDone: true, version: true },
    });

    // Check if all items in this order are now done
    const remainingUndone = await prisma.orderItem.count({
      where: {
        orderId,
        stationDone: false,
      },
    });

    if (remainingUndone === 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'READY',
          readyAt: new Date(),
        },
      });
    } else {
      // If order was ACCEPTED, advance it to PREPARING now that line cooking is in progress
      await prisma.order.updateMany({
        where: { id: orderId, status: 'ACCEPTED' },
        data: { status: 'PREPARING' },
      });
    }

    if (kitchenId) {
      revalidateTag(kdsTags.kitchen(kitchenId), 'max');
    }

    return { 
      ok: true, 
      data: { 
        isDone: updated.stationDone, 
        version: (updated as any).version ?? 0
      } 
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle station item';
    console.error('Error toggling station item:', error);
    return { ok: false, error: message };
  }
}

export async function markOrderReadyAction(params: {
  orderId: string;
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    const { orderId, kitchenId } = params;

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'READY',
        readyAt: new Date(),
      },
    });

    if (kitchenId) {
      revalidateTag(kdsTags.kitchen(kitchenId), 'max');
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark order ready';
    console.error('Error marking order ready:', error);
    return { ok: false, error: message };
  }
}

export async function fetchKdsOrdersClientAction(kitchenId?: string) {
  try {
    let targetKitchenId = kitchenId;
    if (!targetKitchenId) {
      const defaultKitchen = await prisma.kitchen.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      targetKitchenId = defaultKitchen?.id;
    }

    if (!targetKitchenId) return [];

    const dbOrders = await prisma.order.findMany({
      where: {
        kitchenId: targetKitchenId,
        status: { notIn: ['DISPATCHED', 'CANCELLED'] },
      },
      include: {
        brand: true,
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return dbOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      channel: o.channel,
      brandId: o.brandId,
      brandName: o.brand.name,
      customerName: o.customerName ?? 'Guest Customer',
      customerPhone: o.customerPhone ?? undefined,
      customerAddress: o.customerAddress ?? undefined,
      status: o.status,
      paymentMethod: o.paymentMethod ?? 'COD',
      paymentStatus: o.paymentStatus ?? 'PENDING',
      targetPrepMinutes: o.targetPrepMinutes,
      createdAt: o.createdAt.toISOString(),
      updatedAt: (o as any).updatedAt ? (o as any).updatedAt.toISOString() : undefined,
      version: (o as any).version ?? 0,
      acknowledgedAt: o.acknowledgedAt?.toISOString(),
      readyAt: o.readyAt?.toISOString(),
      checklist: (o.checklist as any) ?? {
        cutlery: false,
        saucesDips: false,
        napkins: false,
        tamperSeal: false,
        beverageSeparated: false,
      },
      dynamicChecklist: (o.dynamicChecklist as any) ?? undefined,
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
        station: it.station,
        secondaryStations: it.secondaryStations,
        quantity: it.quantity,
        price: it.price,
        stationDone: it.stationDone,
        updatedAt: (it as any).updatedAt ? (it as any).updatedAt.toISOString() : undefined,
        version: (it as any).version ?? 0,
      })),
    }));
  } catch (e) {
    console.error('Error fetching fresh KDS orders for client:', e);
    return [];
  }
}

/**
 * Authoritative KDS snapshot action for client reconnection resync.
 * Pulls active orders sorted by creation time, excluding dead or finished orders.
 */
export async function getLatestKdsSnapshotAction(kitchenId?: string) {
  return fetchKdsOrdersClientAction(kitchenId);
}


