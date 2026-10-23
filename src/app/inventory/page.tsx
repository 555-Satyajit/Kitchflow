'use client'

import React from 'react'
import { InventoryView } from '@/components/inventory/InventoryView'
import { useKitchen } from '@/context/KitchenContext'

export default function InventoryPage() {
  const {
    ingredients,
    menuItems,
    brands,
    stockLedger,
    userRole,
    setUserRole,
    handleAdjustStockWithReason,
    handleTogglePlatformStatus,
    handleAddMenuItem,
    handleAddIngredient,
    handleUpdateMenuItemPrice,
    handleUpdateIngredientCost,
  } = useKitchen()

  // Guard: Cook role cannot manage ingredients, cost data, or platform toggles
  if (userRole === 'LINE_COOK') {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <div className="max-w-md p-6 bg-card border-2 border-border rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <span className="text-xl">🔒</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Inventory Restricted (Cook Role)</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Procurement stockroom, supplier costs, and aggregator menu toggles are restricted to kitchen management.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <a href="/kds" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
              Go to KDS Cook Station
            </a>
            <button
              onClick={() => setUserRole('OWNER')}
              className="px-3 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
            >
              Switch to Owner View
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <InventoryView
      ingredients={ingredients}
      menuItems={menuItems}
      brands={brands}
      stockLedger={stockLedger}
      userRole={userRole}
      onAdjustStockWithReason={handleAdjustStockWithReason}
      onTogglePlatformStatus={handleTogglePlatformStatus}
      onAddMenuItem={handleAddMenuItem}
      onAddIngredient={handleAddIngredient}
      onUpdateMenuItemPrice={handleUpdateMenuItemPrice}
      onUpdateIngredientCost={handleUpdateIngredientCost}
    />
  )
}
