'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTag, revalidatePath } from 'next/cache';
import { kdsTags } from './kds-cache';
import { packingTags } from '@/features/packing/packing-cache';
import { orderTags } from '@/features/orders/order-cache';

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
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('kds')) {
      return { ok: false, error: 'Unauthorized: KDS Cook permission required' };
    }

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

    // If order was ACCEPTED, advance it to PREPARING now that line cooking is in progress
    await prisma.order.updateMany({
      where: { id: orderId, status: 'ACCEPTED' },
      data: { status: 'PREPARING' },
    });

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
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('kds')) {
      return { ok: false, error: 'Unauthorized: KDS Cook permission required' };
    }

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
      revalidateTag(packingTags.kitchen(kitchenId), 'max');
      revalidateTag(orderTags.kitchen(kitchenId), 'max');
    }
    revalidateTag(kdsTags.all, 'max');
    revalidateTag(packingTags.all, 'max');
    revalidateTag(orderTags.all, 'max');

    try {
      revalidatePath('/packing');
      revalidatePath('/kds');
      revalidatePath('/orders');
    } catch {}

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark order ready';
    console.error('Error marking order ready:', error);
    return { ok: false, error: message };
  }
}

import { getCurrentKitchenContext } from '@/lib/session';

export async function fetchKdsOrdersClientAction(kitchenId?: string) {
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


