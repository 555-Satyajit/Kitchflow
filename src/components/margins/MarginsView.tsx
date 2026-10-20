'use client'

import React, { useState } from 'react'
import { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, SlidersHorizontal, CheckCircle2, ShieldCheck, Filter } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useKitchen } from '@/context/KitchenContext'

interface MarginsViewProps {
  orders: Order[]
}

export function MarginsView({ orders }: MarginsViewProps) {
  const { commissionSettings, updateCommissionSettings, brands } = useKitchen()
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL')

  // Filter orders by brand & platform
  const filteredOrders = orders.filter((o) => {
    if (selectedBrand !== 'ALL' && o.brandId !== selectedBrand) return false
    if (selectedChannel !== 'ALL' && o.channel !== selectedChannel) return false
    return true
  })

  // Full Financial Aggregations based on verified single-formula
  const totalGrossRevenue = filteredOrders.reduce((sum, o) => sum + o.financials.grossAmount, 0)
  const totalPkgCollected = filteredOrders.reduce((sum, o) => sum + o.financials.packagingFeeCollected, 0)
  const totalInflow = totalGrossRevenue + totalPkgCollected

  const totalDiscount = filteredOrders.reduce((sum, o) => sum + o.financials.discount, 0)
  const totalCommission = filteredOrders.reduce((sum, o) => sum + o.financials.commissionAmount, 0)
  const totalFoodCost = filteredOrders.reduce((sum, o) => sum + o.financials.ingredientCost, 0)
  const totalPackagingCost = filteredOrders.reduce((sum, o) => sum + o.financials.packagingCost, 0)
  const totalTaxes = filteredOrders.reduce((sum, o) => sum + o.financials.taxes, 0)

  const taxDeduction = commissionSettings.includeGstInDeduction ? totalTaxes : 0
  const totalDeductions = totalDiscount + totalCommission + totalFoodCost + totalPackagingCost + taxDeduction
  const totalNetContribution = Math.round((totalInflow - totalDeductions) * 100) / 100

  // Denominator: Total Inflow (Gross + Packaging Collected)
  const avgContributionMargin = totalInflow > 0 
    ? Math.round((totalNetContribution / totalInflow) * 1000) / 10 
    : 0

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Shift P&L & Contribution Margin Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transparent unit economics: Total Inflows minus Platform Commission, Restaurant Discounts, Recipe BOM, & Packaging
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-3 gap-1.5 font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-foreground" />
            <span>Live Shift Ledger</span>
          </Badge>
        </div>
      </div>

      {/* Filter & Commission Settings Bar */}
      <Card className="p-3.5 border-border bg-muted/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Filters:</span>
            
            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground"
            >
              <option value="ALL">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Platform Filter */}
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground"
            >
              <option value="ALL">All Platforms</option>
              <option value="SWIGGY">Swiggy Only</option>
              <option value="ZOMATO">Zomato Only</option>
            </select>
          </div>

          {/* Commission & GST Settings Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background px-2.5 py-1 rounded border border-border">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Commission Base:</span>
              <button
                type="button"
                onClick={() => updateCommissionSettings({ 
                  applyCommissionOn: commissionSettings.applyCommissionOn === 'GROSS' ? 'NET_AFTER_DISCOUNT' : 'GROSS' 
                })}
                className="font-semibold text-foreground underline underline-offset-2 ml-1 cursor-pointer"
              >
                {commissionSettings.applyCommissionOn === 'GROSS' ? 'Gross Price' : 'Net After Discount'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background px-2.5 py-1 rounded border border-border">
              <span>GST Liability:</span>
              <button
                type="button"
                onClick={() => updateCommissionSettings({ 
                  includeGstInDeduction: !commissionSettings.includeGstInDeduction 
                })}
                className="font-semibold text-foreground underline underline-offset-2 ml-1 cursor-pointer"
              >
                {commissionSettings.includeGstInDeduction ? 'Restaurant Liable (−5%)' : 'Platform Sec 9(5)'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background px-2.5 py-1 rounded border border-border">
              <span>GST on Comm:</span>
              <button
                type="button"
                onClick={() => updateCommissionSettings({ 
                  includeGstOnCommission: !commissionSettings.includeGstOnCommission 
                })}
                className="font-semibold text-foreground underline underline-offset-2 ml-1 cursor-pointer"
              >
                {commissionSettings.includeGstOnCommission ? '18% GST Added' : 'No GST on Comm'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1.5 border-border shadow-2xs">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Customer Inflow
          </span>
          <p className="text-2xl font-bold text-foreground font-mono">
            {formatCurrency(totalInflow)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Food ({formatCurrency(totalGrossRevenue)}) + Pkg ({formatCurrency(totalPkgCollected)})
          </span>
        </Card>

        <Card className="p-4 space-y-1.5 border-border shadow-2xs bg-muted/20">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Net Contribution Margin
          </span>
          <p className="text-2xl font-bold text-foreground font-mono">
            {formatCurrency(totalNetContribution)}
          </p>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {avgContributionMargin}% of Total Inflow
          </span>
        </Card>

        <Card className="p-4 space-y-1.5 border-border shadow-2xs">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Aggregator Commissions
          </span>
          <p className="text-2xl font-bold text-foreground font-mono">
            {formatCurrency(totalCommission)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Swiggy & Zomato platform fees
          </span>
        </Card>

        <Card className="p-4 space-y-1.5 border-border shadow-2xs">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recipe BOM & Packaging Cost
          </span>
          <p className="text-2xl font-bold text-foreground font-mono">
            {formatCurrency(totalFoodCost + totalPackagingCost)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            BOM ({formatCurrency(totalFoodCost)}) + Pkg Material ({formatCurrency(totalPackagingCost)})
          </span>
        </Card>
      </div>

      {/* Full Shift Cost Breakdown */}
      <Card className="p-5 space-y-4 border-border shadow-2xs">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Shift Financial Cost Breakdown
          </h4>
          <span className="text-xs font-semibold text-foreground/80 font-mono">
            {filteredOrders.length} Orders Calculated
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1">
            <span className="text-foreground">Food Items Gross Revenue</span>
            <span className="font-semibold text-foreground font-mono">+{formatCurrency(totalGrossRevenue)}</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-foreground">Packaging Fees Collected from Customers</span>
            <span className="font-semibold text-foreground font-mono">+{formatCurrency(totalPkgCollected)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-t border-border/60">
            <span className="text-destructive">Customer Discounts Funded by Kitchen</span>
            <span className="font-semibold text-destructive font-mono">−{formatCurrency(totalDiscount)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-t border-border/60">
            <span className="text-destructive">Platform Commissions (Swiggy / Zomato)</span>
            <span className="font-semibold text-destructive font-mono">−{formatCurrency(totalCommission)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-t border-border/60">
            <span className="text-destructive">Recipe Raw Ingredients (BOM)</span>
            <span className="font-semibold text-destructive font-mono">−{formatCurrency(totalFoodCost)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-t border-border/60">
            <span className="text-destructive">Physical Packaging Materials (Containers, Bags)</span>
            <span className="font-semibold text-destructive font-mono">−{formatCurrency(totalPackagingCost)}</span>
          </div>

          {commissionSettings.includeGstInDeduction && (
            <div className="flex justify-between items-center py-1 border-t border-border/60">
              <span className="text-destructive">5% GST (Kitchen Remitted)</span>
              <span className="font-semibold text-destructive font-mono">−{formatCurrency(totalTaxes)}</span>
            </div>
          )}

          <div className="flex justify-between items-center border-t-2 border-border pt-3 text-sm font-semibold bg-muted/30 p-2.5 rounded-lg">
            <div>
              <span className="text-foreground block">Net Contribution Margin (Shift Profit):</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Formula: ({formatCurrency(totalInflow)}) − ({formatCurrency(totalDeductions)}) = {formatCurrency(totalNetContribution)}
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-foreground text-lg font-mono">
                {formatCurrency(totalNetContribution)}
              </span>
              <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                {avgContributionMargin}% Contribution Margin
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Per-Order Ledger */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Per-Order Contribution Ledger
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrders.map((o) => {
            const ordInflow = o.financials.grossAmount + o.financials.packagingFeeCollected
            const ordNet = o.financials.netMargin
            const ordMarginPct = o.financials.netMarginPercentage

            return (
              <Card
                key={o.id}
                className="p-3.5 flex items-center justify-between border-border shadow-2xs hover:border-foreground/20 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground text-xs font-mono">{o.orderNumber}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 font-medium">
                      {o.brandName}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] font-mono uppercase">
                      {o.channel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Inflow: {formatCurrency(ordInflow)} | Comm: -{formatCurrency(o.financials.commissionAmount)} | BOM: -{formatCurrency(o.financials.ingredientCost)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-foreground font-mono">
                    +{formatCurrency(ordNet)}
                  </span>
                  <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                    {ordMarginPct}% margin
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
