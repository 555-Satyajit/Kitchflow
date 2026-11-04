'use client'

import React, { useState } from 'react'
import { Brand, Ingredient, MenuItem, StockReasonCode, StockLedgerEntry, PurchaseOrder } from '@/types'
import {
  Boxes,
  Utensils,
  History,
  Store,
  ShoppingCart,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { StockLedgerTanStackTable } from './StockLedgerTanStackTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal'
import { StockAdjustmentModal } from './modals/StockAdjustmentModal'
import { EditIngredientCostModal } from './modals/EditIngredientCostModal'
import { EditDishPriceModal } from './modals/EditDishPriceModal'
import { AddIngredientModal } from './modals/AddIngredientModal'
import { AddMenuItemModal } from './modals/AddMenuItemModal'
import { StockTabContent } from './tabs/StockTabContent'
import { MenuTabContent } from './tabs/MenuTabContent'
import { cn } from '@/lib/utils'

interface InventoryViewProps {
  ingredients: Ingredient[]
  menuItems: MenuItem[]
  brands: Brand[]
  stockLedger: StockLedgerEntry[]
  purchaseOrders?: PurchaseOrder[]
  userRole?: string
  onAdjustStockWithReason: (ingredientId: string, delta: number, reason: StockReasonCode, note?: string) => void
  onTogglePlatformStatus: (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => void
  onAddMenuItem: (newItem: Omit<MenuItem, 'id'>) => void
  onAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
  onUpdateMenuItemPrice?: (menuItemId: string, newSellingPrice: number, newPackagingCost?: number) => void
  onUpdateIngredientCost?: (ingredientId: string, newCost: number) => void
  onCreatePurchaseOrder?: (po: any) => Promise<any>
  onReceivePurchaseOrder?: (poId: string, reconciledQuantities?: Record<string, number>, discrepancyNote?: string) => Promise<any>
}

export function InventoryView({
  ingredients,
  menuItems,
  brands,
  stockLedger,
  purchaseOrders = [],
  userRole = 'OWNER',
  onAdjustStockWithReason,
  onTogglePlatformStatus,
  onAddMenuItem,
  onAddIngredient,
  onUpdateMenuItemPrice,
  onUpdateIngredientCost,
  onCreatePurchaseOrder,
  onReceivePurchaseOrder,
}: InventoryViewProps) {
  const lowStockItems = ingredients.filter((i) => i.currentStock <= i.minThreshold)

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'STOCK' | 'MENU' | 'LEDGER'>('STOCK')
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL')

  // Modals state
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false)
  const [isIngDialogOpen, setIsIngDialogOpen] = useState(false)
  const [isMenuItemDialogOpen, setIsMenuItemDialogOpen] = useState(false)
  const [menuItemDialogInitialName, setMenuItemDialogInitialName] = useState('')
  const [menuItemDialogAutoAI, setMenuItemDialogAutoAI] = useState(false)

  const [adjustingIng, setAdjustingIng] = useState<Ingredient | null>(null)
  const [editingCostIng, setEditingCostIng] = useState<Ingredient | null>(null)
  const [editingPriceDish, setEditingPriceDish] = useState<MenuItem | null>(null)

  // Filter menu items by selected brand
  const displayedMenuItems = selectedBrandFilter === 'ALL'
    ? menuItems
    : menuItems.filter((m) => m.brandId === selectedBrandFilter)

  // Filter raw ingredients used by this brand's recipes
  const brandIngredientIds = new Set<string>()
  displayedMenuItems.forEach((m) => {
    (m.recipe || []).forEach((r) => {
      if (r.ingredientId) brandIngredientIds.add(r.ingredientId)
    })
  })

  const displayedIngredients = selectedBrandFilter === 'ALL'
    ? ingredients
    : ingredients.filter((ing) =>
      ing.brandId === selectedBrandFilter ||
      brandIngredientIds.has(ing.id) ||
      displayedMenuItems.some(m => (m.recipe || []).some(r => r.ingredientName.toLowerCase() === ing.name.toLowerCase() || r.ingredientId === ing.id))
    )

  // Filter ledger entries for those ingredients
  const displayedIngredientNames = new Set(displayedIngredients.map((i) => i.name.toLowerCase()))
  const displayedStockLedger = selectedBrandFilter === 'ALL'
    ? stockLedger
    : stockLedger.filter((entry) => displayedIngredientNames.has(entry.ingredientName.toLowerCase()))

  const activeBrand = brands.find((b) => b.id === selectedBrandFilter)

  const handleOpenAddDishModal = (initialName: string = '', autoTriggerAI: boolean = false) => {
    setMenuItemDialogInitialName(initialName)
    setMenuItemDialogAutoAI(autoTriggerAI)
    setIsMenuItemDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Title Header & Action Modals (Apple HIG Header & Action Cluster) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Inventory & Recipes
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
              Auto-86 Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Stockroom tracking, ingredient BOM recipes, and Swiggy & Zomato sync
          </p>
        </div>

        {/* Action Button Cluster */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto overflow-x-auto no-scrollbar">
          {/* Primary Action: Order Stock */}
          <Button
            size="sm"
            onClick={() => setIsPurchaseOrderOpen(true)}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl gap-1.5 font-bold shadow-xs bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all text-primary-foreground cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Order Stock</span>
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-mono leading-none rounded-full shadow-2xs">
                {lowStockItems.length}
              </Badge>
            )}
          </Button>

          {/* Secondary Action: Add Raw Ingredient SKU */}
          <AddIngredientModal
            brands={brands}
            onAddIngredient={onAddIngredient}
            open={isIngDialogOpen}
            onOpenChange={setIsIngDialogOpen}
            showTrigger={true}
          />

          {/* Secondary Action: Add Menu Item / Dish */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenAddDishModal()}
            className="flex-1 sm:flex-initial text-xs h-9 px-3 rounded-xl gap-1.5 font-semibold border-border/80 bg-background/80 hover:bg-muted text-foreground active:scale-[0.98] transition-all shadow-2xs cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5 text-muted-foreground" />
            <span>+ Dish</span>
          </Button>

          {/* Responsive Menu Item Modal: Dialog on Desktop, Sheet on Mobile */}
          <AddMenuItemModal
            open={isMenuItemDialogOpen}
            onOpenChange={setIsMenuItemDialogOpen}
            brands={brands}
            ingredients={ingredients}
            onAddMenuItem={onAddMenuItem}
            onAddIngredient={onAddIngredient}
            initialItemName={menuItemDialogInitialName}
            autoTriggerAI={menuItemDialogAutoAI}
          />
        </div>
      </div>

      {/* Apple HIG Segmented Control: Raw SKUs vs Menu Items vs Stock Ledger */}
      <div className="p-1 bg-muted/70 backdrop-blur-md rounded-2xl border border-border/60 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('STOCK')}
          className={cn(
            "flex-1 min-w-[110px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
            activeTab === 'STOCK'
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Boxes className={cn("w-3.5 h-3.5 shrink-0", activeTab === 'STOCK' ? "text-primary" : "text-muted-foreground")} />
          <span>Stockroom</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5 leading-none font-mono rounded-full border-border/60",
              activeTab === 'STOCK' ? "bg-primary/10 text-primary border-primary/20 font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            {displayedIngredients.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MENU')}
          className={cn(
            "flex-1 min-w-[110px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
            activeTab === 'MENU'
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Utensils className={cn("w-3.5 h-3.5 shrink-0", activeTab === 'MENU' ? "text-primary" : "text-muted-foreground")} />
          <span className="hidden sm:inline">Menu & Sync</span>
          <span className="sm:hidden">Menu</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5 leading-none font-mono rounded-full border-border/60",
              activeTab === 'MENU' ? "bg-primary/10 text-primary border-primary/20 font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            {displayedMenuItems.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LEDGER')}
          className={cn(
            "flex-1 min-w-[110px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
            activeTab === 'LEDGER'
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <History className={cn("w-3.5 h-3.5 shrink-0", activeTab === 'LEDGER' ? "text-primary" : "text-muted-foreground")} />
          <span className="hidden sm:inline">Audit Ledger</span>
          <span className="sm:hidden">Ledger</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5 leading-none font-mono rounded-full border-border/60",
              activeTab === 'LEDGER' ? "bg-primary/10 text-primary border-primary/20 font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            {displayedStockLedger.length}
          </Badge>
        </button>
      </div>

      {/* Brand-Scoped Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono shrink-0 mr-1 flex items-center gap-1">
          <Store className="w-3.5 h-3.5 text-primary" />
          <span>Brand:</span>
        </span>

        <button
          type="button"
          onClick={() => setSelectedBrandFilter('ALL')}
          className={cn(
            "h-8 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 active:scale-[0.98]",
            selectedBrandFilter === 'ALL'
              ? "bg-foreground text-background border-foreground shadow-2xs font-bold"
              : "bg-muted/50 text-muted-foreground border-border/70 hover:text-foreground"
          )}
        >
          All Brands ({brands.length})
        </button>

        {brands.map((b) => {
          const brandDishesCount = menuItems.filter((m) => m.brandId === b.id).length
          const isSelected = selectedBrandFilter === b.id

          return (
            <button
              type="button"
              key={b.id}
              onClick={() => setSelectedBrandFilter(isSelected ? 'ALL' : b.id)}
              className={cn(
                "h-8 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-[0.98]",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                  : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: b.color }} />
              <span>{b.name}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {brandDishesCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active Brand Filter Banner */}
      {selectedBrandFilter !== 'ALL' && activeBrand && (
        <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-primary/10 border border-primary/25 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shadow-2xs" style={{ backgroundColor: activeBrand.color }} />
            <span className="text-muted-foreground">Showing:</span>
            <span className="font-bold text-foreground">{activeBrand.name}</span>
            <span className="text-[11px] font-mono text-primary font-semibold">
              ({displayedMenuItems.length} {displayedMenuItems.length === 1 ? 'dish' : 'dishes'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBrandFilter('ALL')}
            className="text-[11px] text-primary hover:underline font-bold cursor-pointer flex items-center gap-1"
          >
            <span>Show All Brands</span>
            <span>&times;</span>
          </button>
        </div>
      )}

      {/* Tab 1: Raw Ingredients */}
      {activeTab === 'STOCK' && (
        <StockTabContent
          ingredients={displayedIngredients}
          brands={brands}
          userRole={userRole}
          lowStockItems={lowStockItems}
          onOpenPurchaseOrder={() => setIsPurchaseOrderOpen(true)}
          onOpenAdjustModal={(ing) => setAdjustingIng(ing)}
          onOpenCostModal={(ing) => setEditingCostIng(ing)}
          onAdjustStockWithReason={onAdjustStockWithReason}
        />
      )}

      {/* Tab 2: Menu Items & Per-Platform Swiggy / Zomato Controls */}
      {activeTab === 'MENU' && (
        <MenuTabContent
          menuItems={displayedMenuItems}
          brands={brands}
          userRole={userRole}
          selectedBrandFilter={selectedBrandFilter}
          activeBrand={activeBrand}
          onOpenAddDishModal={handleOpenAddDishModal}
          onOpenPriceModal={(dish) => setEditingPriceDish(dish)}
          onTogglePlatformStatus={onTogglePlatformStatus}
          onClearBrandFilter={() => setSelectedBrandFilter('ALL')}
        />
      )}

      {/* Tab 3: TanStack Table Powered Stock Ledger & Variance Audit Trail */}
      {activeTab === 'LEDGER' && (
        <Card className="p-4 sm:p-5 rounded-2xl border-border/80 bg-card/90 backdrop-blur-md shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                  Stock Ledger & Variance Audit Trail
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Deductions, recipe prep consumption, spoilage, and supplier purchase history
              </p>
            </div>
          </div>

          {/* TanStack Table Component */}
          <StockLedgerTanStackTable stockLedger={displayedStockLedger} />
        </Card>
      )}

      {/* Stock Adjustment with Reason Code Modal (Apple HIG Inset Modal) */}
      <StockAdjustmentModal
        ingredient={adjustingIng}
        onClose={() => setAdjustingIng(null)}
        onAdjustStockWithReason={onAdjustStockWithReason}
      />

      {/* Purchase Order & Procurement Indent Modal */}
      <PurchaseOrderModal
        open={isPurchaseOrderOpen}
        onOpenChange={setIsPurchaseOrderOpen}
        ingredients={ingredients}
        brands={brands}
        onSavePurchaseOrder={onCreatePurchaseOrder}
        onFulfillPurchaseOrder={(items) => {
          items.forEach((item) => {
            onAdjustStockWithReason(
              item.ingredientId,
              item.addedStock,
              'PURCHASE_INFLOW',
              'Direct PO Restock'
            )
          })
        }}
      />

      {/* Edit Ingredient Unit Cost Modal (Apple HIG Dialog) */}
      <EditIngredientCostModal
        ingredient={editingCostIng}
        onClose={() => setEditingCostIng(null)}
        onUpdateIngredientCost={onUpdateIngredientCost}
      />

      {/* Edit Dish Selling Price & Packaging Cost Modal (Apple HIG Dialog) */}
      <EditDishPriceModal
        item={editingPriceDish}
        onClose={() => setEditingPriceDish(null)}
        onUpdateMenuItemPrice={onUpdateMenuItemPrice}
      />
    </div>
  )
}
