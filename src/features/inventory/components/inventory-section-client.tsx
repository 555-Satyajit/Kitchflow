'use client';

import React, { useEffect } from 'react';
import { InventoryView } from '@/components/inventory/InventoryView';
import { useKitchen } from '@/context/KitchenContext';
import { Brand, Ingredient, MenuItem, StockLedgerEntry, PurchaseOrder, StockReasonCode } from '@/types';
import { 
  adjustStockAction, 
  toggleMenuItemPlatformAction, 
  addIngredientAction, 
  addMenuItemAction, 
  updateIngredientCostAction,
  createPurchaseOrderAction,
  receivePurchaseOrderAction
} from '../inventory-actions';

interface InventorySectionClientProps {
  initialIngredients: Ingredient[];
  initialMenuItems: MenuItem[];
  initialBrands: Brand[];
  initialStockLedger: StockLedgerEntry[];
  initialPurchaseOrders: PurchaseOrder[];
  kitchenId?: string;
}

export function InventorySectionClient({
  initialIngredients,
  initialMenuItems,
  initialBrands,
  initialStockLedger,
  initialPurchaseOrders,
  kitchenId,
}: InventorySectionClientProps) {
  const {
    ingredients,
    menuItems,
    brands,
    stockLedger,
    purchaseOrders,
    setIngredients,
    setMenuItems,
    setBrands,
    setStockLedger,
    setPurchaseOrders,
    userRole,
    setUserRole,
    handleAdjustStockWithReason,
    handleTogglePlatformStatus,
    handleAddMenuItem,
    handleAddIngredient,
    handleUpdateMenuItemPrice,
    handleUpdateIngredientCost,
    handleCreatePurchaseOrder,
    handleReceivePurchaseOrder,
  } = useKitchen();

  // Sync server-rendered PostgreSQL inventory data into global kitchen context on mount
  useEffect(() => {
    if (initialIngredients !== undefined) {
      setIngredients(initialIngredients);
    }
    if (initialMenuItems !== undefined) {
      setMenuItems(initialMenuItems);
    }
    if (initialBrands !== undefined) {
      setBrands(initialBrands);
    }
    if (initialStockLedger !== undefined) {
      setStockLedger(initialStockLedger);
    }
    if (initialPurchaseOrders !== undefined) {
      setPurchaseOrders(initialPurchaseOrders);
    }
  }, [
    initialIngredients, 
    initialMenuItems, 
    initialBrands, 
    initialStockLedger, 
    initialPurchaseOrders, 
    setIngredients, 
    setMenuItems, 
    setBrands, 
    setStockLedger, 
    setPurchaseOrders
  ]);

  // Wrap inventory handlers with direct Next.js Server Actions for PostgreSQL sync
  const onAdjustStock = async (
    ingredientId: string, 
    delta: number, 
    reason: StockReasonCode, 
    note?: string
  ) => {
    handleAdjustStockWithReason(ingredientId, delta, reason, note);
    try {
      await adjustStockAction({ ingredientId, delta, reason, note, kitchenId });
    } catch (e) {
      console.warn('Stock adjustment server sync note:', e);
    }
  };

  const onTogglePlatform = async (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => {
    handleTogglePlatformStatus(itemId, platform);
    try {
      await toggleMenuItemPlatformAction({ menuItemId: itemId, platform, kitchenId });
    } catch (e) {
      console.warn('Platform toggle server sync note:', e);
    }
  };

  const onAddIngredient = async (newIng: Omit<Ingredient, 'id'>) => {
    handleAddIngredient(newIng);
    try {
      await addIngredientAction({ ...newIng, kitchenId });
    } catch (e) {
      console.warn('Add ingredient server sync note:', e);
    }
  };

  const onAddMenuItem = async (newDish: Omit<MenuItem, 'id'>) => {
    handleAddMenuItem(newDish);
    try {
      const res = await addMenuItemAction({
        brandId: newDish.brandId,
        name: newDish.name,
        description: newDish.description,
        station: newDish.station,
        sellingPrice: newDish.sellingPrice,
        packagingCost: newDish.packagingCost,
        recipe: newDish.recipe?.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
        kitchenId,
      });
      if (!res.ok) {
        console.error('Server action failed adding menu item:', res.error);
      }
    } catch (e) {
      console.error('Add dish server sync exception:', e);
    }
  };

  const onUpdateCost = async (ingredientId: string, newCost: number) => {
    if (handleUpdateIngredientCost) {
      handleUpdateIngredientCost(ingredientId, newCost);
    }
    try {
      await updateIngredientCostAction({ ingredientId, costPerUnit: newCost, kitchenId });
    } catch (e) {
      console.warn('Update cost server sync note:', e);
    }
  };

  const onCreatePO = async (params: {
    supplierName: string;
    category?: any;
    horizon: 'MANUAL' | 'LOW_STOCK' | 'WEEKLY' | 'MONTHLY';
    items: { ingredientId: string; ingredientName: string; quantity: number; unit: string; costPerUnit: number }[];
    totalEstimatedCost: number;
    note?: string;
  }) => {
    const localPO = handleCreatePurchaseOrder(params);
    try {
      await createPurchaseOrderAction({
        supplierName: params.supplierName,
        category: params.category,
        horizon: params.horizon,
        items: params.items.map((it) => ({
          ingredientId: it.ingredientId,
          ingredientName: it.ingredientName,
          quantity: it.quantity,
          unit: it.unit as any,
          costPerUnit: it.costPerUnit,
        })),
        totalEstimatedCost: params.totalEstimatedCost,
        note: params.note,
        kitchenId,
      });
    } catch (e) {
      console.warn('Create PO server sync note:', e);
    }
    return localPO;
  };

  const onReceivePO = async (
    poId: string,
    reconciledQuantities?: { [ingredientId: string]: number },
    discrepancyNote?: string
  ) => {
    handleReceivePurchaseOrder(poId, reconciledQuantities, discrepancyNote);
    try {
      await receivePurchaseOrderAction({
        poId,
        reconciledQuantities,
        discrepancyNote,
        kitchenId,
      });
    } catch (e) {
      console.warn('Receive PO server sync note:', e);
    }
  };

  // Guard: Cook role cannot manage inventory, cost data, or platform toggles
  if (userRole === 'LINE_COOK') {
    return (
      <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full p-6 bg-card/85 backdrop-blur-md border border-border/70 rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-2xs">
            <svg
              className="w-6 h-6 stroke-[2.2]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold tracking-tight text-foreground">Inventory Restricted (Cook Role)</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Procurement stockroom, supplier costs, and aggregator menu toggles are restricted to kitchen management.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
            <a
              href="/kds"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold active:scale-[0.98] transition-all shadow-xs"
            >
              Go to KDS Station
            </a>
            <button
              onClick={() => setUserRole('OWNER')}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border/80 bg-background/60 hover:bg-muted text-xs font-semibold text-foreground active:scale-[0.98] transition-all cursor-pointer"
            >
              Switch to Owner View
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <InventoryView
      ingredients={ingredients.length ? ingredients : initialIngredients}
      menuItems={menuItems.length ? menuItems : initialMenuItems}
      brands={brands.length ? brands : initialBrands}
      stockLedger={stockLedger.length ? stockLedger : initialStockLedger}
      purchaseOrders={purchaseOrders.length ? purchaseOrders : initialPurchaseOrders}
      userRole={userRole}
      onAdjustStockWithReason={onAdjustStock}
      onTogglePlatformStatus={onTogglePlatform}
      onAddMenuItem={onAddMenuItem}
      onAddIngredient={onAddIngredient}
      onUpdateMenuItemPrice={handleUpdateMenuItemPrice}
      onUpdateIngredientCost={onUpdateCost}
      onCreatePurchaseOrder={onCreatePO}
      onReceivePurchaseOrder={onReceivePO}
    />
  );
}
