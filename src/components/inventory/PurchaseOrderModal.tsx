'use client'

import React, { useState } from 'react'
import { Ingredient, Brand } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  ShoppingCart, 
  Share2, 
  Copy, 
  Check, 
  Calendar, 
  AlertTriangle, 
  Plus, 
  Layers, 
  CheckCircle2,
  SlidersHorizontal,
  Search,
  X,
  Package
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface PurchaseOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredients: Ingredient[]
  brands: Brand[]
  onFulfillPurchaseOrder?: (items: { ingredientId: string; addedStock: number }[]) => void
  onSavePurchaseOrder?: (po: {
    supplierName: string
    horizon: 'MANUAL' | 'LOW_STOCK' | 'WEEKLY' | 'MONTHLY'
    items: { ingredientId: string; ingredientName: string; quantity: number; unit: string; costPerUnit: number }[]
    totalEstimatedCost: number
    note?: string
  }) => void
}

export function PurchaseOrderModal({
  open,
  onOpenChange,
  ingredients,
  brands,
  onFulfillPurchaseOrder,
  onSavePurchaseOrder,
}: PurchaseOrderModalProps) {
  const [horizon, setHorizon] = useState<'MANUAL' | 'LOW_STOCK' | 'WEEKLY' | 'MONTHLY'>('MANUAL')
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [supplierName, setSupplierName] = useState('Wholesale Mandi & Vendor')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [receivedSuccess, setReceivedSuccess] = useState(false)

  // Buffer multiplier for automated forecast modes
  const multiplier = horizon === 'LOW_STOCK' ? 2 : horizon === 'WEEKLY' ? 4 : 12

  // Custom user quantities map
  const [customQuantities, setCustomQuantities] = useState<{ [ingId: string]: number }>({})

  // Compute quantity
  const getQty = (ing: Ingredient) => {
    if (customQuantities[ing.id] !== undefined) {
      return customQuantities[ing.id]
    }
    if (horizon === 'MANUAL') {
      return 0
    }
    const targetBuffer = Math.max(ing.minThreshold * multiplier, ing.minThreshold * 2)
    const needed = Math.max(0, targetBuffer - ing.currentStock)
    if (ing.unit === 'g' || ing.unit === 'ml') {
      return Math.ceil(needed / 100) * 100
    }
    return Math.ceil(needed)
  }

  // Filter ingredients by brand and search
  const filteredIngredients = ingredients.filter((ing) => {
    const matchesBrand = selectedBrand === 'ALL' || ing.brandId === selectedBrand || !ing.brandId
    const matchesSearch = !searchQuery.trim() || ing.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    return matchesBrand && matchesSearch
  })

  // List of items in active order
  const orderList = filteredIngredients.map((ing) => ({
    ingredient: ing,
    qty: getQty(ing),
  }))

  const activePurchaseItems = orderList.filter((it) => it.qty > 0)

  const totalEstimatedCost = activePurchaseItems.reduce(
    (sum, item) => sum + item.qty * item.ingredient.costPerUnit,
    0
  )

  const handleUpdateQty = (ingId: string, currentVal: number, delta: number) => {
    const nextVal = Math.max(0, currentVal + delta)
    setCustomQuantities((prev) => ({ ...prev, [ingId]: nextVal }))
  }

  const handleSetExactQty = (ingId: string, valueStr: string) => {
    const val = parseFloat(valueStr)
    setCustomQuantities((prev) => ({ ...prev, [ingId]: isNaN(val) ? 0 : Math.max(0, val) }))
  }

  // Generate WhatsApp text
  const generateVendorText = () => {
    const now = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    const horizonLabel = horizon === 'MANUAL' ? 'STOCK ORDER' : horizon === 'LOW_STOCK' ? 'URGENT RESTOCK' : horizon === 'WEEKLY' ? 'WEEKLY ORDER' : 'MONTHLY ORDER'
    const brandLabel = selectedBrand === 'ALL' ? 'KitchFlow Kitchen' : brands.find(b => b.id === selectedBrand)?.name || 'Kitchen'

    let text = `📦 *${brandLabel.toUpperCase()} - STOCK ORDER*\n`
    text += `📅 Date: ${now} (${horizonLabel})\n`
    text += `------------------------------------\n`

    activePurchaseItems.forEach((item, idx) => {
      text += `${idx + 1}. *${item.ingredient.name}*: ${item.qty} ${item.ingredient.unit}\n`
    })

    text += `------------------------------------\n`
    text += `💰 Est. Total: ${formatCurrency(totalEstimatedCost)}\n`
    text += `Please confirm delivery ETA. Thank you!`
    return text
  }

  const handleCopyIndent = () => {
    const text = generateVendorText()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareWhatsApp = () => {
    // Automatically record this purchase order in the system if handler provided
    if (onSavePurchaseOrder && activePurchaseItems.length > 0) {
      onSavePurchaseOrder({
        supplierName,
        horizon,
        items: activePurchaseItems.map((it) => ({
          ingredientId: it.ingredient.id,
          ingredientName: it.ingredient.name,
          quantity: it.qty,
          unit: it.ingredient.unit,
          costPerUnit: it.ingredient.costPerUnit,
        })),
        totalEstimatedCost,
        note: `Generated via ${horizon} plan`,
      })
    }

    const text = generateVendorText()
    const encoded = encodeURIComponent(text)
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
  }

  const handleMarkReceived = () => {
    if (!onFulfillPurchaseOrder || activePurchaseItems.length === 0) return

    const payload = activePurchaseItems.map((item) => ({
      ingredientId: item.ingredient.id,
      addedStock: item.qty,
    }))

    onFulfillPurchaseOrder(payload)
    setReceivedSuccess(true)
    setTimeout(() => {
      setReceivedSuccess(false)
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[86dvh] p-0 flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
        {/* Compact Clean Apple Header */}
        <div className="p-4 border-b border-border/70 bg-muted/30">
          <DialogHeader className="p-0 text-left">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
              <DialogTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Stock Ordering Indent</span>
              </DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select manual quantities or auto-forecast restock buffers for vendors
          </p>
        </div>

        {/* Clean Controls (Apple HIG Segmented Control + Search) */}
        <div className="p-3 border-b border-border/70 bg-background/80 space-y-2.5 shrink-0">
          {/* Apple HIG Segmented Forecast Control */}
          <div className="p-1 bg-muted/70 backdrop-blur-md rounded-xl border border-border/60 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setHorizon('MANUAL')}
              className={cn(
                "flex-1 min-w-[70px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]",
                horizon === 'MANUAL'
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="w-3 h-3 shrink-0" />
              <span>Manual</span>
            </button>
            <button
              type="button"
              onClick={() => setHorizon('LOW_STOCK')}
              className={cn(
                "flex-1 min-w-[80px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]",
                horizon === 'LOW_STOCK'
                  ? "bg-destructive text-destructive-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Low Stock</span>
            </button>
            <button
              type="button"
              onClick={() => setHorizon('WEEKLY')}
              className={cn(
                "flex-1 min-w-[75px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]",
                horizon === 'WEEKLY'
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Calendar className="w-3 h-3 shrink-0" />
              <span>Weekly</span>
            </button>
            <button
              type="button"
              onClick={() => setHorizon('MONTHLY')}
              className={cn(
                "flex-1 min-w-[75px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]",
                horizon === 'MONTHLY'
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="w-3 h-3 shrink-0" />
              <span>Monthly</span>
            </button>
          </div>

          {/* Search + Brand Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 pointer-events-none" />
              <Input
                placeholder="Search items (Paneer, Rice, Mayo)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 pr-7 text-xs bg-muted/40 hover:bg-muted/60 focus-visible:bg-background rounded-xl border-border/70 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="h-9 rounded-xl border border-border/70 bg-background px-3 text-xs font-semibold max-w-[130px] truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Apple Inset Grouped Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs no-scrollbar">
          {orderList.map(({ ingredient: ing, qty }) => {
            const isDepleted = ing.currentStock <= 0
            const isLow = ing.currentStock <= ing.minThreshold
            const step = ing.unit === 'g' || ing.unit === 'ml' ? 500 : ing.unit === 'pc' ? 10 : 1

            return (
              <div
                key={ing.id}
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all",
                  qty > 0 
                    ? "border-primary/50 bg-primary/5 shadow-2xs" 
                    : isDepleted 
                    ? "border-destructive/40 bg-destructive/5" 
                    : "border-border/70 bg-card hover:border-border"
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-foreground truncate">{ing.name}</span>
                    {isDepleted ? (
                      <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[9px] px-1.5 py-0 font-mono rounded-full">
                        Depleted
                      </Badge>
                    ) : isLow ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] px-1.5 py-0 font-mono rounded-full">
                        Low ({ing.currentStock} {ing.unit})
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono block">
                    Stock: {ing.currentStock} {ing.unit} &bull; Rate: {formatCurrency(ing.costPerUnit)}/{ing.unit}
                  </span>
                </div>

                {/* Tactile Apple Stepper Control */}
                <div className="flex items-center border border-border/80 rounded-xl bg-background overflow-hidden shrink-0 shadow-2xs h-8">
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(ing.id, qty, -step)}
                    className="w-7 h-full flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.9] transition-all cursor-pointer"
                    title={`Minus ${step} ${ing.unit}`}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={qty || ''}
                    placeholder="0"
                    onChange={(e) => handleSetExactQty(ing.id, e.target.value)}
                    className="w-14 text-center font-mono font-bold text-xs bg-transparent border-0 outline-none text-foreground py-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(ing.id, qty, step)}
                    className="w-7 h-full flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.9] transition-all cursor-pointer"
                    title={`Plus ${step} ${ing.unit}`}
                  >
                    +
                  </button>
                  <span className="px-2 text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 border-l border-border/60 h-full flex items-center">
                    {ing.unit}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Clean, Non-Cramped Apple HIG Footer */}
        <div className="p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 space-y-3 shadow-lg z-10 pb-6 sm:pb-4">
          {/* Top Line: Total Summary & Quick Copy */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                Order Total ({activePurchaseItems.length} items):
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-foreground tracking-tight">
                {formatCurrency(totalEstimatedCost)}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyIndent}
              disabled={activePurchaseItems.length === 0}
              className="text-xs h-9 px-3.5 gap-1.5 font-semibold rounded-xl border-border/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
              <span>{copied ? 'Copied' : 'Copy List'}</span>
            </Button>
          </div>

          {/* Bottom Line: Apple Tactile WhatsApp Order Action */}
          <Button
            type="button"
            size="default"
            onClick={handleShareWhatsApp}
            disabled={activePurchaseItems.length === 0}
            className="w-full h-11 text-xs sm:text-sm font-bold gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Send Order via WhatsApp</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
