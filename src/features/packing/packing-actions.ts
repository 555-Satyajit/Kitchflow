'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';
import { packingTags } from './packing-cache';
import { PackingChecklist } from '@/types';

export type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function toggleChecklistItemAction(params: {
  orderId: string;
  itemKey: keyof PackingChecklist;
  kitchenId?: string;
  targetChecked?: boolean;
  clientVersion?: number;
}): Promise<ActionResult<{ checklist: PackingChecklist; version: number }>> {
  try {
    const { orderId, itemKey, kitchenId, targetChecked, clientVersion } = params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, checklist: true, version: true },
    });

    if (!order) {
      return { ok: false, error: 'Order not found' };
    }

    const currentChecklist: PackingChecklist = (order.checklist as unknown as PackingChecklist) || {
      cutlery: false,
      saucesDips: false,
      napkins: false,
      tamperSeal: false,
      beverageSeparated: false,
    };

    // Hardened Concurrency Gate: Deterministic Integer Sequence Matching (Zero Clock Drift Risk)
    // If the database version is HIGHER than the version rendered on the packing tablet,
    // another dispatch operator modified this order first. Drop the stale modification.
    if (typeof clientVersion === 'number' && typeof (order as any).version === 'number') {
      if ((order as any).version > clientVersion) {
        return {
          ok: true,
          data: {
            checklist: currentChecklist,
            version: (order as any).version,
          },
        };
      }
    }

    const nextChecked = typeof targetChecked === 'boolean' 
      ? targetChecked 
      : !currentChecklist[itemKey];

    const updatedChecklist = {
      ...currentChecklist,
      [itemKey]: nextChecked,
    };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { 
        checklist: updatedChecklist,
        updatedAt: new Date(),
        version: { increment: 1 },
      },
      select: { id: true, checklist: true, version: true },
    });

    if (kitchenId) {
      revalidateTag(packingTags.kitchen(kitchenId), 'max');
    }

    return { 
      ok: true, 
      data: { 
        checklist: updated.checklist as unknown as PackingChecklist,
        version: (updated as any).version ?? 0,
      } 
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle checklist item';
    console.error('Error toggling packing checklist:', error);
    return { ok: false, error: message };
  }
}

export async function completePackingAction(params: {
  orderId: string;
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    const { orderId, kitchenId } = params;

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPATCHED' },
    });

    if (kitchenId) {
      revalidateTag(packingTags.kitchen(kitchenId), 'max');
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete packing';
    console.error('Error completing packing dispatch:', error);
    return { ok: false, error: message };
  }
}

export async function fetchPackingOrdersClientAction(kitchenId?: string) {
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
        status: { in: ['PREPARING', 'READY'] },
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
      })),
    }));
  } catch (e) {
    console.error('Error fetching fresh packing orders for client:', e);
    return [];
  }
}


export interface DispatchRuleDTO {
  id: string;
  label: string;
  category: string;
  targetItemName?: string | null;
  description?: string | null;
  isDefault?: boolean;
}

const DEFAULT_DISPATCH_RULES: DispatchRuleDTO[] = [
  {
    id: 'rule-cutlery',
    label: 'Eco-Friendly Cutlery & Spoons',
    category: 'ALL',
    description: 'Wooden spoons, forks, paper tissues',
    isDefault: true,
  },
  {
    id: 'rule-sauces',
    label: 'Condiments, Extra Dips & Salan',
    category: 'ALL',
    description: 'Raita cups, ketchup, mint chutney',
    isDefault: true,
  },
  {
    id: 'rule-napkins',
    label: 'Branded Napkins & Wet Wipes',
    category: 'ALL',
    description: 'Sanitizing wet wipes & premium napkins',
    isDefault: true,
  },
  {
    id: 'rule-beverage',
    label: 'Cold Beverage Separation (Thermal Pouch)',
    category: 'BEVERAGE',
    description: 'Keep chilled drinks isolated from hot curries/dum boxes',
    isDefault: true,
  },
  {
    id: 'rule-tamper',
    label: 'Tamper-Evident Bag Seal & Barcode Bill',
    category: 'ALL',
    description: 'Printed receipt sticker + aggregator QR security seal',
    isDefault: true,
  },
];

