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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Packing & Dispatch Verification
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dynamic QA checklists generated from dish contents and brand rules before handing to delivery riders
          </p>
        </div>

        <Badge variant="outline" className="text-xs py-1 px-3 self-start sm:self-auto gap-1.5 font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{packingOrders.length} In Dispatch Queue</span>
        </Badge>
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

            return (
              <Card 
                key={order.id} 
                className={cn(
                  "overflow-hidden border transition-all flex flex-col justify-between shadow-xs",
                  isAllChecked && isKdsReady ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10" : "border-border"
                )}
              >
                <div>
                  {/* Header */}
                  <div className="p-4 pb-3 flex items-start justify-between gap-2 border-b border-border/50 bg-muted/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-base tracking-tight font-mono">
                          {order.orderNumber}
                        </span>
                        <Badge 
                          variant={isKdsReady ? "default" : "secondary"} 
                          className="text-[9px] font-mono uppercase"
                        >
                          {isKdsReady ? "KDS Ready" : "Cooking on Line"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span className="font-semibold text-foreground">{order.brandName}</span>
                        <span>• {order.customerName}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase">
                      {order.channel}
                    </Badge>
                  </div>

                  {/* Items to Pack */}
                  <div className="p-4 space-y-3">
                    <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 border border-border/40 text-xs">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Included Order Items:
                      </span>
                      {order.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center text-xs">
                          <span className="text-foreground/90 font-medium">{it.quantity}x {it.name}</span>
                          <span className="text-[10px] font-sans text-muted-foreground">{formatStationName(it.station)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Dynamic QA Verification Items */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Dynamic QA Verification:
                      </span>
                      {checks.map(({ key, label, applies, hint }) => {
                        if (!applies) {
                          return (
                            <div 
                              key={key} 
                              className="p-2 rounded-lg border border-border/30 bg-muted/20 text-xs text-muted-foreground/60 flex items-center justify-between"
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
                              "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors cursor-pointer text-left",
                              checked
                                ? "bg-muted/40 border-border/80 text-foreground font-medium"
                                : "bg-background border-border text-muted-foreground hover:bg-muted/30"
                            )}
                          >
                            <div>
                              <span>{label}</span>
                              {hint && <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">{hint}</span>}
                            </div>
                            <div className={cn(
                              "w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-2",
                              checked 
                                ? "bg-foreground border-foreground text-background" 
                                : "border-border bg-background"
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
                <div className="p-4 pt-3 border-t border-border/60 bg-muted/10 space-y-2">
                  {!isKdsReady && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Pending KDS station cook before rider handover</span>
                    </div>
                  )}

                  <Button
                    disabled={!isAllChecked}
                    onClick={() => onCompletePacking(order.id)}
                    className="w-full text-xs h-9 font-medium gap-1.5 shadow-xs"
                    variant={isAllChecked ? "default" : "outline"}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isAllChecked ? 'Tamper Sealed & Ready for Rider Handover' : 'Complete Applicable Checks to Seal'}</span>
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
