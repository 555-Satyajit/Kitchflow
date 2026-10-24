'use client'

import React from 'react'
import { Order, PackingChecklist, DynamicChecklistItem } from '@/types'
import { PackageCheck, Check, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatStationName } from '@/lib/utils'

interface PackingViewProps {
  orders: Order[]
  onToggleChecklistItem: (orderId: string, itemKey: keyof PackingChecklist) => void
  onCompletePacking: (orderId: string) => void
}

export function PackingView({
  orders,
  onToggleChecklistItem,
  onCompletePacking,
}: PackingViewProps) {
  // Tightened Status Flow:
  // Only orders in 'PREPARING' or 'READY' need dispatch packaging checks
  const packingOrders = orders.filter(
    (o) => o.status === 'PREPARING' || o.status === 'READY'
  )

  /**
   * Dynamically generate QA checklist tailored to the order's specific food items:
   * 1. Cold Beverage Separation: ONLY if order contains beverages/cold drinks
   * 2. Cutlery & Paper Spoons: Included for bowls/biryani/combos
   * 3. Condiments & Sauces: Tailored to burger/biryani dips
   * 4. Napkins & Wipes
   * 5. Tamper-evident seal
   */
  const getDynamicChecklist = (order: Order): { key: keyof PackingChecklist; label: string; applies: boolean; hint?: string }[] => {
    const hasBeverage = order.items.some(
      (it) => it.station === 'BEVERAGE' || it.name.toLowerCase().includes('chaas') || it.name.toLowerCase().includes('drink')
    )
    const hasBiryani = order.items.some((it) => it.name.toLowerCase().includes('biryani'))
    const hasBurgerOrWrap = order.items.some((it) => it.station === 'FRY' || it.station === 'GRILL')

    return [
      { 
        key: 'cutlery', 
        label: hasBiryani ? 'Biryani Wooden Spoon & Fork' : 'Eco-Friendly Cutlery', 
        applies: true 
      },
      { 
        key: 'saucesDips', 
        label: hasBiryani ? 'Raita & Mirchi Ka Salan (Dips)' : hasBurgerOrWrap ? 'Secret Sauce & Dip Cups' : 'Condiments & Extra Dips', 
        applies: true 
      },
      { 
        key: 'napkins', 
        label: `${order.brandName} Branded Napkins & Wipes`, 
        applies: true 
      },
      { 
        key: 'beverageSeparated', 
        label: 'Cold Beverage Separation (Thermal Pouch)', 
        applies: hasBeverage, 
        hint: hasBeverage ? 'Mandatory: Keep chilled beverage isolated from hot food' : 'Not required (No cold drinks in this order)' 
      },
      { 
        key: 'tamperSeal', 
        label: 'Aggregator Barcode Tamper-Evident Bag Seal', 
        applies: true 
      },
    ]
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Packing & Dispatch
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
              {packingOrders.length} in queue
            </span>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block mt-0.5">
            Dynamic QA verification and tamper bag seal before rider handover
          </p>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packingOrders.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground bg-card rounded-xl border border-dashed border-border p-8">
            <PackageCheck className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50 stroke-[1.5]" />
            <p className="text-sm font-semibold text-foreground">No orders currently packing</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Orders marked cooked from the KDS stations will appear here for bag seal and quality check.
            </p>
          </div>
        ) : (
          packingOrders.map((order) => {
            const checks = getDynamicChecklist(order)
            // An order is verified if all *applicable* checks are passed
            const isAllChecked = checks.every((c) => !c.applies || order.checklist[c.key])
            const isKdsReady = order.status === 'READY'
            const isSwiggy = order.channel === 'SWIGGY'
            const isZomato = order.channel === 'ZOMATO'

            return (
              <Card 
                key={order.id} 
                className={cn(
                  "overflow-hidden border rounded-2xl transition-all flex flex-col justify-between shadow-xs bg-card",
                  isAllChecked && isKdsReady 
                    ? "border-emerald-500/70 ring-1 ring-emerald-500/20" 
                    : "border-border/80"
                )}
              >
                <div>
                  {/* Apple HIG Card Header: Consistent 2-Column Hierarchy */}
                  <div className="p-3.5 pb-3 flex items-start justify-between gap-3 border-b border-border/60 bg-muted/20">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md text-white font-mono shrink-0 shadow-2xs",
                          isSwiggy ? "bg-orange-600" : isZomato ? "bg-red-600" : "bg-neutral-800"
                        )}>
                          {order.channel}
                        </span>
                        <span className="font-extrabold text-foreground text-sm tracking-tight font-mono">
                          {order.orderNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="font-bold text-foreground">{order.brandName}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] font-medium">{order.customerName}</span>
                      </div>
                    </div>

                    <span 
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 font-mono shadow-2xs",
                        isKdsReady 
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" 
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      )}
                    >
                      {isKdsReady ? "KDS Ready" : "Cooking on Line"}
                    </span>
                  </div>

                  {/* Items to Pack */}
                  <div className="p-3.5 space-y-3">
                    <div className="rounded-xl bg-muted/40 p-2.5 space-y-1.5 border border-border/40 text-xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
                        Included Order Items:
                      </span>
                      {order.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center text-xs">
                          <span className="text-foreground/90 font-medium">
                            <span className="font-mono font-bold mr-1.5">{it.quantity}x</span>
                            {it.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.2 rounded border border-border/50">
                            {formatStationName(it.station)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Dynamic QA Verification Items */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
                        Dynamic QA Verification:
                      </span>
                      {checks.map(({ key, label, applies, hint }) => {
                        if (!applies) {
                          return (
                            <div 
                              key={key} 
                              className="p-2.5 rounded-xl border border-border/30 bg-muted/20 text-xs text-muted-foreground/60 flex items-center justify-between"
                            >
                              <span>{label}</span>
                              <span className="text-[10px] font-mono text-muted-foreground/50">N/A (No Beverage)</span>
                            </div>
                          )
                        }

                        const checked = order.checklist[key]
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => onToggleChecklistItem(order.id, key)}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-xs transition-all cursor-pointer text-left min-h-[46px] group active:scale-[0.99]",
                              checked
                                ? "bg-card border-emerald-500/30 text-foreground font-medium shadow-2xs"
                                : "bg-card border-border/70 text-muted-foreground hover:bg-muted/30"
                            )}
                          >
                            <div className="min-w-0 pr-2">
                              <span className={cn("transition-colors leading-snug", checked && "text-foreground font-semibold")}>
                                {label}
                              </span>
                              {hint && (
                                <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                  {hint}
                                </span>
                              )}
                            </div>
                            <div className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0",
                              checked 
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs" 
                                : "border-border/80 bg-background group-hover:border-primary/60"
                            )}>
                              {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Seal & Dispatch Button */}
                <div className="p-3.5 border-t border-border/60 bg-muted/15 space-y-2">
                  {!isKdsReady && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Pending KDS station cook before rider handover</span>
                    </div>
                  )}

                  <Button
                    disabled={!isAllChecked || !isKdsReady}
                    onClick={() => onCompletePacking(order.id)}
                    className={cn(
                      "w-full text-xs h-10 font-bold gap-2 shadow-xs cursor-pointer rounded-xl transition-all active:scale-95",
                      isAllChecked && isKdsReady
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                        : "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border border-border/80"
                    )}
                    variant={isAllChecked && isKdsReady ? "default" : "outline"}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isAllChecked && isKdsReady
                        ? 'Seal & Hand to Rider' 
                        : !isKdsReady 
                        ? 'Cooking in Progress on KDS'
                        : 'Complete Checks to Dispatch'}
                    </span>
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
