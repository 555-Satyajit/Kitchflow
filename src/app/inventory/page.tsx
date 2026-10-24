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
