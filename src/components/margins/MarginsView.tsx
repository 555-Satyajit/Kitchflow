'use client'

import React, { useState } from 'react'
import { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { 
  TrendingUp, 
  SlidersHorizontal, 
  Filter, 
  Percent, 
  Receipt, 
  ArrowDownRight, 
  Layers, 
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react'
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
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false)

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

  // Proportions for visual breakdown bar
  const commPct = totalInflow > 0 ? (totalCommission / totalInflow) * 100 : 0
  const bomPct = totalInflow > 0 ? ((totalFoodCost + totalPackagingCost) / totalInflow) * 100 : 0
  const discPct = totalInflow > 0 ? (totalDiscount / totalInflow) * 100 : 0
  const netPct = Math.max(0, avgContributionMargin)

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Title Header with Apple HIG Pill Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Shift P&L & Margins
            </h1>
            <Badge variant="outline" className="text-[10px] py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono">
              Live Engine
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time contribution margin: Inflows minus platform take-rates, customer discounts, raw recipe BOM & packaging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className="h-9 px-3 rounded-xl text-xs font-medium gap-1.5 border-border/80 bg-card hover:bg-muted/50 active:scale-[0.98] transition-all shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Tax & Rules</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showConfigDrawer ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Collapsible Tax & Commission Rules Drawer (Apple Inset Style) */}
      {showConfigDrawer && (
        <div className="p-4 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              Commission & GST Simulation Parameters
            </span>
            <span className="text-[11px] text-muted-foreground">Applies live across active shift orders</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Rule 1: Commission Base */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground block">Commission Base</span>
              <button
                type="button"
                onClick={() => updateCommissionSettings({ 
                  applyCommissionOn: commissionSettings.applyCommissionOn === 'GROSS' ? 'NET_AFTER_DISCOUNT' : 'GROSS' 
                })}
                className="w-full h-8 px-2.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:border-primary/50 flex items-center justify-between active:scale-[0.98] transition-all shadow-2xs"
              >
                <span>{commissionSettings.applyCommissionOn === 'GROSS' ? 'Gross Price' : 'Net After Discount'}</span>
                <span className="text-[10px] text-primary uppercase font-mono">Toggle</span>
              </button>
            </div>

            {/* Rule 2: GST Liability */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground block">GST Remittance Liability</span>
              <button
                type="button"
                onClick={() => updateCommissionSettings({ 
                  includeGstInDeduction: !commissionSettings.includeGstInDeduction 
                })}
                className="w-full h-8 px-2.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:border-primary/50 flex items-center justify-between active:scale-[0.98] transition-all shadow-2xs"
              >
                <span>{commissionSettings.includeGstInDeduction ? 'Restaurant Liable (−5%)' : 'Platform Sec 9(5)'}</span>
                <span className="text-[10px] text-primary uppercase font-mono">Toggle</span>
              </button>
            </div>

            {/* Rule 3: GST on Commission */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground block">GST on Commission</span>
              <button
                type="button"
                onClick={() => updateCommissionSettings({ 
                  includeGstOnCommission: !commissionSettings.includeGstOnCommission 
                })}
                className="w-full h-8 px-2.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:border-primary/50 flex items-center justify-between active:scale-[0.98] transition-all shadow-2xs"
              >
                <span>{commissionSettings.includeGstOnCommission ? '18% GST Added' : 'No GST on Comm'}</span>
                <span className="text-[10px] text-primary uppercase font-mono">Toggle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Segmented Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-muted/40 rounded-2xl border border-border/60 backdrop-blur-sm">
        {/* Brand Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <Button
            variant={selectedBrand === 'ALL' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedBrand('ALL')}
            className={`h-8 px-3 rounded-xl text-xs font-medium active:scale-[0.98] transition-all ${
              selectedBrand === 'ALL' ? 'shadow-2xs font-semibold' : 'text-muted-foreground'
            }`}
          >
            All Brands ({brands.length})
          </Button>
          {brands.map((b) => (
            <Button
              key={b.id}
              variant={selectedBrand === b.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedBrand(b.id)}
              className={`h-8 px-3 rounded-xl text-xs font-medium active:scale-[0.98] transition-all ${
                selectedBrand === b.id ? 'shadow-2xs font-semibold' : 'text-muted-foreground'
              }`}
            >
              {b.name}
            </Button>
          ))}
        </div>

        {/* Platform Channel Segmented Control */}
        <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-xl border border-border/70 shadow-2xs">
          <button
            type="button"
            onClick={() => setSelectedChannel('ALL')}
            className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-all ${
              selectedChannel === 'ALL'
                ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('SWIGGY')}
            className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-all ${
              selectedChannel === 'SWIGGY'
                ? 'bg-orange-500 text-white font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Swiggy
          </button>
          <button
            type="button"
            onClick={() => setSelectedChannel('ZOMATO')}
            className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-all ${
              selectedChannel === 'ZOMATO'
                ? 'bg-red-500 text-white font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Zomato
          </button>
        </div>
      </div>

      {/* Top Metric Cards: Apple HIG Hero Card + 3 Secondary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* HERO CARD: Net Contribution Margin */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
              Net Shift Profit
            </span>
            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-none font-mono text-xs px-2 py-0.5 font-bold">
              {avgContributionMargin}%
            </Badge>
          </div>
          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono tracking-tight">
              {formatCurrency(totalNetContribution)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Net retained after all variable deductions
            </p>
          </div>
        </div>

        {/* Total Inflow Tile */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wide">Customer Inflow</span>
            <Receipt className="w-4 h-4 text-muted-foreground/70" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-foreground font-mono">
              {formatCurrency(totalInflow)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              Food: {formatCurrency(totalGrossRevenue)} + Pkg: {formatCurrency(totalPkgCollected)}
            </p>
          </div>
        </div>

        {/* Aggregator Take-Rate Tile */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wide">Aggregator Comm</span>
            <Percent className="w-4 h-4 text-destructive/80" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-destructive font-mono">
              −{formatCurrency(totalCommission)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {commPct.toFixed(1)}% of gross revenue inflow
            </p>
          </div>
        </div>

        {/* Recipe BOM & Packaging Cost Tile */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wide">BOM & Packaging</span>
            <Layers className="w-4 h-4 text-amber-500/80" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-foreground font-mono">
              −{formatCurrency(totalFoodCost + totalPackagingCost)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              Food: {formatCurrency(totalFoodCost)} | Box: {formatCurrency(totalPackagingCost)}
            </p>
          </div>
        </div>
      </div>

      {/* Apple Financial Waterfall Card with Allocation Progress Bar */}
      <Card className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />
              Shift Financial Waterfall Breakdown
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trace every rupee from gross customer collection to net profit in kitchen bank
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground font-mono self-start sm:self-auto bg-muted/50 px-2.5 py-1 rounded-lg">
            {filteredOrders.length} Shift Orders
          </span>
        </div>

        {/* Visual Revenue Proportion Bar */}
        {totalInflow > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Revenue Allocation</span>
              <span>100% Inflow</span>
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
              <div 
                style={{ width: `${Math.min(100, discPct)}%` }} 
                className="bg-purple-500 transition-all duration-500" 
                title={`Kitchen Discounts: ${discPct.toFixed(1)}%`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Net Profit ({netPct.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Food & Pkg ({bomPct.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Platform Commission ({commPct.toFixed(1)}%)
              </span>
              {discPct > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Discounts ({discPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Detailed Waterfall Rows */}
        <div className="divide-y divide-border/50 text-xs">
          {/* Inflows */}
          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-medium text-foreground block">Food Items Gross Revenue</span>
              <span className="text-[11px] text-muted-foreground">Menu item prices before aggregator cuts</span>
            </div>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              +{formatCurrency(totalGrossRevenue)}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-medium text-foreground block">Packaging Fees Collected</span>
              <span className="text-[11px] text-muted-foreground">Direct customer packaging charges</span>
            </div>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              +{formatCurrency(totalPkgCollected)}
            </span>
          </div>

          {/* Deductions */}
          {totalDiscount > 0 && (
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-medium text-destructive block">Restaurant Funded Discounts</span>
                <span className="text-[11px] text-muted-foreground">Coupons & promo campaigns absorbed</span>
              </div>
              <span className="font-semibold text-destructive font-mono text-sm">
                −{formatCurrency(totalDiscount)}
              </span>
            </div>
          )}

          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-medium text-destructive block">Platform Take-Rates & Commissions</span>
              <span className="text-[11px] text-muted-foreground">Swiggy & Zomato contractual cuts</span>
            </div>
            <span className="font-semibold text-destructive font-mono text-sm">
              −{formatCurrency(totalCommission)}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-medium text-destructive block">Recipe Raw Material BOM</span>
              <span className="text-[11px] text-muted-foreground">Depleted ingredient cost (COGS)</span>
            </div>
            <span className="font-semibold text-destructive font-mono text-sm">
              −{formatCurrency(totalFoodCost)}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div>
              <span className="font-medium text-destructive block">Packaging Containers & Bags</span>
              <span className="text-[11px] text-muted-foreground">Boxes, seal films, and delivery cutlery</span>
            </div>
            <span className="font-semibold text-destructive font-mono text-sm">
              −{formatCurrency(totalPackagingCost)}
            </span>
          </div>

          {commissionSettings.includeGstInDeduction && (
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-medium text-destructive block">5% GST (Kitchen Remitted)</span>
                <span className="text-[11px] text-muted-foreground">Tax remitted under restaurant liability</span>
              </div>
              <span className="font-semibold text-destructive font-mono text-sm">
                −{formatCurrency(totalTaxes)}
              </span>
            </div>
          )}
        </div>

        {/* Net Shift Profit Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">
              Net Shift Contribution Margin:
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Inflow ({formatCurrency(totalInflow)}) − Deductions ({formatCurrency(totalDeductions)})
            </span>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
              {formatCurrency(totalNetContribution)}
            </span>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
              {avgContributionMargin}% Net Margin
            </p>
          </div>
        </div>
      </Card>

      {/* Per-Order Contribution Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Per-Order Contribution Ledger
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {filteredOrders.length} orders
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrders.map((o) => {
            const ordInflow = o.financials.grossAmount + o.financials.packagingFeeCollected
            const ordNet = o.financials.netMargin
            const ordMarginPct = o.financials.netMarginPercentage

            const isSwiggy = o.channel === 'SWIGGY'

            return (
              <div
                key={o.id}
                className="p-3.5 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-sm shadow-2xs hover:border-foreground/20 transition-all flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs font-mono">{o.orderNumber}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium truncate">
                      {o.brandName}
                    </Badge>
                    <Badge 
                      className={`text-[9px] font-mono uppercase px-1.5 py-0 border-none ${
                        isSwiggy 
                          ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' 
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {o.channel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    Inflow: {formatCurrency(ordInflow)} | Comm: -{formatCurrency(o.financials.commissionAmount)} | BOM: -{formatCurrency(o.financials.ingredientCost)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-foreground font-mono block">
                    +{formatCurrency(ordNet)}
                  </span>
                  <Badge 
                    variant="outline" 
                    className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5 font-mono"
                  >
                    {ordMarginPct}%
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

