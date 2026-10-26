import 'server-only';
import { prisma } from '@/lib/prisma';
import { INITIAL_ORDERS, INITIAL_BRANDS, INITIAL_MENU_ITEMS } from '@/lib/mockData';
import { Order, Brand, MenuItem } from '@/types';
import { getCurrentKitchenContext } from '@/lib/session';

export async function getOrdersData(kitchenId?: string): Promise<{
  orders: Order[];
  brands: Brand[];
  menuItems: MenuItem[];
}> {
  try {
    let targetKitchenId = kitchenId;

    if (!targetKitchenId) {
      const sessionCtx = await getCurrentKitchenContext();
      targetKitchenId = sessionCtx.kitchenId;
    }

    if (!targetKitchenId || targetKitchenId === 'default') {
      return {
        orders: [],
        brands: [],
        menuItems: [],
      };
    }

    const [dbOrders, dbBrands, dbMenuItems] = await Promise.all([
      prisma.order.findMany({
        where: { kitchenId: targetKitchenId },
        include: {
          brand: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.brand.findMany({
        where: { kitchenId: targetKitchenId },
        orderBy: { name: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { brand: { kitchenId: targetKitchenId } },
        include: {
          recipe: {
            include: { ingredient: true },
          },
        },
        orderBy: { name: 'asc' },
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

    const mappedBrands: Brand[] = dbBrands.map((b) => ({
      id: b.id,
      name: b.name,
      tagline: b.tagline ?? '',
      color: b.color,
      logoUrl: b.logoUrl ?? undefined,
      active: b.active,
    }));

    const mappedMenuItems: MenuItem[] = dbMenuItems.map((m) => ({
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
        ingredientName: r.ingredient.name,
        quantity: r.quantity,
        unit: r.ingredient.unit,
      })),
    }));

    return {
      orders: mappedOrders,
      brands: mappedBrands,
      menuItems: mappedMenuItems,
    };
  } catch (error) {
    console.error('Error in getOrdersData, returning empty queue:', error);
    return {
      orders: [],
      brands: [],
      menuItems: [],
    };
  }
}

