'use client'

import React, { useState, useEffect } from 'react'
import { Order, PackingChecklist, DynamicChecklistItem } from '@/types'
import { PackageCheck, Check, CheckCircle2, ShieldCheck, AlertCircle, Settings2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatStationName } from '@/lib/utils'
import { getCustomDispatchRules, DispatchCheckRule } from './DispatchChecklistConfigModal'

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

  const [customRules, setCustomRules] = useState<DispatchCheckRule[]>(() => getCustomDispatchRules())
  const [customCheckedMap, setCustomCheckedMap] = useState<Record<string, Record<string, boolean>>>({})

  useEffect(() => {
    const handleUpdate = () => {
      setCustomRules(getCustomDispatchRules())
    }
    window.addEventListener('dispatch_rules_updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('dispatch_rules_updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const toggleCustomCheck = (orderId: string, ruleId: string) => {
    setCustomCheckedMap((prev) => {
      const orderChecks = prev[orderId] || {}
      return {
        ...prev,
        [orderId]: {
          ...orderChecks,
          [ruleId]: !orderChecks[ruleId],
        },
      }
    })
  }

  /**
   * Dynamically generate QA checklist tailored to the order's specific food items:
   */
  const getDynamicChecklist = (order: Order) => {
    const hasBeverage = order.items.some(
      (it) => it.station === 'BEVERAGE' || it.name.toLowerCase().includes('chaas') || it.name.toLowerCase().includes('drink')
    )
    const hasBiryani = order.items.some((it) => it.name.toLowerCase().includes('biryani'))
    const hasBurgerOrWrap = order.items.some((it) => it.station === 'FRY' || it.station === 'GRILL')

    return customRules.map((r) => {
      let applies = true
      let hint: string | undefined = r.description || undefined

      if (r.category === 'BEVERAGE') {
        applies = hasBeverage
        hint = hasBeverage ? 'Cold drink detected: Isolate from hot boxes' : 'N/A (No beverage in order)'
      } else if (r.category === 'BIRYANI') {
        applies = hasBiryani
        hint = hasBiryani ? 'Biryani order: verify salan & raita' : 'N/A (Non-biryani order)'
      } else if (r.category === 'FRY_GRILL') {
        applies = hasBurgerOrWrap
        hint = hasBurgerOrWrap ? 'Grill / Fry order: verify dip cups' : 'N/A (No burger/wrap)'
      } else if (r.category.startsWith('item:')) {
        const targetItemId = r.category.replace('item:', '')
        const itemInOrder = order.items.some(
          (it) => it.menuItemId === targetItemId || it.id === targetItemId || (r.targetItemName && it.name.toLowerCase().includes(r.targetItemName.toLowerCase()))
        )
        applies = itemInOrder
        hint = itemInOrder
          ? `${r.targetItemName || 'Target item'} ordered: QA verification required`
          : `N/A (${r.targetItemName || 'Item'} not in order)`
      }

      // Check standard key if matching, otherwise custom map
      let isChecked = false
      if (r.id === 'rule-cutlery') isChecked = Boolean(order.checklist?.cutlery)
      else if (r.id === 'rule-sauces') isChecked = Boolean(order.checklist?.saucesDips)
      else if (r.id === 'rule-napkins') isChecked = Boolean(order.checklist?.napkins)
      else if (r.id === 'rule-beverage') isChecked = Boolean(order.checklist?.beverageSeparated)
      else if (r.id === 'rule-tamper') isChecked = Boolean(order.checklist?.tamperSeal)
      else isChecked = Boolean(customCheckedMap[order.id]?.[r.id])

      return {
        id: r.id,
        label: r.label,
        applies,
        hint,
        isChecked,
        isStandard: ['rule-cutlery', 'rule-sauces', 'rule-napkins', 'rule-beverage', 'rule-tamper'].includes(r.id),
        standardKey: (r.id === 'rule-cutlery' ? 'cutlery' :
                      r.id === 'rule-sauces' ? 'saucesDips' :
                      r.id === 'rule-napkins' ? 'napkins' :
                      r.id === 'rule-beverage' ? 'beverageSeparated' :
                      r.id === 'rule-tamper' ? 'tamperSeal' : null) as keyof PackingChecklist | null,
      }
    })
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
            const isAllChecked = checks.every((c) => !c.applies || c.isChecked)
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
                        {order.channel === 'DIRECT' && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                            Delivery
                          </span>
                        )}
                      </div>
                      {order.customerAddress && (
                        <p className="text-[11px] text-muted-foreground/90 font-medium truncate max-w-[200px]" title={order.customerAddress}>
                          📍 {order.customerAddress}
                        </p>
                      )}
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
                      {checks.map(({ id, label, applies, hint, isChecked, isStandard, standardKey }) => {
                        if (!applies) {
                          return (
                            <div 
                              key={id} 
                              className="p-2.5 rounded-xl border border-border/30 bg-muted/20 text-xs text-muted-foreground/60 flex items-center justify-between"
                            >
                              <span>{label}</span>
                              <span className="text-[10px] font-mono text-muted-foreground/50">N/A (Condition Not Met)</span>
                            </div>
                          )
                        }

                        return (
                          <button
                            type="button"
                            key={id}
                            onClick={() => {
                              if (isStandard && standardKey) {
                                onToggleChecklistItem(order.id, standardKey)
                              }
                              toggleCustomCheck(order.id, id)
                            }}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-xs transition-all cursor-pointer text-left min-h-[46px] group active:scale-[0.99]",
                              isChecked
                                ? "bg-card border-emerald-500/30 text-foreground font-medium shadow-2xs"
                                : "bg-card border-border/70 text-muted-foreground hover:bg-muted/30"
                            )}
                          >
                            <div className="min-w-0 pr-2">
                              <span className={cn("transition-colors leading-snug", isChecked && "text-foreground font-semibold")}>
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
                              isChecked 
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs" 
                                : "border-border/80 bg-background group-hover:border-primary/60"
                            )}>
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
