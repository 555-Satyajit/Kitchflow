'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';
import { orderTags } from './order-cache';
import { kdsTags } from '@/features/kds/kds-cache';
import { packingTags } from '@/features/packing/packing-cache';
import { inventoryTags } from '@/features/inventory/inventory-cache';
import { Channel, Order, OrderStatus, PaymentMethod, PaymentStatus, Brand, MenuItem } from '@/types';
import { calculateOrderFinancials } from '@/lib/finance';
import { INITIAL_BRANDS, INITIAL_MENU_ITEMS } from '@/lib/mockData';

export type ActionResult<T = void> =
  | ([T] extends [void] ? { ok: true; data?: undefined } : { ok: true; data: T })
  | { ok: false; error: string };

export async function updateOrderStatusAction(params: {
  orderId: string;
  status: OrderStatus;
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    const session = await getCurrentKitchenContext();
    const canUpdate = session.role === 'owner' ||
      session.permissions?.includes('orders') ||
      session.permissions?.includes('kds') ||
      session.permissions?.includes('packing') ||
      session.permissions?.includes('pos');
    if (!canUpdate) {
      return { ok: false, error: 'Unauthorized: Operational permission required' };
    }

    const { orderId, status, kitchenId } = params;

    const dataToUpdate: Prisma.OrderUpdateInput = { status };
    if (status === 'READY') {
      dataToUpdate.readyAt = new Date();
    } else if (status === 'DISPATCHED') {
      dataToUpdate.dispatchedAt = new Date();
    }

    const allowedKitchenIds = session.kitchenIds && session.kitchenIds.length > 0
      ? session.kitchenIds
      : (session.kitchenId && session.kitchenId !== 'ALL' ? [session.kitchenId] : []);

    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...(allowedKitchenIds.length > 0 ? { kitchenId: { in: allowedKitchenIds } } : {}),
      },
      select: { id: true, kitchenId: true },
    });

    if (!existingOrder) {
      return { ok: false, error: 'Order not found or unauthorized' };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: dataToUpdate,
    });

    const targetKitchenId = kitchenId || existingOrder.kitchenId;
    if (targetKitchenId) {
      revalidateTag(orderTags.kitchen(targetKitchenId), 'max');
      revalidateTag(kdsTags.kitchen(targetKitchenId), 'max');
      revalidateTag(packingTags.kitchen(targetKitchenId), 'max');
    }
    revalidateTag(orderTags.all, 'max');
    revalidateTag(kdsTags.all, 'max');
    revalidateTag(packingTags.all, 'max');

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
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('pos') && !session.permissions?.includes('orders')) {
      return { ok: false, error: 'Unauthorized: POS or Orders permission required' };
    }

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

    // Resolve brand first to get its bound kitchenId if not explicitly passed
    let targetBrand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, kitchenId: true },
    });

    // Auto-resolve kitchen within authenticated user scope
    if (!kitchenId || kitchenId === 'ALL' || kitchenId === 'default' || kitchenId === 'kitch-koramangala-01') {
      if (targetBrand?.kitchenId) {
        kitchenId = targetBrand.kitchenId;
      } else {
        kitchenId = session.kitchenId === 'ALL' ? session.kitchenIds?.[0] : session.kitchenId;
      }
    }

    if (!kitchenId) {
      return { ok: false, error: 'Active kitchen facility not found' };
    }

    // Permission Guard: verify user has permission for this kitchen
    const allowedKitchenIds = session.kitchenIds && session.kitchenIds.length > 0
      ? session.kitchenIds
      : (session.kitchenId && session.kitchenId !== 'ALL' ? [session.kitchenId] : []);

    if (allowedKitchenIds.length > 0 && !allowedKitchenIds.includes(kitchenId) && session.role !== 'owner') {
      return { ok: false, error: 'Unauthorized: You do not have permission for this kitchen outlet' };
    }

    // Ensure valid brandId under this kitchen
    if (!targetBrand || targetBrand.kitchenId !== kitchenId) {
      const fallbackBrand = await prisma.brand.findFirst({
        where: { kitchenId },
        select: { id: true, kitchenId: true },
      });
      if (fallbackBrand) {
        brandId = fallbackBrand.id;
        targetBrand = fallbackBrand;
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

    // 1. Generate clean sequential token number for today's shift (e.g., ORD-001, ORD-002)
    // Uses atomic database procedure with row-level locks, with fallback to count if function not yet applied
    let orderNumber: string;
    try {
      const seqResult = await prisma.$queryRaw<Array<{ next_token: string }>>`
        SELECT public.get_next_daily_kot_number(${kitchenId}::uuid, 'ORD') as next_token
      `;
      if (seqResult && seqResult.length > 0 && seqResult[0].next_token) {
        orderNumber = seqResult[0].next_token;
      } else {
        throw new Error('Sequence returned empty');
      }
    } catch {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayOrderCount = await prisma.order.count({
        where: {
          kitchenId,
          createdAt: { gte: startOfToday },
        },
      });
      orderNumber = `ORD-${String(todayOrderCount + 1).padStart(3, '0')}`;
    }

    // 2. Create the Order and its items
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

    // 3. ASYNCHRONOUS BACKGROUND OUTBOX: Process BOM ingredient depletion & ledger off the hot path
    // Petpooja architecture: The order is already confirmed. Heavy inventory loops run in the background!
    (async () => {
      try {
        const ingredientUsageMap = new Map<string, { totalQty: number; unit: any }>();
        for (const cartItem of items) {
          const menuItem = dbMenuItems.find((m) => m.id === cartItem.menuItemId);
          if (menuItem?.recipe && menuItem.recipe.length > 0) {
            for (const rec of menuItem.recipe) {
              const needed = rec.quantity * cartItem.quantity;
              const existing = ingredientUsageMap.get(rec.ingredientId);
              if (existing) {
                existing.totalQty += needed;
              } else {
                ingredientUsageMap.set(rec.ingredientId, {
                  totalQty: needed,
                  unit: rec.ingredient?.unit || 'g',
                });
              }
            }
          }
        }

        if (ingredientUsageMap.size > 0) {
          for (const [ingredientId, usage] of ingredientUsageMap.entries()) {
            const currentIng = await prisma.ingredient.findUnique({
              where: { id: ingredientId },
              select: { id: true, currentStock: true, minThreshold: true, unit: true },
            });

            if (currentIng) {
              const previousStock = currentIng.currentStock;
              const actualDeduction = usage.totalQty;

              const updatedIng = await prisma.ingredient.update({
                where: { id: ingredientId },
                data: {
                  currentStock: {
                    decrement: actualDeduction,
                  },
                },
              });

              const finalNewStock = updatedIng.currentStock;

              // Record in append-only stock ledger
              await prisma.stockLedgerEntry.create({
                data: {
                  ingredientId,
                  orderId: newOrder.id,
                  previousStock,
                  delta: -actualDeduction,
                  balanceAfter: finalNewStock,
                  unit: currentIng.unit,
                  reason: 'RECIPE_AUTO_CONSUMPTION',
                  notes: `Auto-deducted for Order #${newOrder.orderNumber}`,
                },
              });

              // Auto-86 check: if stock is depleted below recipe or minThreshold
              const isCritical = finalNewStock <= 0 || finalNewStock < currentIng.minThreshold;
              if (isCritical) {
                const dependentRecipes = await prisma.recipeIngredient.findMany({
                  where: { ingredientId },
                  select: {
                    menuItemId: true,
                    quantity: true,
                    menuItem: { select: { isAvailable: true } },
                  },
                });

                for (const dep of dependentRecipes) {
                  if (dep.menuItem.isAvailable && (isCritical || finalNewStock < dep.quantity)) {
                    await prisma.menuItem.update({
                      where: { id: dep.menuItemId },
                      data: {
                        isAvailable: false,
                        swiggyOnline: false,
                        zomatoOnline: false,
                        lastSyncedAt: new Date(),
                      },
                    });
                  }
                }
              }
            }
          }
        }
      } catch (bgErr) {
        console.warn('[Background Inventory Worker] Non-blocking depletion notice:', bgErr);
      }
    })();

    // Invalidate order and KDS caches immediately
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
      return { ok: true, data: { ordersCount: 0, kdsCount: 0, packingCount: 0 } };
    }

    const isAll = targetKitchenId === 'ALL';
    const kitchenWhere = isAll ? { in: allowedKitchenIds } : targetKitchenId;

    const [ordersCount, kdsCount, packingCount] = await Promise.all([
      prisma.order.count({
        where: {
          kitchenId: kitchenWhere,
          status: { notIn: ['DISPATCHED', 'CANCELLED'] },
        },
      }),
      prisma.order.count({
        where: {
          kitchenId: kitchenWhere,
          status: { in: ['ACCEPTED', 'PREPARING'] },
        },
      }),
      prisma.order.count({
        where: {
          kitchenId: kitchenWhere,
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
  } catch (error: any) {
    // Expected when unauthenticated or during initial session setup
    if (error?.name === 'AuthenticationRequiredError' || error?.name === 'KitchenNotFoundError') {
      return {
        ok: true,
        data: {
          ordersCount: 0,
          kdsCount: 0,
          packingCount: 0,
        },
      };
    }
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

/**
 * Authoritative snapshot action for client-side /orders live queue resynchronization
 * Returns the latest list of orders mapped cleanly to the Order domain interface.
 */
export async function getLatestOrdersSnapshotAction(kitchenId?: string): Promise<Order[]> {
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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const dbOrders = await prisma.order.findMany({
      where: {
        kitchenId: kitchenWhere,
        OR: [
          // Active orders
          { status: { in: ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'] } },
          // Dispatched or cancelled from today's shift
          {
            status: { in: ['DISPATCHED', 'CANCELLED'] },
            createdAt: { gte: startOfToday },
          },
        ],
      },
      include: {
        brand: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

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
      dispatchedAt: o.dispatchedAt?.toISOString(),
      deliveredAt: o.deliveredAt?.toISOString(),
      undeliveredAt: o.undeliveredAt?.toISOString(),
      undeliveredReason: o.undeliveredReason ?? undefined,
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
  } catch (error) {
    console.error('Error in getLatestOrdersSnapshotAction:', error);
    return [];
  }
}

export interface OrderHistoryParams {
  kitchenId?: string;
  brandId?: string;
  dateRange?: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'ALL';
  status?: OrderStatus | 'ALL';
  channel?: Channel | 'ALL';
  search?: string;
  page?: number;
  limit?: number;
}

export interface OrderHistoryPayload {
  orders: Order[];
  totalCount: number;
  totalRevenue: number;
  totalFulfilled: number;
  totalCancelled: number;
  page: number;
  totalPages: number;
}

export async function getOrderHistoryAction(
  params: OrderHistoryParams = {}
): Promise<ActionResult<OrderHistoryPayload>> {
  try {
    const session = await getCurrentKitchenContext();
    const canAccess = session.role === 'owner' ||
      session.role === 'admin' ||
      session.permissions?.includes('history') ||
      session.permissions?.includes('orders');
    if (!canAccess) {
      return { ok: false, error: 'Unauthorized: Permission required to view order history' };
    }

    let targetKitchenId = params.kitchenId;
    const allowedKitchenIds: string[] = session.kitchenIds || [session.kitchenId];

    // If an explicit kitchen is requested, enforce that it belongs to the user's organization!
    let kitchenWhere: Prisma.StringFilter | string;
    if (!targetKitchenId || targetKitchenId === 'ALL') {
      kitchenWhere = { in: allowedKitchenIds };
    } else {
      if (!allowedKitchenIds.includes(targetKitchenId)) {
        return { ok: false, error: 'Unauthorized: Access to this kitchen facility is denied' };
      }
      kitchenWhere = targetKitchenId;
    }

    const whereClause: Prisma.OrderWhereInput = {
      kitchenId: kitchenWhere,
    };

    // 1. Date Range Filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    if (params.dateRange === 'TODAY') {
      whereClause.createdAt = { gte: startOfToday };
    } else if (params.dateRange === 'YESTERDAY') {
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      whereClause.createdAt = { gte: startOfYesterday, lt: startOfToday };
    } else if (params.dateRange === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { gte: sevenDaysAgo };
    } else if (params.dateRange === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      whereClause.createdAt = { gte: startOfMonth };
    }

    // 2. Status Filter
    if (params.status && params.status !== 'ALL') {
      whereClause.status = params.status;
    }

    // 3. Channel Filter
    if (params.channel && params.channel !== 'ALL') {
      whereClause.channel = params.channel;
    }

    // 4. Brand Filter
    if (params.brandId && params.brandId !== 'ALL') {
      whereClause.brandId = params.brandId;
    }

    // 5. Search Query Filter (order number, phone, customer name, brand)
    if (params.search && params.search.trim()) {
      const query = params.search.trim();
      const cleanDigits = query.replace(/\D/g, '');
      whereClause.OR = [
        { orderNumber: { contains: query, mode: 'insensitive' } },
        { customerName: { contains: query, mode: 'insensitive' } },
        { brand: { name: { contains: query, mode: 'insensitive' } } },
        ...(cleanDigits.length >= 3 ? [{ customerPhone: { contains: cleanDigits } }] : []),
      ];
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(10, params.limit || 20));
    const skip = (page - 1) * limit;

    const [totalCount, dbOrders, aggregates, fulfilledCount, cancelledCount] = await Promise.all([
      prisma.order.count({ where: whereClause }),
      prisma.order.findMany({
        where: whereClause,
        include: {
          brand: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.aggregate({
        where: whereClause,
        _sum: { grossAmount: true },
      }),
      prisma.order.count({
        where: { ...whereClause, status: 'DISPATCHED' },
      }),
      prisma.order.count({
        where: { ...whereClause, status: 'CANCELLED' },
      }),
    ]);

    const mappedOrders: Order[] = dbOrders.map((o) => ({
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
      dispatchedAt: o.dispatchedAt?.toISOString(),
      deliveredAt: o.deliveredAt?.toISOString(),
      undeliveredAt: o.undeliveredAt?.toISOString(),
      undeliveredReason: o.undeliveredReason ?? undefined,
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

    return {
      ok: true,
      data: {
        orders: mappedOrders,
        totalCount,
        totalRevenue: aggregates._sum.grossAmount || 0,
        totalFulfilled: fulfilledCount,
        totalCancelled: cancelledCount,
        page,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve order history';
    console.error('Error in getOrderHistoryAction:', error);
    return { ok: false, error: message };
  }
}

export async function getPosCatalogAction(kitchenId?: string): Promise<
  ActionResult<{ brands: Brand[]; menuItems: MenuItem[] }>
> {
  try {
    const session = await getCurrentKitchenContext();

    const allowedKitchenIds = session.kitchenIds && session.kitchenIds.length > 0
      ? session.kitchenIds
      : (session.kitchenId && session.kitchenId !== 'ALL' ? [session.kitchenId] : []);

    let targetKitchenWhere: Prisma.StringFilter | string = {};
    if (kitchenId && kitchenId !== 'ALL' && kitchenId !== 'default') {
      // Strictly scope to the selected kitchen (if authorized)
      if (allowedKitchenIds.length > 0 && !allowedKitchenIds.includes(kitchenId) && session.role !== 'owner') {
        return { ok: false, error: 'Unauthorized: No permission for this kitchen outlet' };
      }
      targetKitchenWhere = kitchenId;
    } else if (kitchenId === 'ALL' || session.kitchenId === 'ALL') {
      // Scope to all kitchens the user has permission to access
      targetKitchenWhere = { in: allowedKitchenIds };
    } else {
      // Fallback to active kitchen in session
      targetKitchenWhere = session.kitchenId || (allowedKitchenIds[0] ?? '');
    }

    const [dbBrands, dbMenuItems] = await Promise.all([
      prisma.brand.findMany({
        where: { kitchenId: targetKitchenWhere },
        orderBy: { name: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { brand: { kitchenId: targetKitchenWhere } },
        include: {
          recipe: {
            include: { ingredient: true }
          }
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (dbBrands.length === 0) {
      return { ok: true, data: { brands: INITIAL_BRANDS, menuItems: INITIAL_MENU_ITEMS } };
    }

    const formattedBrands: Brand[] = dbBrands.map((b) => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline || '',
      color: b.color,
      logoUrl: b.logoUrl || undefined,
      address: b.address || undefined,
      phone: b.phone || undefined,
      email: b.email || undefined,
      fssaiLic: b.fssaiLic || undefined,
      invoiceTerms: b.invoiceTerms || undefined,
      active: b.active,
    }));

    const formattedMenuItems: MenuItem[] = dbMenuItems.map((m) => ({
      id: m.id,
      brandId: m.brandId,
      name: m.name,
      description: m.description,
      station: m.station as MenuItem['station'],
      secondaryStations: m.secondaryStations as MenuItem['secondaryStations'],
      sellingPrice: m.sellingPrice,
      packagingCost: m.packagingCost,
      isAvailable: m.isAvailable,
      swiggyOnline: m.swiggyOnline,
      zomatoOnline: m.zomatoOnline,
      lastSyncedAt: m.lastSyncedAt?.toISOString(),
      recipe: m.recipe.map((r) => ({
        ingredientId: r.ingredientId,
        ingredientName: r.ingredient?.name || '',
        quantity: r.quantity,
        unit: r.ingredient?.unit || 'g',
      })),
    }));

    return { ok: true, data: { brands: formattedBrands, menuItems: formattedMenuItems } };
  } catch (err) {
    console.warn('Error fetching POS catalog from DB, falling back:', err);
    return { ok: true, data: { brands: INITIAL_BRANDS, menuItems: INITIAL_MENU_ITEMS } };
  }
}

