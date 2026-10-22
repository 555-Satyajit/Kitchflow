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
      <DialogContent className="w-[95vw] max-w-xl max-h-[82dvh] p-0 flex flex-col overflow-hidden rounded-2xl border border-border shadow-2xl">
        {/* Compact Clean Header */}
        <div className="p-3.5 border-b border-border/80 bg-muted/20">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span>Stock Ordering</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick items or select a pre-calculated stock forecast
          </p>
        </div>

        {/* Clean Controls (Single Row + Filter Pills) */}
        <div className="p-3 border-b border-border/80 bg-background space-y-2 shrink-0">
          {/* Preset Mode Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setHorizon('MANUAL')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1",
                horizon === 'MANUAL' ? "bg-foreground text-background border-foreground shadow-2xs" : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Manual Pick</span>
            </button>
            <button
              type="button"
              onClick={() => setHorizon('LOW_STOCK')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1",
                horizon === 'LOW_STOCK' ? "bg-red-600 text-white border-red-600 shadow-2xs" : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Low Stock</span>
            </button>
            <button
              type="button"
              onClick={() => setHorizon('WEEKLY')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1",
                horizon === 'WEEKLY' ? "bg-primary text-primary-foreground border-primary shadow-2xs" : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              <Calendar className="w-3 h-3" />
              <span>Weekly Buffer</span>
            </button>
            <button
              type="button"
              onClick={() => setHorizon('MONTHLY')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1",
                horizon === 'MONTHLY' ? "bg-primary text-primary-foreground border-primary shadow-2xs" : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              <Layers className="w-3 h-3" />
              <span>Monthly Bulk</span>
            </button>
          </div>

          {/* Search + Brand Dropdown in 1 neat row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items (Paneer, Rice, Oil)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs bg-muted/20 border-border/80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold max-w-[130px] truncate"
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

        {/* Spacious Clean List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs no-scrollbar">
          {orderList.map(({ ingredient: ing, qty }) => {
            const isDepleted = ing.currentStock <= 0
            const isLow = ing.currentStock <= ing.minThreshold
            const step = ing.unit === 'g' || ing.unit === 'ml' ? 500 : ing.unit === 'pc' ? 10 : 1

            return (
              <div
                key={ing.id}
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors bg-card",
                  qty > 0 
                    ? "border-primary/80 bg-primary/5 shadow-2xs" 
                    : isDepleted 
                    ? "border-red-500/50 bg-red-500/5" 
                    : "border-border/80"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-foreground truncate">{ing.name}</span>
                    {isDepleted ? (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 font-mono">
                        DEPLETED
                      </Badge>
                    ) : isLow ? (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-500/40 font-mono">
                        LOW ({ing.currentStock} {ing.unit})
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">
                    Stock: {ing.currentStock} {ing.unit} • Rate: {formatCurrency(ing.costPerUnit)}/{ing.unit}
                  </span>
                </div>

                {/* Tactile Stepper Control */}
                <div className="flex items-center border border-border rounded-lg bg-background overflow-hidden shrink-0 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleUpdateQty(ing.id, qty, -step)}
                    className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
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
                    className="px-2.5 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    +
                  </button>
                  <span className="px-1.5 text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 border-l border-border h-full flex items-center">
                    {ing.unit}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Clean, Non-Cramped Mobile Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border/80 bg-card shrink-0 space-y-2.5 shadow-lg z-10 safe-area-pb">
          {/* Top Line: Total Summary & Quick Copy */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                Order Total ({activePurchaseItems.length} items):
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-foreground">
                {formatCurrency(totalEstimatedCost)}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyIndent}
              disabled={activePurchaseItems.length === 0}
              className="text-xs h-8 px-3 gap-1.5 font-bold cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy List'}</span>
            </Button>
          </div>

          {/* Bottom Line: One Big, Obvious WhatsApp Order Action */}
          <Button
            type="button"
            size="default"
            onClick={handleShareWhatsApp}
            disabled={activePurchaseItems.length === 0}
            className="w-full h-10 text-xs font-extrabold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Send Order via WhatsApp</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
