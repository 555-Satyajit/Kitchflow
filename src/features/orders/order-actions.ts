'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';
import { orderTags } from './order-cache';
import { Channel, OrderStatus, PaymentMethod, PaymentStatus } from '@/types';
import { calculateOrderFinancials } from '@/lib/finance';

export type ActionResult<T = void> = 
  | ([T] extends [void] ? { ok: true; data?: undefined } : { ok: true; data: T })
  | { ok: false; error: string };

export async function updateOrderStatusAction(params: {
  orderId: string;
  status: OrderStatus;
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    const { orderId, status, kitchenId } = params;

    const dataToUpdate: Prisma.OrderUpdateInput = { status };
    if (status === 'READY') {
      dataToUpdate.readyAt = new Date();
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (existingOrder) {
      await prisma.order.update({
        where: { id: orderId },
        data: dataToUpdate,
      });

      if (kitchenId) {
        revalidateTag(orderTags.kitchen(kitchenId), 'max');
      }
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update order status';
    console.error('Error updating order status:', error);
    return { ok: false, error: message };
  }
}

export async function createManualOrderAction(params: {
  kitchenId?: string;
  brandId: string;
  channel: Channel;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  items: { menuItemId: string; quantity: number }[];
}): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  try {
    let {
      kitchenId,
      brandId,
      channel,
      customerName,
      customerPhone,
      customerAddress,
      paymentMethod = 'COD',
      paymentStatus = 'PENDING',
      items,
    } = params;

    // Auto-resolve kitchen if missing or dummy
    if (!kitchenId || kitchenId === 'kitch-koramangala-01') {
      const defaultKitchen = await prisma.kitchen.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      kitchenId = defaultKitchen?.id;
    }

    if (!kitchenId) {
      return { ok: false, error: 'Active kitchen facility not found' };
    }

    // Ensure valid brandId
    const brandExists = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });

    if (!brandExists) {
      const fallbackBrand = await prisma.brand.findFirst({
        where: { kitchenId },
        select: { id: true },
      });
      if (fallbackBrand) {
        brandId = fallbackBrand.id;
      }
    }

    // Fetch menu items with recipe ingredients to compute exact financial totals & margins
    const menuItemIds = items.map((i) => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: {
        recipe: {
          include: { ingredient: true },
        },
      },
    });

    let itemSubtotal = 0;
    let packagingMaterialCost = 0;
    let totalIngredientCost = 0;

    const orderItemsData = items.map((cartItem) => {
      const menuItem = dbMenuItems.find((m) => m.id === cartItem.menuItemId);
      const price = menuItem ? menuItem.sellingPrice : 0;
      const pack = menuItem ? menuItem.packagingCost : 0;

      // Calculate ingredient cost for this dish
      let dishIngCost = 0;
      if (menuItem?.recipe) {
        dishIngCost = menuItem.recipe.reduce((sum, r) => sum + r.quantity * (r.ingredient?.costPerUnit || 0), 0);
      }

      itemSubtotal += price * cartItem.quantity;
      packagingMaterialCost += pack * cartItem.quantity;
      totalIngredientCost += dishIngCost * cartItem.quantity;

      return {
        menuItemId: cartItem.menuItemId,
        name: menuItem?.name || 'Item',
        station: menuItem?.station || 'PACKING',
        quantity: cartItem.quantity,
        price,
        stationDone: false,
      };
    });

    const commRate = channel === 'DIRECT' || channel === 'WALK_IN' ? 0.0 : channel === 'SWIGGY' ? 0.22 : 0.24;
    const { financials } = calculateOrderFinancials({
      itemSubtotal,
      packagingFeeCollected: channel === 'WALK_IN' ? 0 : packagingMaterialCost,
      customerDiscount: 0,
      commissionRate: commRate,
      ingredientCost: totalIngredientCost,
      packagingMaterialCost,
    });

    const orderNumber = `ORD-${Date.now().toString().slice(-4)}`;

    const newOrder = await prisma.order.create({
      data: {
        kitchenId,
        brandId,
        channel,
        orderNumber,
        customerName,
        customerPhone,
        customerAddress,
        status: 'PREPARING', // Auto-cook: routes straight to cook line as active cooking
        paymentMethod,
        paymentStatus,
        grossAmount: financials.grossAmount,
        discount: financials.discount,
        commissionRate: financials.commissionRate,
        commissionAmount: financials.commissionAmount,
        taxes: financials.taxes,
        packagingFeeCollected: financials.packagingFeeCollected,
        ingredientCost: financials.ingredientCost,
        packagingCost: financials.packagingCost,
        netMargin: financials.netMargin,
        netMarginPercentage: financials.netMarginPercentage,
        items: {
          create: orderItemsData,
        },
      },
    });

    revalidateTag(orderTags.kitchen(kitchenId), 'max');
    revalidateTag(`kds:${kitchenId}:orders`, 'max');
    revalidateTag('packing', 'max');

    return { ok: true, data: { orderId: newOrder.id, orderNumber: newOrder.orderNumber } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    console.error('Error creating manual order:', error);
    return { ok: false, error: message };
  }
}

