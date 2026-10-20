'use client'

import React from 'react'
import { Order } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { X, TrendingUp, HelpCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-t-2xl sm:rounded-xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-sm font-mono tracking-tight">
                  {order.orderNumber}
                </h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                  {order.brandName}
                </Badge>
                <Badge variant="secondary" className="text-[9px] font-mono uppercase">
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
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Owner Financial Summary Banner */}
        <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs text-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Order Reconciliation:
          </span>
          <span className="font-mono text-xs font-bold">
            Total {formatCurrency(totalInflow)} − Deductions {formatCurrency(totalDeductions)} = Net {formatCurrency(computedNet)}
          </span>
        </div>

        {/* Inflows Section */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
            1. Total Customer Inflow (+):
          </span>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-foreground">Food Items Gross Subtotal</span>
              <span className="font-semibold text-foreground font-mono">+{formatCurrency(f.grossAmount)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-foreground">Packaging / Bag Fee Collected</span>
              <span className="font-semibold text-foreground font-mono">+{formatCurrency(f.packagingFeeCollected)}</span>
            </div>
            <div className="flex justify-between py-1 font-semibold text-xs text-foreground bg-muted/20 px-1 rounded">
              <span>Total Inflow</span>
              <span className="font-mono">+{formatCurrency(totalInflow)}</span>
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
            2. Platform & Variable Outflows (−):
          </span>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-destructive">Restaurant-Funded Discount</span>
              <span className="font-semibold text-destructive font-mono">−{formatCurrency(f.discount)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <div>
                <span className="text-destructive">
                  Platform Commission ({(f.commissionRate * 100).toFixed(0)}%)
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Base: {commissionSettings.applyCommissionOn === 'GROSS' ? 'Gross ₹' + f.grossAmount : `Discounted (₹${f.grossAmount} − ₹${f.discount} = ₹${f.grossAmount - f.discount})`}
                </span>
              </div>
              <span className="font-semibold text-destructive font-mono self-center">
                −{formatCurrency(f.commissionAmount)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-destructive">Raw Food Ingredients Cost (BOM)</span>
              <span className="font-semibold text-destructive font-mono">−{formatCurrency(f.ingredientCost)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-destructive">Packaging Materials & Bags (Physical)</span>
              <span className="font-semibold text-destructive font-mono">−{formatCurrency(f.packagingCost)}</span>
            </div>
            
            {/* GST line */}
            <div className="flex justify-between py-1 border-b border-border/40">
              <div>
                <span className={commissionSettings.includeGstInDeduction ? "text-destructive" : "text-muted-foreground"}>
                  5% GST
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {commissionSettings.includeGstInDeduction 
                    ? 'Deducted as restaurant liability' 
                    : 'Section 9(5) CGST Act: Collected & remitted by platform (Not deducted)'}
                </span>
              </div>
              <span className={cn(
                "font-semibold font-mono self-center",
                commissionSettings.includeGstInDeduction ? "text-destructive" : "text-muted-foreground"
              )}>
                {commissionSettings.includeGstInDeduction ? `−${formatCurrency(f.taxes)}` : `(₹${f.taxes.toFixed(2)})`}
              </span>
            </div>

            <div className="flex justify-between py-1 font-semibold text-xs text-destructive bg-destructive/5 px-1 rounded">
              <span>Total Deductions</span>
              <span className="font-mono">−{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Contribution Margin Card */}
        <div className="pt-2 border-t border-border">
          <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border border-border">
            <div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wide block">
                Net Contribution Margin:
              </span>
              <span className="text-[10px] text-muted-foreground">
                Margin Denominator: Net / Total Inflow ({formatCurrency(totalInflow)})
              </span>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                *Rent, labour, & kitchen utilities are covered in monthly fixed costs
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-foreground text-xl font-mono">
                {formatCurrency(computedNet)}
              </span>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {computedMarginPct}% Contribution Margin
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={onClose}
          className="w-full text-xs h-9 font-medium"
        >
          Close Drawer
        </Button>
      </div>
    </div>
  )
}
