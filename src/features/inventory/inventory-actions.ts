'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';
import { inventoryTags } from './inventory-cache';
import { StockReasonCode } from '@/types';

export type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function adjustStockAction(params: {
  ingredientId: string;
  delta: number;
  reason: StockReasonCode;
  note?: string;
  kitchenId?: string;
}): Promise<ActionResult<{ newStock: number }>> {
  try {
    const { ingredientId, delta, reason, note, kitchenId } = params;

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      return { ok: false, error: 'Ingredient not found' };
    }

    const previousStock = ingredient.currentStock;
    const newStock = Math.max(0, previousStock + delta);

    // Auto-86 Threshold Evaluation:
    // Check if ingredient dipped below minThreshold or 0, or recovered
    const isIngredientCritical = newStock <= 0 || newStock < ingredient.minThreshold;

    await prisma.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: newStock },
      });

      await tx.stockLedgerEntry.create({
        data: {
          ingredientId,
          previousStock,
          delta,
          balanceAfter: newStock,
          unit: ingredient.unit,
          reason,
          notes: note,
        },
      });

      // Find all dishes using this ingredient in their BOM recipe
      const dependentRecipes = await tx.recipeIngredient.findMany({
        where: { ingredientId },
        select: {
          menuItemId: true,
          quantity: true,
          menuItem: {
            select: { id: true, name: true, isAvailable: true, swiggyOnline: true, zomatoOnline: true },
          },
        },
      });

      for (const rec of dependentRecipes) {
        const dishNeedsMoreThanStock = newStock < rec.quantity;
        const shouldBeAuto86 = isIngredientCritical || dishNeedsMoreThanStock;

        // If stock is critically depleted and dish was active, automatically 86 it
        if (shouldBeAuto86 && rec.menuItem.isAvailable) {
          await tx.menuItem.update({
            where: { id: rec.menuItemId },
            data: {
              isAvailable: false,
              swiggyOnline: false,
              zomatoOnline: false,
              lastSyncedAt: new Date(),
            },
          });
        } else if (!shouldBeAuto86 && !rec.menuItem.isAvailable) {
          // If stock recovered above threshold & recipe requirement, check other ingredients for this dish before restoring
          const otherCriticalIngredients = await tx.recipeIngredient.findFirst({
            where: {
              menuItemId: rec.menuItemId,
              ingredientId: { not: ingredientId },
              ingredient: {
                OR: [
                  { currentStock: { lte: 0 } },
                  // stock lower than recipe required portion
                ],
              },
            },
          });

          if (!otherCriticalIngredients) {
            await tx.menuItem.update({
              where: { id: rec.menuItemId },
              data: {
                isAvailable: true,
                swiggyOnline: true,
                zomatoOnline: true,
                lastSyncedAt: new Date(),
              },
            });
          }
        }
      }
    });

    if (kitchenId) {
      revalidateTag(inventoryTags.kitchen(kitchenId), 'max');
      revalidateTag(inventoryTags.menuItems(kitchenId), 'max');
    }

    return { ok: true, data: { newStock } };
  } catch (error) {
    console.error('Error adjusting stock:', error);
    const message = error instanceof Error ? error.message : 'Failed to adjust stock';
    return { ok: false, error: message };
  }
}

export async function toggleMenuItemPlatformAction(params: {
  menuItemId: string;
  platform: 'SWIGGY' | 'ZOMATO';
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    const { menuItemId, platform, kitchenId } = params;

    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
    });

    if (!item) {
      return { ok: false, error: 'Menu item not found' };
    }

    const updateData = platform === 'SWIGGY'
      ? { swiggyOnline: !item.swiggyOnline, lastSyncedAt: new Date() }
      : { zomatoOnline: !item.zomatoOnline, lastSyncedAt: new Date() };

    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: updateData,
    });

    if (kitchenId) {
      revalidateTag(inventoryTags.menuItems(kitchenId), 'max');
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle platform status';
    return { ok: false, error: message };
  }
}

export async function updateIngredientCostAction(params: {
  ingredientId: string;
  costPerUnit: number;
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    const { ingredientId, costPerUnit, kitchenId } = params;

    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { costPerUnit },
    });

    if (kitchenId) {
      revalidateTag(inventoryTags.kitchen(kitchenId), 'max');
    }

    return { ok: true };
  } catch (error) {
    console.error('Error updating ingredient cost:', error);
    return { ok: false, error: 'Failed updating ingredient cost' };
  }
}

