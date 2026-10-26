import 'server-only';
import { prisma } from '@/lib/prisma';
import { 
  INITIAL_INGREDIENTS, 
  INITIAL_MENU_ITEMS, 
  INITIAL_BRANDS, 
  INITIAL_STOCK_LEDGER, 
  INITIAL_PURCHASE_ORDERS 
} from '@/lib/mockData';
import { Brand, Ingredient, MenuItem, StockLedgerEntry, PurchaseOrder } from '@/types';

import { getCurrentKitchenContext } from '@/lib/session';

export async function getInventoryData(kitchenId?: string): Promise<{
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  brands: Brand[];
  stockLedger: StockLedgerEntry[];
  purchaseOrders: PurchaseOrder[];
}> {
  try {
    let targetKitchenId = kitchenId;
    if (!targetKitchenId) {
      const sessionCtx = await getCurrentKitchenContext();
      targetKitchenId = sessionCtx.kitchenId;
    }

    if (!targetKitchenId || targetKitchenId === 'default') {
      return {
        ingredients: [],
        menuItems: [],
        brands: [],
        stockLedger: [],
        purchaseOrders: [],
      };
    }

    const [dbIngredients, dbMenuItems, dbBrands, dbLedger, dbPurchaseOrders] = await Promise.all([
      prisma.ingredient.findMany({
        where: { kitchenId: targetKitchenId },
        orderBy: { name: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { brand: { kitchenId: targetKitchenId } },
        include: {
          recipe: {
            include: { ingredient: true }
          }
        },
        orderBy: { name: 'asc' },
      }),
      prisma.brand.findMany({
        where: { kitchenId: targetKitchenId },
        orderBy: { name: 'asc' },
      }),
      prisma.stockLedgerEntry.findMany({
        where: { ingredient: { kitchenId: targetKitchenId } },
        include: { ingredient: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.purchaseOrder.findMany({
        where: { kitchenId: targetKitchenId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ingredients: dbIngredients.map((i) => ({
        id: i.id,
        brandId: i.brandId ?? undefined,
        name: i.name,
        category: (i.category as Ingredient['category']) ?? 'DRY_STAPLES',
        supplierName: i.supplierName ?? undefined,
        storageZone: (i.storageZone as Ingredient['storageZone']) ?? 'DRY_STORE',
        unit: i.unit as Ingredient['unit'],
        currentStock: i.currentStock,
        minThreshold: i.minThreshold,
        costPerUnit: i.costPerUnit,
      })),
      menuItems: dbMenuItems.map((m) => {
        const customMatch = m.description?.match(/\[Station:\s*([^\]]+)\]/);
        const customStation = customMatch ? customMatch[1].trim() : null;
        const cleanDescription = m.description?.replace(/\s*•\s*\[Station:\s*[^\]]+\]/, '').replace(/\[Station:\s*[^\]]+\]/, '').trim();

        return {
          id: m.id,
          brandId: m.brandId,
          name: m.name,
          description: cleanDescription || '',
          station: (customStation || m.station) as MenuItem['station'],
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
        };
      }),
      brands: dbBrands.map((b) => ({
        id: b.id,
        name: b.name,
        tagline: b.tagline ?? '',
        color: b.color,
        logoUrl: b.logoUrl ?? undefined,
        active: b.active,
      })),
      stockLedger: dbLedger.map((l) => ({
        id: l.id,
        ingredientId: l.ingredientId,
        ingredientName: l.ingredient.name,
        previousStock: l.previousStock,
        delta: l.delta,
        newStock: l.balanceAfter,
        unit: l.unit,
        reason: l.reason as StockLedgerEntry['reason'],
        note: l.notes ?? undefined,
        timestamp: l.createdAt.toISOString(),
      })),
      purchaseOrders: dbPurchaseOrders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        category: po.category as PurchaseOrder['category'],
        horizon: po.horizon as PurchaseOrder['horizon'],
        status: po.status as PurchaseOrder['status'],
        totalEstimatedCost: po.totalEstimatedCost,
        actualCost: po.actualCost ?? undefined,
        createdAt: po.createdAt.toISOString(),
        receivedAt: po.receivedAt?.toISOString(),
        note: po.note ?? undefined,
        discrepancyNote: po.discrepancyNote ?? undefined,
        items: po.items.map((it) => ({
          ingredientId: it.ingredientId,
          ingredientName: it.ingredientName,
          quantity: it.quantity,
          receivedQuantity: it.receivedQuantity ?? undefined,
          unit: it.unit,
          costPerUnit: it.costPerUnit,
        })),
      })),
    };
  } catch (error) {
    console.error('Error in getInventoryData, returning clean empty state:', error);
    return {
      ingredients: [],
      menuItems: [],
      brands: [],
      stockLedger: [],
      purchaseOrders: [],
    };
  }
}