export async function searchCustomersAction(query: string): Promise<
  ActionResult<Array<{ name: string; phone: string; address?: string }>>
> {
  try {
    const cleanDigits = query.replace(/\D/g, '');
    const trimmed = query.trim();

    if (!trimmed && !cleanDigits) {
      return { ok: true, data: [] };
    }

    const matchedOrders = await prisma.order.findMany({
      where: {
        OR: [
          ...(cleanDigits.length >= 3 ? [{ customerPhone: { contains: cleanDigits } }] : []),
          ...(trimmed.length >= 2 ? [{ customerName: { contains: trimmed, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: {
        customerName: true,
        customerPhone: true,
        customerAddress: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const uniqueMap = new Map<string, { name: string; phone: string; address?: string }>();

    for (const ord of matchedOrders) {
      if (ord.customerPhone) {
        const key = ord.customerPhone.replace(/\D/g, '');
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, {
            name: ord.customerName || 'Customer',
            phone: ord.customerPhone,
            address: ord.customerAddress || undefined,
          });
        }
      }
    }

    return { ok: true, data: Array.from(uniqueMap.values()) };
  } catch (error) {
    console.error('Error searching customers:', error);
    return { ok: false, error: 'Failed searching customer directory' };
  }
}

import { getCurrentKitchenContext } from '@/lib/session';

export interface NavCountsResult {
  ordersCount: number;
  kdsCount: number;
  packingCount: number;
}

export async function getNavCountsAction(kitchenId?: string): Promise<ActionResult<NavCountsResult>> {
  try {
    let targetKitchenId = kitchenId;
    if (!targetKitchenId) {
      const sessionCtx = await getCurrentKitchenContext();
      targetKitchenId = sessionCtx.kitchenId;
    }

    if (!targetKitchenId || targetKitchenId === 'default') {
      return { ok: true, data: { ordersCount: 0, kdsCount: 0, packingCount: 0 } };
    }

    const [ordersCount, kdsCount, packingCount] = await Promise.all([
      prisma.order.count({
        where: { kitchenId: targetKitchenId },
      }),
      prisma.order.count({
        where: {
          kitchenId: targetKitchenId,
          status: { in: ['ACCEPTED', 'PREPARING'] },
        },
      }),
      prisma.order.count({
        where: {
          kitchenId: targetKitchenId,
          status: { in: ['PREPARING', 'READY'] },
        },
      }),
    ]);

    return {
      ok: true,
      data: {
        ordersCount,
        kdsCount,
        packingCount,
      },
    };
  } catch (error) {
    console.error('Error in getNavCountsAction:', error);
    return {
      ok: true,
      data: {
        ordersCount: 0,
        kdsCount: 0,
        packingCount: 0,
      },
    };
  }
}

