'use client'

import React from 'react'
import { Brand, MenuItem } from '@/types'
import { formatCurrency, formatStationName } from '@/lib/utils'
import { Utensils, Sparkles, Edit2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MenuTabContentProps {
  menuItems: MenuItem[]
  brands: Brand[]
  userRole?: string
  selectedBrandFilter: string
  activeBrand?: Brand
  onOpenAddDishModal: (initialName?: string, autoTriggerAI?: boolean) => void
  onOpenPriceModal: (item: MenuItem) => void
  onTogglePlatformStatus: (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => void
  onClearBrandFilter: () => void
}

export function MenuTabContent({
  menuItems,
  brands,
  userRole,
  selectedBrandFilter,
  activeBrand,
  onOpenAddDishModal,
  onOpenPriceModal,
  onTogglePlatformStatus,
  onClearBrandFilter,
}: MenuTabContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
            Independent Aggregator Menu Status (Swiggy & Zomato)
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Auto-86: Triggers if stock &lt; 1 portion BOM or &lt; min threshold
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onOpenAddDishModal('Corn Cheese Grilled Sandwich', true)
          }}
          className="text-xs h-9 px-3.5 rounded-xl gap-1.5 font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 shadow-2xs self-start sm:self-auto cursor-pointer active:scale-[0.98] transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span>✨ AI Smart Recipe Wizard</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {menuItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground p-6 rounded-2xl border border-dashed border-border/80 bg-muted/20 space-y-2">
            <Utensils className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="font-semibold text-foreground text-sm">
              {selectedBrandFilter !== 'ALL' && activeBrand
                ? `No menu items found for ${activeBrand.name}`
                : 'No menu items found'}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {selectedBrandFilter !== 'ALL'
                ? 'Click below to view dishes from all brands or add a new recipe for this brand.'
                : 'Add your first menu item or click AI Smart Recipe Wizard above.'}
            </p>
            {selectedBrandFilter !== 'ALL' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearBrandFilter}
                className="mt-2 text-xs font-semibold rounded-xl"
              >
                Show All Brands
              </Button>
            )}
          </div>
        ) : (
          menuItems.map((item) => {
            const brand = brands.find((b) => b.id === item.brandId)

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-4 rounded-2xl flex flex-col justify-between shadow-2xs border transition-all",
                  !item.isAvailable ? "opacity-60 bg-muted/30 border-dashed" : "border-border/80 bg-card/90"
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand?.color }} />
                          <span>{brand?.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          Station: {formatStationName(item.station)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground leading-tight mt-1">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {userRole === 'OWNER' ? (
                        <button
                          type="button"
                          onClick={() => onOpenPriceModal(item)}
                          className="text-right group cursor-pointer block hover:opacity-80"
                          title="Click to edit selling price & packaging fee"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-sm font-bold text-foreground font-mono group-hover:text-primary transition-colors">
                              {formatCurrency(item.sellingPrice)}
                            </span>
                            <Edit2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70" />
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Pkg: {formatCurrency(item.packagingCost)}
                          </p>
                        </button>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-foreground font-mono">
                            {formatCurrency(item.sellingPrice)}
                          </span>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Pkg: {formatCurrency(item.packagingCost)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Recipe Ingredients */}
                  <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40 text-[11px] space-y-1">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase block font-mono">
                      Recipe BOM Ingredients:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.recipe.length === 0 ? (
                        <span className="text-muted-foreground italic text-[10px]">No linked ingredients</span>
                      ) : (
                        item.recipe.map((r) => (
                          <Badge
                            key={r.ingredientId}
                            variant="outline"
                            className="text-[9px] px-1.5 py-0.5 font-normal font-mono rounded-md"
                          >
                            {r.ingredientName} ({r.quantity}{r.unit})
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Independent Swiggy & Zomato Status Buttons with Last Sync */}
                <div className="pt-3 border-t border-border/60 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>Platform Status:</span>
                    <span>Synced: ~3m ago</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Swiggy Button */}
                    <button
                      type="button"
                      onClick={() => onTogglePlatformStatus(item.id, 'SWIGGY')}
                      className={cn(
                        "h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border active:scale-[0.98]",
                        item.swiggyOnline
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400 font-bold"
                          : "bg-muted/40 border-border/60 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", item.swiggyOnline ? "bg-orange-500" : "bg-muted-foreground/40")} />
                        <span>Swiggy</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider">
                        {item.swiggyOnline ? "ON" : "OFF"}
                      </span>
                    </button>

                    {/* Zomato Button */}
                    <button
                      type="button"
                      onClick={() => onTogglePlatformStatus(item.id, 'ZOMATO')}
                      className={cn(
                        "h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border active:scale-[0.98]",
                        item.zomatoOnline
                          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400 font-bold"
                          : "bg-muted/40 border-border/60 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", item.zomatoOnline ? "bg-red-500" : "bg-muted-foreground/40")} />
                        <span>Zomato</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider">
                        {item.zomatoOnline ? "ON" : "OFF"}
                      </span>
                    </button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

