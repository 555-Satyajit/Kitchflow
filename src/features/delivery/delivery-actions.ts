'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTag, revalidatePath } from 'next/cache';
import { orderTags } from '@/features/orders/order-cache';
import { packingTags } from '@/features/packing/packing-cache';
import { kdsTags } from '@/features/kds/kds-cache';
import { getCurrentKitchenContext } from '@/lib/session';
import { Order } from '@/types';

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Fetch delivery orders directly on client or server with full multi-tenant & outlet filtering
 */
export async function fetchDeliveryOrdersClientAction(kitchenId?: string): Promise<Order[]> {
  try {
    const { getDeliveryOrders } = await import('./delivery-queries');
    return await getDeliveryOrders(kitchenId);
  } catch (err) {
    console.error('Failed fetching delivery orders in client action:', err);
    return [];
  }
}

/**
 * Mark a direct delivery order as handed over to customer (Delivered)
 */
export async function markDeliveryCompletedAction(params: {
  orderId: string;
  kitchenId?: string;
}): Promise<ActionResult<{ orderId: string; status: string }>> {
  try {
    const session = await getCurrentKitchenContext();
    const canComplete = session.role === 'owner' ||
      session.permissions?.includes('orders') ||
      session.permissions?.includes('packing') ||
      session.permissions?.includes('pos') ||
      session.permissions?.includes('delivery');

    if (!canComplete) {
      return { ok: false, error: 'Unauthorized: Delivery permission required' };
    }

    const { orderId, kitchenId } = params;

    const allowedKitchenIds = session.kitchenIds && session.kitchenIds.length > 0
      ? session.kitchenIds
      : (session.kitchenId && session.kitchenId !== 'ALL' ? [session.kitchenId] : []);

    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...(allowedKitchenIds.length > 0 ? { kitchenId: { in: allowedKitchenIds } } : {}),
      },
      select: { id: true, kitchenId: true, paymentMethod: true, paymentStatus: true },
    });

    if (!existingOrder) {
      return { ok: false, error: 'Order not found or unauthorized' };
    }

    // Auto-resolve payment status: if COD or PENDING, mark PAID upon successful delivery
    const updatedPaymentStatus = existingOrder.paymentStatus === 'PENDING' ? 'PAID' : existingOrder.paymentStatus;

    // Dispatched orders marked delivered have completed their lifecycle
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'DISPATCHED',
          deliveredAt: new Date(),
          paymentStatus: updatedPaymentStatus,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma client schema cache mismatch, executing raw SQL fallback for deliveredAt:', prismaErr?.message);
      await prisma.$executeRaw`
        UPDATE "orders"
        SET "status" = 'DISPATCHED'::"OrderStatus",
            "delivered_at" = NOW(),
            "payment_status" = ${updatedPaymentStatus}::"PaymentStatus",
            "updated_at" = NOW()
        WHERE "id" = ${orderId}
      `;
    }

    const targetKitchenId = kitchenId || existingOrder.kitchenId;
    if (targetKitchenId) {
      revalidateTag(orderTags.kitchen(targetKitchenId), 'max');
      revalidateTag(packingTags.kitchen(targetKitchenId), 'max');
      revalidateTag(kdsTags.kitchen(targetKitchenId), 'max');
    }
    revalidatePath('/delivery');
    revalidatePath('/orders');
    revalidatePath('/packing');

    return { ok: true, data: { orderId, status: 'DISPATCHED' } };
  } catch (error: any) {
    console.error('Error marking delivery complete:', error);
    return { ok: false, error: error?.message || 'Failed to complete delivery run' };
  }
}

/**
 * Rider Delivery Failure Action: if customer is unreachable, wrong address, rejected, etc.
 */
export async function markDeliveryFailedAction(params: {
  orderId: string;
  reason: string;
  kitchenId?: string;
}): Promise<ActionResult<{ orderId: string; status: string }>> {
  try {
    const session = await getCurrentKitchenContext();
    const canFail = session.role === 'owner' ||
      session.permissions?.includes('orders') ||
      session.permissions?.includes('packing') ||
      session.permissions?.includes('pos') ||
      session.permissions?.includes('delivery');

    if (!canFail) {
      return { ok: false, error: 'Unauthorized: Delivery permission required' };
    }

    const { orderId, reason, kitchenId } = params;

    const allowedKitchenIds = session.kitchenIds && session.kitchenIds.length > 0
      ? session.kitchenIds
      : (session.kitchenId && session.kitchenId !== 'ALL' ? [session.kitchenId] : []);

    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...(allowedKitchenIds.length > 0 ? { kitchenId: { in: allowedKitchenIds } } : {}),
      },
      select: { id: true, kitchenId: true, customerAddress: true },
    });

    if (!existingOrder) {
      return { ok: false, error: 'Order not found or unauthorized' };
    }

    const updatedAddress = existingOrder.customerAddress
      ? `${existingOrder.customerAddress} [DELIVERY FAILED: ${reason}]`
      : `[DELIVERY FAILED: ${reason}]`;

    // Mark as CANCELLED with failure reason and exact timestamp in database schema
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          undeliveredAt: new Date(),
          undeliveredReason: reason,
          customerAddress: updatedAddress,
        },
      });
    } catch (prismaErr: any) {
      console.warn('Prisma client schema cache mismatch, executing raw SQL fallback for undeliveredAt:', prismaErr?.message);
      await prisma.$executeRaw`
        UPDATE "orders"
        SET "status" = 'CANCELLED'::"OrderStatus",
            "undelivered_at" = NOW(),
            "undelivered_reason" = ${reason},
            "customer_address" = ${updatedAddress},
            "updated_at" = NOW()
        WHERE "id" = ${orderId}
      `;
    }

    const targetKitchenId = kitchenId || existingOrder.kitchenId;
    if (targetKitchenId) {
      revalidateTag(orderTags.kitchen(targetKitchenId), 'max');
      revalidateTag(packingTags.kitchen(targetKitchenId), 'max');
      revalidateTag(kdsTags.kitchen(targetKitchenId), 'max');
    }
    revalidatePath('/delivery');
    revalidatePath('/orders');
    revalidatePath('/packing');

    return { ok: true, data: { orderId, status: 'CANCELLED' } };
  } catch (error: any) {
    console.error('Error marking delivery failed:', error);
    return { ok: false, error: error?.message || 'Failed to mark delivery failed' };
  }
}