export async function getDispatchRulesAction(kitchenId?: string): Promise<ActionResult<DispatchRuleDTO[]>> {
  try {
    let targetKitchenId = kitchenId;
    if (!targetKitchenId) {
      const defaultKitchen = await prisma.kitchen.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      targetKitchenId = defaultKitchen?.id;
    }

    if (!targetKitchenId) {
      return { ok: true, data: DEFAULT_DISPATCH_RULES };
    }

    const rules = await prisma.dispatchCheckRule.findMany({
      where: { kitchenId: targetKitchenId },
      orderBy: { createdAt: 'asc' },
    });

    if (rules.length === 0) {
      // Seed default rules for this kitchen
      await prisma.dispatchCheckRule.createMany({
        data: DEFAULT_DISPATCH_RULES.map((r) => ({
          kitchenId: targetKitchenId!,
          label: r.label,
          category: r.category,
          description: r.description || null,
          isDefault: true,
        })),
      });

      const seeded = await prisma.dispatchCheckRule.findMany({
        where: { kitchenId: targetKitchenId },
        orderBy: { createdAt: 'asc' },
      });

      return {
        ok: true,
        data: seeded.map((s) => ({
          id: s.id,
          label: s.label,
          category: s.category,
          targetItemName: s.targetItemName,
          description: s.description,
          isDefault: s.isDefault,
        })),
      };
    }

    return {
      ok: true,
      data: rules.map((s) => ({
        id: s.id,
        label: s.label,
        category: s.category,
        targetItemName: s.targetItemName,
        description: s.description,
        isDefault: s.isDefault,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dispatch rules';
    console.error('Error fetching dispatch rules:', error);
    return { ok: false, error: message };
  }
}

export async function createDispatchRuleAction(params: {
  kitchenId?: string;
  label: string;
  category: string;
  targetItemName?: string;
  description?: string;
}): Promise<ActionResult<DispatchRuleDTO>> {
  try {
    let targetKitchenId = params.kitchenId;
    if (!targetKitchenId) {
      const defaultKitchen = await prisma.kitchen.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      targetKitchenId = defaultKitchen?.id;
    }

    if (!targetKitchenId) {
      return { ok: false, error: 'Kitchen not found' };
    }

    const created = await prisma.dispatchCheckRule.create({
      data: {
        kitchenId: targetKitchenId,
        label: params.label.trim(),
        category: params.category,
        targetItemName: params.targetItemName?.trim() || null,
        description: params.description?.trim() || null,
        isDefault: false,
      },
    });

    revalidateTag(packingTags.all, 'max');

    return {
      ok: true,
      data: {
        id: created.id,
        label: created.label,
        category: created.category,
        targetItemName: created.targetItemName,
        description: created.description,
        isDefault: created.isDefault,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create dispatch rule';
    console.error('Error creating dispatch rule:', error);
    return { ok: false, error: message };
  }
}

export async function deleteDispatchRuleAction(params: {
  ruleId: string;
  kitchenId?: string;
}): Promise<ActionResult> {
  try {
    await prisma.dispatchCheckRule.delete({
      where: { id: params.ruleId },
    });

    revalidateTag(packingTags.all, 'max');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete dispatch rule';
    console.error('Error deleting dispatch rule:', error);
    return { ok: false, error: message };
  }
}

export async function resetDispatchRulesAction(kitchenId?: string): Promise<ActionResult<DispatchRuleDTO[]>> {
  try {
    let targetKitchenId = kitchenId;
    if (!targetKitchenId) {
      const defaultKitchen = await prisma.kitchen.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      targetKitchenId = defaultKitchen?.id;
    }

    if (!targetKitchenId) {
      return { ok: false, error: 'Kitchen not found' };
    }

    // Delete current kitchen rules
    await prisma.dispatchCheckRule.deleteMany({
      where: { kitchenId: targetKitchenId },
    });

    // Re-seed defaults
    await prisma.dispatchCheckRule.createMany({
      data: DEFAULT_DISPATCH_RULES.map((r) => ({
        kitchenId: targetKitchenId!,
        label: r.label,
        category: r.category,
        description: r.description || null,
        isDefault: true,
      })),
    });

    const resetRules = await prisma.dispatchCheckRule.findMany({
      where: { kitchenId: targetKitchenId },
      orderBy: { createdAt: 'asc' },
    });

    revalidateTag(packingTags.all, 'max');

    return {
      ok: true,
      data: resetRules.map((s: any) => ({
        id: s.id,
        label: s.label,
        category: s.category,
        targetItemName: s.targetItemName,
        description: s.description,
        isDefault: s.isDefault,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset dispatch rules';
    console.error('Error resetting dispatch rules:', error);
    return { ok: false, error: message };
  }
}
