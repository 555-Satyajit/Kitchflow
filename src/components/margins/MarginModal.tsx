'use client'

import React from 'react'
import { Order } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { X, TrendingUp, CheckCircle2, Percent, Receipt, ArrowDownRight, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useKitchen } from '@/context/KitchenContext'

interface MarginModalProps {
  order: Order | null
  onClose: () => void
}

export function MarginModal({ order, onClose }: MarginModalProps) {
  const { commissionSettings } = useKitchen()
  if (!order) return null

  const f = order.financials

  // Total Customer Inflow (gross items + packaging fee collected from customer)
  const totalInflow = f.grossAmount + f.packagingFeeCollected

  // Deductions:
  // 1. Restaurant Funded Discount
  // 2. Aggregator Commission (computed on gross or net after discount per setting)
  // 3. Raw Ingredient BOM
  // 4. Packaging materials (containers, bags, labels)
  // 5. Taxes (if restaurant liable; under Section 9(5) CGST Act, platform remits 5% directly)
  const taxDeduction = commissionSettings.includeGstInDeduction ? f.taxes : 0
  const totalDeductions = f.discount + f.commissionAmount + f.ingredientCost + f.packagingCost + taxDeduction

  // Exact net contribution: Inflow - Outflows
  const computedNet = Math.round((totalInflow - totalDeductions) * 100) / 100

  // Standard margin denominator = Total Inflow (gross + packaging fee collected)
  const marginDenominator = totalInflow
  const computedMarginPct = marginDenominator > 0 
    ? Math.round((computedNet / marginDenominator) * 1000) / 10 
    : 0

  // Proportions for visual breakdown bar
  const commPct = totalInflow > 0 ? (f.commissionAmount / totalInflow) * 100 : 0
  const bomPct = totalInflow > 0 ? ((f.ingredientCost + f.packagingCost) / totalInflow) * 100 : 0
  const discPct = totalInflow > 0 ? (f.discount / totalInflow) * 100 : 0
  const netPct = Math.max(0, computedMarginPct)

  const isSwiggy = order.channel === 'SWIGGY'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card/95 text-card-foreground border border-border/80 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto no-scrollbar">
        
        {/* Apple HIG Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-foreground text-sm font-mono tracking-tight">
                  {order.orderNumber}
                </h3>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium rounded-md">
                  {order.brandName}
                </Badge>
                <Badge 
                  className={cn(
                    "text-[9px] font-mono uppercase px-2 py-0.5 border-none",
                    isSwiggy 
                      ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" 
                      : "bg-red-500/15 text-red-600 dark:text-red-400"
                  )}
                >
                  {order.channel}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Contribution Margin & Unit Economics Ledger
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Apple Inset Financial Reconciliation Banner */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Order Reconciliation:</span>
          </div>
          <div className="font-mono text-xs text-right">
            <span className="text-foreground font-bold">Total {formatCurrency(totalInflow)}</span>
            <span className="text-muted-foreground"> − </span>
            <span className="text-destructive font-bold">{formatCurrency(totalDeductions)}</span>
            <span className="text-muted-foreground"> = </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">Net {formatCurrency(computedNet)}</span>
          </div>
        </div>

        {/* Visual Revenue Proportion Bar */}
        {totalInflow > 0 && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-muted/20 border border-border/50">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Revenue Allocation</span>
              <span className="font-mono">100% Inflow</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
              <div 
                style={{ width: `${Math.min(100, netPct)}%` }} 
                className="bg-emerald-500 transition-all duration-500" 
                title={`Net Profit: ${netPct.toFixed(1)}%`}
              />
              <div 
                style={{ width: `${Math.min(100, bomPct)}%` }} 
                className="bg-amber-500 transition-all duration-500" 
                title={`Recipe BOM & Pkg: ${bomPct.toFixed(1)}%`}
              />
              <div 
                style={{ width: `${Math.min(100, commPct)}%` }} 
                className="bg-rose-500 transition-all duration-500" 
                title={`Platform Commission: ${commPct.toFixed(1)}%`}
              />
              {discPct > 0 && (
                <div 
                  style={{ width: `${Math.min(100, discPct)}%` }} 
                  className="bg-purple-500 transition-all duration-500" 
                  title={`Discounts: ${discPct.toFixed(1)}%`}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Net Profit ({netPct.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Food & Pkg ({bomPct.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Commission ({commPct.toFixed(1)}%)
              </span>
              {discPct > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Discount ({discPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}

        {/* 1. Inflows Section */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
            1. Total Customer Inflow (+)
          </span>
          <div className="space-y-1 text-xs divide-y divide-border/40">
            <div className="flex justify-between py-2">
              <div>
                <span className="text-foreground font-medium block">Food Items Gross Subtotal</span>
                <span className="text-[10px] text-muted-foreground">Item list prices</span>
              </div>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-xs self-center">
                +{formatCurrency(f.grossAmount)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <div>
                <span className="text-foreground font-medium block">Packaging / Bag Fee Collected</span>
                <span className="text-[10px] text-muted-foreground">Charges billed to customer</span>
              </div>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-xs self-center">
                +{formatCurrency(f.packagingFeeCollected)}
              </span>
            </div>
            <div className="flex justify-between py-2 font-bold text-xs text-foreground bg-muted/30 px-2.5 rounded-xl border border-border/40">
              <span>Total Inflow</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(totalInflow)}</span>
            </div>
          </div>
        </div>

        {/* 2. Deductions Section */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
            2. Platform & Variable Outflows (−)
          </span>
          <div className="space-y-1 text-xs divide-y divide-border/40">
            {f.discount > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-destructive font-medium">Restaurant-Funded Discount</span>
                <span className="font-semibold text-destructive font-mono text-xs">−{formatCurrency(f.discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <div>
                <span className="text-destructive font-medium block">
                  Platform Commission ({(f.commissionRate * 100).toFixed(0)}%)
                </span>
                <span className="text-[10px] text-muted-foreground block font-mono">
                  Base: {commissionSettings.applyCommissionOn === 'GROSS' ? 'Gross ₹' + f.grossAmount : `Discounted (₹${f.grossAmount} − ₹${f.discount} = ₹${f.grossAmount - f.discount})`}
                </span>
              </div>
              <span className="font-semibold text-destructive font-mono text-xs self-center">
                −{formatCurrency(f.commissionAmount)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <div>
                <span className="text-destructive font-medium block">Raw Food Ingredients Cost (BOM)</span>
                <span className="text-[10px] text-muted-foreground">Ingredient depletion</span>
              </div>
              <span className="font-semibold text-destructive font-mono text-xs self-center">
                −{formatCurrency(f.ingredientCost)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <div>
                <span className="text-destructive font-medium block">Packaging Materials & Bags (Physical)</span>
                <span className="text-[10px] text-muted-foreground">Boxes, containers & cutlery</span>
              </div>
              <span className="font-semibold text-destructive font-mono text-xs self-center">
                −{formatCurrency(f.packagingCost)}
              </span>
            </div>
            
            {/* GST line */}
            <div className="flex justify-between py-2">
              <div>
                <span className={commissionSettings.includeGstInDeduction ? "text-destructive font-medium block" : "text-muted-foreground font-medium block"}>
                  5% GST
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {commissionSettings.includeGstInDeduction 
                    ? 'Deducted as restaurant liability' 
                    : 'Section 9(5) CGST Act: Collected & remitted by platform (Not deducted)'}
                </span>
              </div>
              <span className={cn(
                "font-semibold font-mono text-xs self-center",
                commissionSettings.includeGstInDeduction ? "text-destructive" : "text-muted-foreground"
              )}>
                {commissionSettings.includeGstInDeduction ? `−${formatCurrency(f.taxes)}` : `(₹${f.taxes.toFixed(2)})`}
              </span>
            </div>

            <div className="flex justify-between py-2 font-bold text-xs text-destructive bg-destructive/10 px-2.5 rounded-xl border border-destructive/20">
              <span>Total Deductions</span>
              <span className="font-mono">−{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Hero Net Contribution Margin Card */}
        <div className="pt-2">
          <div className="flex justify-between items-center bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 rounded-2xl border border-emerald-500/30 shadow-sm">
            <div>
              <span className="text-xs font-extrabold text-foreground tracking-tight block">
                Net Contribution Margin:
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                Margin Denominator: Net / Inflow ({formatCurrency(totalInflow)})
              </span>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                *Fixed costs (rent, labour, power) covered monthly
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-extrabold text-foreground text-2xl font-mono tracking-tight block">
                {formatCurrency(computedNet)}
              </span>
              <Badge 
                variant="outline" 
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono px-2 py-0.5 rounded-lg"
              >
                {computedMarginPct}% Margin
              </Badge>
            </div>
          </div>
        </div>

        {/* 44px Tactile Close Button */}
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full text-xs h-11 font-bold rounded-xl border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all shadow-2xs cursor-pointer"
        >
          Close Drawer
        </Button>
      </div>
    </div>
  )
}