export async function addIngredientAction(params: {
  kitchenId?: string;
  brandId?: string;
  name: string;
  category?: any;
  supplierName?: string;
  storageZone?: any;
  unit: any;
  currentStock: number;
  minThreshold: number;
  costPerUnit: number;
}): Promise<ActionResult<{ ingredientId: string }>> {
  try {
    let { kitchenId, brandId, name, category, supplierName, storageZone, unit, currentStock, minThreshold, costPerUnit } = params;

    if (!kitchenId) {
      const defaultKitchen = await prisma.kitchen.findFirst({ select: { id: true } });
      kitchenId = defaultKitchen?.id;
    }

    if (!kitchenId) {
      return { ok: false, error: 'Kitchen facility not found' };
    }

    const newIng = await prisma.ingredient.create({
      data: {
        kitchenId,
        brandId: brandId || undefined,
        name,
        category: category || 'DRY_STAPLES',
        supplierName: supplierName || undefined,
        storageZone: storageZone || 'DRY_STORE',
        unit,
        currentStock,
        minThreshold,
        costPerUnit,
      },
    });

    revalidateTag(inventoryTags.kitchen(kitchenId), 'max');
    return { ok: true, data: { ingredientId: newIng.id } };
  } catch (error) {
    console.error('Error adding ingredient:', error);
    return { ok: false, error: 'Failed adding ingredient' };
  }
}

export async function addMenuItemAction(params: {
  kitchenId?: string;
  brandId: string;
  name: string;
  description?: string;
  station: any;
  sellingPrice: number;
  packagingCost?: number;
  recipe?: Array<{ ingredientId: string; quantity: number }>;
}): Promise<ActionResult<{ menuItemId: string }>> {
  try {
    const { brandId, name, description, station, sellingPrice, packagingCost = 15, recipe = [], kitchenId } = params;

    const VALID_STATIONS = [
      'GRILL',
      'FRY',
      'TANDOOR',
      'DUM_BIRYANI',
      'WOK',
      'PIZZA',
      'BEVERAGE',
      'DESSERT',
      'ASSEMBLY',
      'PACKING',
    ];

    const isStandardStation = VALID_STATIONS.includes(station);
    const dbStation = (isStandardStation ? station : 'ASSEMBLY') as any;
    const finalDescription = isStandardStation 
      ? (description || '') 
      : `${description || ''}${description ? ' • ' : ''}[Station: ${station}]`;

    // Validate recipe ingredients exist in database to prevent Foreign Key constraint violation
    const validRecipeItems: Array<{ ingredientId: string; quantity: number }> = [];
    if (recipe && recipe.length > 0) {
      const ingredientIds = recipe.map((r) => r.ingredientId);
      const existingIngredients = await prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true },
      });
      const existingIdSet = new Set(existingIngredients.map((ing) => ing.id));

      for (const item of recipe) {
        if (existingIdSet.has(item.ingredientId)) {
          validRecipeItems.push({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          });
        }
      }
    }

    const newDish = await prisma.menuItem.create({
      data: {
        brandId,
        name,
        description: finalDescription,
        station: dbStation,
        sellingPrice,
        packagingCost,
        isAvailable: true,
        swiggyOnline: true,
        zomatoOnline: true,
        recipe: {
          create: validRecipeItems,
        },
      },
    });

    if (kitchenId) {
      revalidateTag(inventoryTags.menuItems(kitchenId), 'max');
    }

    return { ok: true, data: { menuItemId: newDish.id } };
  } catch (error) {
    console.error('Error adding menu item:', error);
    return { ok: false, error: 'Failed adding menu item' };
  }
}

export async function createPurchaseOrderAction(params: {
  kitchenId?: string;
  supplierName: string;
  category?: any;
  horizon?: any;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: any;
    costPerUnit: number;
  }>;
  totalEstimatedCost: number;
  note?: string;
}): Promise<ActionResult<{ poId: string; poNumber: string }>> {
  try {
    let { kitchenId, supplierName, category, horizon = 'MANUAL', items, totalEstimatedCost, note } = params;

    if (!kitchenId) {
      const defaultKitchen = await prisma.kitchen.findFirst({ select: { id: true } });
      kitchenId = defaultKitchen?.id;
    }

    if (!kitchenId) {
      return { ok: false, error: 'Kitchen facility not found' };
    }

    const poNumber = `PO-${Math.floor(100 + Math.random() * 900)}`;

    const newPO = await prisma.purchaseOrder.create({
      data: {
        kitchenId,
        poNumber,
        supplierName: supplierName || 'Wholesale Mandi & Vendor',
        category: category || 'DRY_STAPLES',
        horizon: horizon || 'MANUAL',
        status: 'PENDING_DELIVERY',
        totalEstimatedCost,
        note,
        items: {
          create: items.map((it) => ({
            ingredientId: it.ingredientId,
            ingredientName: it.ingredientName,
            quantity: it.quantity,
            unit: it.unit,
            costPerUnit: it.costPerUnit,
          })),
        },
      },
    });

    revalidateTag(inventoryTags.kitchen(kitchenId), 'max');
    return { ok: true, data: { poId: newPO.id, poNumber: newPO.poNumber } };
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return { ok: false, error: 'Failed creating purchase order' };
  }
}

