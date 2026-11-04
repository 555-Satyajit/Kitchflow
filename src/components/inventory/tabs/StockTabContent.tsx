'use client'

import React, { useState } from 'react'
import { Brand, Ingredient, InventoryCategory, StockReasonCode } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  AlertTriangle,
  LayoutList,
  LayoutGrid,
  Search,
  Edit2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface StockTabContentProps {
  ingredients: Ingredient[]
  brands: Brand[]
  userRole?: string
  lowStockItems: Ingredient[]
  onOpenPurchaseOrder: () => void
  onOpenAdjustModal: (ingredient: Ingredient) => void
  onOpenCostModal: (ingredient: Ingredient) => void
  onAdjustStockWithReason: (ingredientId: string, delta: number, reason: StockReasonCode, note?: string) => void
}

export function StockTabContent({
  ingredients,
  brands,
  userRole,
  lowStockItems,
  onOpenPurchaseOrder,
  onOpenAdjustModal,
  onOpenCostModal,
  onAdjustStockWithReason,
}: StockTabContentProps) {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [selectedStockStatusFilter, setSelectedStockStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL')
  const [stockViewMode, setStockViewMode] = useState<'TABLE' | 'CARDS'>('TABLE')
  const [ingredientSearch, setIngredientSearch] = useState<string>('')

  // Filter by category, stock status, and search query
  const filteredIngredients = ingredients.filter((ing) => {
    if (selectedCategoryFilter !== 'ALL' && ing.category !== selectedCategoryFilter) {
      return false
    }
    if (selectedStockStatusFilter === 'LOW' && (ing.currentStock > ing.minThreshold || ing.currentStock <= 0)) {
      return false
    }
    if (selectedStockStatusFilter === 'OUT' && ing.currentStock > 0) {
      return false
    }
    if (!ingredientSearch.trim()) return true
    const q = ingredientSearch.toLowerCase()
    const brandName = brands.find(b => b.id === ing.brandId)?.name.toLowerCase() || ''
    const catName = (ing.category || '').toLowerCase().replace(/_/g, ' ')
    const supplier = (ing.supplierName || '').toLowerCase()
    return ing.name.toLowerCase().includes(q) || brandName.includes(q) || ing.unit.toLowerCase().includes(q) || catName.includes(q) || supplier.includes(q)
  })

  const sortedIngredients = [...filteredIngredients].sort((a, b) => {
    const aUrgency = a.currentStock <= 0 ? 0 : a.currentStock <= a.minThreshold ? 1 : 2
    const bUrgency = b.currentStock <= 0 ? 0 : b.currentStock <= b.minThreshold ? 1 : 2
    return aUrgency - bUrgency
  })

  return (
    <div className="space-y-3.5">
      {/* Low Stock Warning Alert Banner (Apple HIG Inset Notification) */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center justify-between p-3 px-3.5 rounded-2xl border border-destructive/30 bg-destructive/10 text-foreground text-xs shadow-xs">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
            <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
            <span className="font-semibold text-xs">
              {lowStockItems.length} {lowStockItems.length === 1 ? 'item is' : 'items are'} depleted or below safety threshold.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenPurchaseOrder}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive text-[11px] font-bold active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            <span>Order Now</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      {/* View Mode Switch & Search Filter Bar (Apple HIG Layout) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        {/* Search Field & Filters Group */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search ingredient, category, supplier..."
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              className="h-10 pl-9 pr-9 text-xs sm:text-sm bg-muted/40 hover:bg-muted/60 focus-visible:bg-background rounded-xl border-border/70 transition-all shadow-2xs"
            />
            {ingredientSearch && (
              <button
                type="button"
                onClick={() => setIngredientSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground flex items-center justify-center text-xs transition-colors cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-full sm:w-[170px]">
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-xs font-semibold">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                <SelectItem value="ALL" className="text-xs font-semibold">All Categories</SelectItem>
                <SelectItem value="DRY_STAPLES" className="text-xs">Dry Staples & Spices</SelectItem>
                <SelectItem value="PRODUCE_DAIRY" className="text-xs">Dairy & Fresh Produce</SelectItem>
                <SelectItem value="MEAT_POULTRY" className="text-xs">Meat & Poultry</SelectItem>
                <SelectItem value="PACKAGING" className="text-xs">Packaging & Disposables</SelectItem>
                <SelectItem value="BEVERAGES_RETAIL" className="text-xs">Retail Drinks & Cans</SelectItem>
                <SelectItem value="CENTRAL_PREP" className="text-xs">Central Base & Prep</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[150px]">
            <Select value={selectedStockStatusFilter} onValueChange={(val) => setSelectedStockStatusFilter(val as 'ALL' | 'LOW' | 'OUT')}>
              <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-xs font-semibold">
                <SelectValue placeholder="All Stock Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                <SelectItem value="ALL" className="text-xs font-semibold">All Stock</SelectItem>
                <SelectItem value="LOW" className="text-xs text-amber-600 dark:text-amber-400 font-medium">Low Stock (&lt; Min)</SelectItem>
                <SelectItem value="OUT" className="text-xs text-destructive font-medium">Out of Stock (86)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View Toggle: Table vs Cards (Apple HIG Segmented Switcher) */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          <span className="text-[11px] text-muted-foreground font-mono">
            {sortedIngredients.length} {sortedIngredients.length === 1 ? 'item' : 'items'}
          </span>
          <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setStockViewMode('TABLE')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]",
                stockViewMode === 'TABLE'
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className={cn("w-3.5 h-3.5", stockViewMode === 'TABLE' ? "text-primary" : "text-muted-foreground")} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setStockViewMode('CARDS')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]",
                stockViewMode === 'CARDS'
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className={cn("w-3.5 h-3.5", stockViewMode === 'CARDS' ? "text-primary" : "text-muted-foreground")} />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Clean Minimal Table View */}
      {stockViewMode === 'TABLE' && (
        <div className="rounded-2xl border border-border/80 bg-card/90 overflow-hidden shadow-xs">
          <div className="sm:hidden px-3.5 py-1.5 bg-muted/40 border-b border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Swipe horizontally to view full stock columns</span>
            <span className="text-primary font-bold">Scroll &rarr;</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-muted/50 border-b border-border/80 text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Ingredient Name</th>
                  <th className="py-3 px-3 whitespace-nowrap">Brand</th>
                  <th className="py-3 px-3 whitespace-nowrap">Category</th>
                  <th className="py-3 px-3 whitespace-nowrap">Location</th>
                  <th className="py-3 px-3 whitespace-nowrap">Supplier</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">In Stock</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Min Buffer</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                  {userRole === 'OWNER' && (
                    <th className="py-3 px-3 text-right whitespace-nowrap">Unit Cost</th>
                  )}
                  <th className="py-3 px-4 text-right whitespace-nowrap">Quick Stock Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sortedIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={userRole === 'OWNER' ? 10 : 9} className="py-12 text-center text-muted-foreground text-xs">
                      <p className="font-semibold text-foreground">No ingredients found</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Try adjusting your search query or brand filter.</p>
                    </td>
                  </tr>
                ) : (
                  sortedIngredients.map((ing) => {
                    const isZero = ing.currentStock <= 0
                    const isLow = ing.currentStock <= ing.minThreshold
                    const brand = brands.find(b => b.id === ing.brandId)

                    return (
                      <tr
                        key={ing.id}
                        className={cn(
                          "hover:bg-muted/40 transition-colors",
                          isZero && "bg-destructive/5 hover:bg-destructive/10",
                          !isZero && isLow && "bg-amber-500/5 hover:bg-amber-500/10"
                        )}
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="font-bold text-foreground text-xs sm:text-sm">
                              {ing.name}
                            </span>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {ing.storageZone
                                ? ing.storageZone === 'CHILLER'
                                  ? 'Chiller'
                                  : ing.storageZone === 'FREEZER'
                                  ? 'Freezer'
                                  : ing.storageZone === 'DRY_STORE'
                                  ? 'Dry Store'
                                  : ing.storageZone === 'PACKAGING_BAY'
                                  ? 'Packaging Bay'
                                  : ing.storageZone === 'STATION_LINE'
                                  ? 'Station Line'
                                  : String(ing.storageZone).replace(/_/g, ' ')
                                : 'Dry Store'}
                            </p>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {brand ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: brand.color }}
                              />
                              <span>{brand.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Shared SKU</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] font-mono border-border/80 bg-muted/40 text-muted-foreground rounded-lg px-2 py-0.5">
                            {ing.category ? ing.category.replace(/_/g, ' ') : 'DRY STAPLES'}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                          {ing.storageZone ? ing.storageZone.replace(/_/g, ' ') : 'DRY STORE'}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-xs text-foreground font-medium">
                          {ing.supplierName || <span className="text-muted-foreground">—</span>}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-xs sm:text-sm whitespace-nowrap">
                          <span
                            className={cn(
                              isZero ? "text-destructive font-extrabold" : isLow ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground"
                            )}
                          >
                            {ing.currentStock}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-normal ml-1">
                            {ing.unit}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {ing.minThreshold} {ing.unit}
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {isZero ? (
                            <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                              Out of Stock (86)
                            </Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono px-2 py-0.5 rounded-full">
                              Normal
                            </Badge>
                          )}
                        </td>

                        {userRole === 'OWNER' && (
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onOpenCostModal(ing)}
                              className="inline-flex items-center gap-1 font-mono text-xs text-foreground font-semibold hover:text-primary hover:underline cursor-pointer group"
                              title="Click to adjust unit cost"
                            >
                              <span>{formatCurrency(ing.costPerUnit)}</span>
                              <span className="text-[10px] text-muted-foreground">/{ing.unit}</span>
                              <Edit2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70 ml-0.5" />
                            </button>
                          </td>
                        )}

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenAdjustModal(ing)}
                              className="h-8 px-3 text-xs font-semibold rounded-xl bg-background hover:bg-muted border-border/80 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                            >
                              <span>Adjust Stock</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Apple HIG Stock Cards View */}
      {stockViewMode === 'CARDS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {sortedIngredients.map((ing) => {
            const isZero = ing.currentStock <= 0
            const isLow = ing.currentStock <= ing.minThreshold
            const brand = brands.find(b => b.id === ing.brandId)

            const stockHealth = ing.minThreshold > 0
              ? Math.min(100, Math.round((ing.currentStock / (ing.minThreshold * 2)) * 100))
              : 100

            return (
              <Card
                key={ing.id}
                className={cn(
                  "p-4 rounded-2xl flex flex-col justify-between border transition-all shadow-2xs",
                  isZero
                    ? "border-destructive/40 bg-destructive/5"
                    : isLow
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/80 bg-card/90 hover:border-primary/40"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground leading-snug">
                        {ing.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span>
                          {ing.storageZone
                            ? ing.storageZone === 'CHILLER'
                              ? 'Chiller'
                              : ing.storageZone === 'FREEZER'
                              ? 'Freezer'
                              : ing.storageZone === 'DRY_STORE'
                              ? 'Dry Store'
                              : ing.storageZone === 'PACKAGING_BAY'
                              ? 'Packaging Bay'
                              : ing.storageZone === 'STATION_LINE'
                              ? 'Station Line'
                              : String(ing.storageZone).replace(/_/g, ' ')
                            : 'Dry Store'}
                        </span>
                        {brand && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 font-sans font-medium text-foreground">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: brand.color }} />
                              <span>{brand.name}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isZero ? (
                      <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0">
                        Out of Stock
                      </Badge>
                    ) : isLow ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0">
                        Low Stock
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0">
                        Normal
                      </Badge>
                    )}
                  </div>

                  {/* Stock Level & Visual Health Bar */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2">
                    <div className="flex items-baseline justify-between font-mono">
                      <span className="text-xs text-muted-foreground font-sans font-medium">Stock Level:</span>
                      <div className="text-right">
                        <span
                          className={cn(
                            "text-lg font-extrabold tracking-tight",
                            isZero ? "text-destructive" : isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                          )}
                        >
                          {ing.currentStock}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {ing.unit}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70 ml-1.5 font-sans">
                          (min {ing.minThreshold})
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isZero ? "w-0 bg-destructive" : isLow ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.max(4, stockHealth)}%` }}
                      />
                    </div>
                  </div>

                  {userRole === 'OWNER' && (
                    <div className="flex items-center justify-between text-xs px-0.5">
                      <span className="text-muted-foreground font-medium">Unit Cost:</span>
                      <button
                        type="button"
                        onClick={() => onOpenCostModal(ing)}
                        className="inline-flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary transition-colors cursor-pointer group"
                        title="Click to update cost"
                      >
                        <span>{formatCurrency(ing.costPerUnit)}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">/{ing.unit}</span>
                        <Edit2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70 ml-0.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border/60 mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const delta = ing.unit === 'pc' ? -1 : -100
                      onAdjustStockWithReason(ing.id, delta, 'WASTAGE_SPOILAGE', 'Quick decrement')
                    }}
                    className="h-9 px-2.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted text-xs font-mono font-bold text-destructive active:scale-[0.96] transition-all cursor-pointer shadow-2xs"
                    title={`Quick -${ing.unit === 'pc' ? '1' : '100'} ${ing.unit}`}
                  >
                    -{ing.unit === 'pc' ? '1' : '100'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const delta = ing.unit === 'pc' ? 1 : 100
                      onAdjustStockWithReason(ing.id, delta, 'PURCHASE_INFLOW', 'Quick restock')
                    }}
                    className="h-9 px-2.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 active:scale-[0.96] transition-all cursor-pointer shadow-2xs"
                    title={`Quick +${ing.unit === 'pc' ? '1' : '100'} ${ing.unit}`}
                  >
                    +{ing.unit === 'pc' ? '1' : '100'}
                  </button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenAdjustModal(ing)}
                    className="flex-1 h-9 rounded-xl text-xs font-semibold bg-background hover:bg-muted border-border/80 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                  >
                    Adjust
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