export async function receivePurchaseOrderAction(params: {
  poId: string;
  reconciledQuantities?: { [ingredientId: string]: number };
  discrepancyNote?: string;
  kitchenId?: string;
}): Promise<ActionResult<{ actualCost: number; status: string }>> {
  try {
    const { poId, reconciledQuantities, discrepancyNote, kitchenId } = params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: { include: { ingredient: true } } },
    });

    if (!po) {
      return { ok: false, error: 'Purchase Order not found' };
    }

    let hasDiscrepancy = false;
    let actualTotalCost = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of po.items) {
        const actualQty = reconciledQuantities && reconciledQuantities[item.ingredientId] !== undefined
          ? Math.max(0, reconciledQuantities[item.ingredientId])
          : item.quantity;

        if (actualQty !== item.quantity) {
          hasDiscrepancy = true;
        }

        actualTotalCost += actualQty * item.costPerUnit;

        // Update purchase order item with received quantity
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: actualQty },
        });

        // Stock in the actual delivered quantity and write to audit ledger
        if (actualQty > 0) {
          const currentIng = await tx.ingredient.findUnique({
            where: { id: item.ingredientId },
          });

          if (currentIng) {
            const previousStock = currentIng.currentStock;
            const balanceAfter = previousStock + actualQty;

            await tx.ingredient.update({
              where: { id: item.ingredientId },
              data: { currentStock: balanceAfter },
            });

            await tx.stockLedgerEntry.create({
              data: {
                ingredientId: item.ingredientId,
                previousStock,
                delta: actualQty,
                balanceAfter,
                unit: currentIng.unit,
                reason: 'PURCHASE_INFLOW',
                notes: `Received delivery for ${po.poNumber} (${po.supplierName}) - ${actualQty}/${item.quantity} ${item.unit} received`,
              },
            });

            // Auto-86 Restoration check: if stock is now healthy, check if connected menu items can be made available
            const recipeLinks = await tx.recipeIngredient.findMany({
              where: { ingredientId: item.ingredientId },
              include: { menuItem: { include: { recipe: { include: { ingredient: true } } } } },
            });

            for (const link of recipeLinks) {
              const dish = link.menuItem;
              if (!dish.isAvailable) {
                // Verify all other ingredients for this dish are also sufficiently stocked
                const allIngredientsAvailable = dish.recipe.every((r) => {
                  const ingStock = r.ingredientId === item.ingredientId ? balanceAfter : r.ingredient.currentStock;
                  return ingStock >= r.quantity && ingStock >= r.ingredient.minThreshold;
                });

                if (allIngredientsAvailable) {
                  await tx.menuItem.update({
                    where: { id: dish.id },
                    data: {
                      isAvailable: true,
                      swiggyOnline: true,
                      zomatoOnline: true,
                      lastSyncedAt: new Date(),
                    },
                  });
                }
              }
            }
          }
        }
      }

      const finalStatus = hasDiscrepancy ? 'PARTIALLY_RECEIVED' : 'RECEIVED';

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          actualCost: actualTotalCost,
          status: finalStatus,
          receivedAt: new Date(),
          discrepancyNote: discrepancyNote?.trim() || (hasDiscrepancy ? 'Quantity adjusted upon intake' : undefined),
        },
      });
    });

    const targetKitchen = kitchenId || po.kitchenId;
    if (targetKitchen) {
      revalidateTag(inventoryTags.kitchen(targetKitchen), 'max');
      revalidateTag(inventoryTags.menuItems(targetKitchen), 'max');
    }

    return { 
      ok: true, 
      data: { 
        actualCost: actualTotalCost, 
        status: hasDiscrepancy ? 'PARTIALLY_RECEIVED' : 'RECEIVED' 
      } 
    };
  } catch (error) {
    console.error('Error receiving purchase order:', error);
    return { ok: false, error: 'Failed receiving purchase order' };
  }
}

