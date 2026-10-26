'use client'

import React, { useState, useMemo } from 'react'
import { Ingredient, Brand, InventoryCategory } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  ShoppingCart, 
  Share2, 
  Copy, 
  Check, 
  Calendar, 
  AlertTriangle, 
  SlidersHorizontal,
  Search,
  Package,
  Boxes,
  Truck,
  CheckCircle2,
  Filter,
  Layers,
  ArrowRight
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CATEGORY_LABELS: Record<InventoryCategory, { label: string; icon: string }> = {
  PACKAGING: { label: 'Packaging & Disposables', icon: '📦' },
  MEAT_POULTRY: { label: 'Meat & Poultry', icon: '🍗' },
  PRODUCE_DAIRY: { label: 'Produce & Dairy', icon: '🥛' },
  DRY_STAPLES: { label: 'Dry Staples & FMCG', icon: '🌾' },
  BEVERAGES_RETAIL: { label: 'Beverages & Bottled', icon: '🥤' },
  CENTRAL_PREP: { label: 'Base Prep & Sauces', icon: '🥣' },
}

interface PurchaseOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredients: Ingredient[]
  brands: Brand[]
  onFulfillPurchaseOrder?: (items: { ingredientId: string; addedStock: number }[]) => void
  onSavePurchaseOrder?: (po: {
    supplierName: string
    category?: InventoryCategory
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
  const [horizon, setHorizon] = useState<'MANUAL' | 'LOW_STOCK' | 'WEEKLY' | 'MONTHLY'>('LOW_STOCK')
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [orderedPO, setOrderedPO] = useState<{
    poNumber: string
    supplierName: string
    itemsCount: number
    totalCost: number
  } | null>(null)

  // Reset ordered state when modal reopens
  React.useEffect(() => {
    if (open) {
      setOrderedPO(null)
    }
  }, [open])

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

  // Derive unique suppliers and categories present in inventory
  const availableSuppliers = useMemo(() => {
    const set = new Set<string>()
    ingredients.forEach((ing) => {
      if (ing.supplierName) set.add(ing.supplierName)
    })
    return Array.from(set).sort()
  }, [ingredients])

  const availableCategories = useMemo(() => {
    const set = new Set<InventoryCategory>()
    ingredients.forEach((ing) => {
      if (ing.category) set.add(ing.category)
    })
    return Array.from(set)
  }, [ingredients])

  // Filter ingredients by brand, supplier, category, and search
  const filteredIngredients = ingredients.filter((ing) => {
    const matchesBrand = selectedBrand === 'ALL' || ing.brandId === selectedBrand || !ing.brandId
    const matchesSupplier = selectedSupplier === 'ALL' || ing.supplierName === selectedSupplier
    const matchesCategory = selectedCategory === 'ALL' || (ing.category || 'DRY_STAPLES') === selectedCategory
    const matchesSearch = !searchQuery.trim() || ing.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    return matchesBrand && matchesSupplier && matchesCategory && matchesSearch
  })

  // List of items in active order, grouped by supplier/vendor
  const orderList = useMemo(() => {
    return filteredIngredients
      .slice()
      .sort((a, b) => {
        const supA = a.supplierName || 'General Supply'
        const supB = b.supplierName || 'General Supply'
        if (supA !== supB) return supA.localeCompare(supB)
        return a.name.localeCompare(b.name)
      })
      .map((ing) => ({
        ingredient: ing,
        qty: getQty(ing),
      }))
  }, [filteredIngredients, getQty])

  const activePurchaseItems = orderList.filter((it) => it.qty > 0)

  const totalEstimatedCost = activePurchaseItems.reduce(
    (sum, item) => sum + item.qty * item.ingredient.costPerUnit,
    0
  )

  // Determine representative vendor name
  const effectiveVendorName = useMemo(() => {
    if (selectedSupplier !== 'ALL') return selectedSupplier
    if (selectedCategory !== 'ALL' && CATEGORY_LABELS[selectedCategory as InventoryCategory]) {
      return `${CATEGORY_LABELS[selectedCategory as InventoryCategory].label} Vendors`
    }
    const suppliersInActive = Array.from(new Set(activePurchaseItems.map(i => i.ingredient.supplierName).filter(Boolean)))
    if (suppliersInActive.length === 1) return suppliersInActive[0] as string
    return 'Combined Kitchen Suppliers'
  }, [selectedSupplier, selectedCategory, activePurchaseItems])

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
    text += `🏢 Vendor: ${effectiveVendorName}\n`
    if (orderedPO?.poNumber) {
      text += `📄 PO Ref: ${orderedPO.poNumber}\n`
    }
    text += `📅 Date: ${now} (${horizonLabel})\n`
    text += `------------------------------------\n`

    activePurchaseItems.forEach((item, idx) => {
      text += `${idx + 1}. *${item.ingredient.name}*: ${item.qty} ${item.ingredient.unit}\n`
    })

    text += `------------------------------------\n`
    text += `💰 Est. Total: ${formatCurrency(totalEstimatedCost)}\n`
    text += `Please confirm delivery ETA and dispatch. Thank you!`
    return text
  }

  const handleCopyIndent = () => {
    const text = generateVendorText()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Primary action: Place and Record Order PO
  const handleOrderPO = () => {
    if (!onSavePurchaseOrder || activePurchaseItems.length === 0) return

    const poResult = onSavePurchaseOrder({
      supplierName: effectiveVendorName,
      category: selectedCategory !== 'ALL' ? (selectedCategory as InventoryCategory) : undefined,
      horizon,
      items: activePurchaseItems.map((it) => ({
        ingredientId: it.ingredient.id,
        ingredientName: it.ingredient.name,
        quantity: it.qty,
        unit: it.ingredient.unit,
        costPerUnit: it.ingredient.costPerUnit,
      })),
      totalEstimatedCost,
      note: `Generated via ${horizon} replenishment (${selectedSupplier !== 'ALL' ? selectedSupplier : selectedCategory !== 'ALL' ? selectedCategory : 'All Streams'})`,
    }) as any

    const generatedNumber = poResult?.poNumber || `PO-${Math.floor(100 + Math.random() * 900)}`

    setOrderedPO({
      poNumber: generatedNumber,
      supplierName: effectiveVendorName,
      itemsCount: activePurchaseItems.length,
      totalCost: totalEstimatedCost,
    })
  }

  const handleShareWhatsApp = () => {
    const text = generateVendorText()
    const encoded = encodeURIComponent(text)
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[88dvh] p-0 flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
        {/* Compact Apple HIG Header with Scope Summary */}
        <div className="p-4 border-b border-border/70 bg-muted/30">
          <DialogHeader className="p-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                <DialogTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Create Stock Order</span>
                </DialogTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono font-bold bg-background/80 border-border/70">
                {activePurchaseItems.length} selected &bull; {formatCurrency(totalEstimatedCost)}
              </Badge>
            </div>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filter by supplier stream (packaging, meats, dairy, FMCG) to generate separate purchase indents.
          </p>
        </div>

        {/* Clean Controls (Apple HIG Segmented Control + shadcn Select Stream Filters) */}
        <div className="p-3 border-b border-border/70 bg-background/80 space-y-2.5 shrink-0">
          {/* Apple HIG Segmented Forecast Horizon Control */}
          <div className="p-1 bg-muted/70 backdrop-blur-md rounded-xl border border-border/60 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setHorizon('LOW_STOCK')}
              className={cn(
                "flex-1 min-w-[85px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]",
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

          {/* Supplier & Category Streams Filter Row (shadcn Select components) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Vendor / Supplier Selector */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
                <Truck className="w-3 h-3 text-primary" />
                <span>Vendor Stream</span>
              </span>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border/70 bg-background hover:bg-muted/50 font-semibold">
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="ALL">All Vendors ({availableSuppliers.length})</SelectItem>
                  {availableSuppliers.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Procurement Stream Category Selector */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
                <Boxes className="w-3 h-3 text-primary" />
                <span>Category Stream</span>
              </span>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border/70 bg-background hover:bg-muted/50 font-semibold">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="ALL">All Categories ({availableCategories.length})</SelectItem>
                  {availableCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]?.label || c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search + Brand Filter (shadcn Select) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 pointer-events-none" />
              <Input
                placeholder="Search items (Handi, Chicken, Paneer, Mayo)..."
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

            <div className="w-[130px] shrink-0">
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-border/70 bg-background hover:bg-muted/50 font-semibold">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Brands</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Apple Inset Grouped Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs no-scrollbar">
          {orderList.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <Package className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-semibold">No items match this vendor or category filter</p>
              <p className="text-[11px] text-muted-foreground">Select &quot;All Vendors&quot; or clear the search query.</p>
            </div>
          ) : (
            orderList.map(({ ingredient: ing, qty }, idx) => {
              const isDepleted = ing.currentStock <= 0
              const isLow = ing.currentStock <= ing.minThreshold
              const step = ing.unit === 'g' || ing.unit === 'ml' ? 500 : ing.unit === 'pc' ? 10 : 1

              // Show vendor section header if vendor changes and "All Vendors" is selected
              const currentSupplier = ing.supplierName || 'General Supply'
              const prevSupplier = idx > 0 ? (orderList[idx - 1].ingredient.supplierName || 'General Supply') : null
              const showVendorHeader = selectedSupplier === 'ALL' && currentSupplier !== prevSupplier

              return (
                <React.Fragment key={ing.id}>
                  {showVendorHeader && (
                    <div className="pt-2 pb-0.5 px-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        <Truck className="w-3 h-3 text-primary/80" />
                        <span>{currentSupplier}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {orderList.filter(o => (o.ingredient.supplierName || 'General Supply') === currentSupplier).length} items
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all",
                      qty > 0 
                        ? "border-primary/50 bg-primary/5 shadow-2xs ring-1 ring-primary/20" 
                        : isDepleted 
                        ? "border-destructive/40 bg-destructive/5" 
                        : "border-border/70 bg-card hover:border-border"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-foreground leading-snug">{ing.name}</span>
                        {isDepleted ? (
                          <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[9px] px-1.5 py-0 font-mono rounded-full font-bold">
                            Depleted
                          </Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[9px] px-1.5 py-0 font-mono rounded-full font-bold">
                            Low ({ing.currentStock} {ing.unit})
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span>Stock: <strong className="font-mono text-foreground">{ing.currentStock} {ing.unit}</strong></span>
                        <span className="text-muted-foreground/40">&bull;</span>
                        <span>Rate: <span className="font-mono font-medium text-foreground">{formatCurrency(ing.costPerUnit)}/{ing.unit}</span></span>
                      </div>
                    </div>

                    {/* Apple HIG Tactile Stepper Control (36px comfortable touch targets) */}
                    <div className="flex items-center border border-border/80 rounded-xl bg-background overflow-hidden shrink-0 shadow-2xs h-9">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(ing.id, qty, -step)}
                        className="w-8 h-full flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.92] transition-all cursor-pointer"
                        title={`Minus ${step} ${ing.unit}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={qty || ''}
                        placeholder="0"
                        onChange={(e) => handleSetExactQty(ing.id, e.target.value)}
                        className="w-12 sm:w-14 text-center font-mono font-extrabold text-xs sm:text-sm bg-transparent border-0 outline-none text-foreground py-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(ing.id, qty, step)}
                        className="w-8 h-full flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.92] transition-all cursor-pointer"
                        title={`Plus ${step} ${ing.unit}`}
                      >
                        +
                      </button>
                      <span className="px-2 text-[10px] font-mono font-bold text-muted-foreground/80 bg-muted/40 border-l border-border/60 h-full flex items-center">
                        {ing.unit}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              )
            })
          )}
        </div>

        {/* Clean Apple HIG Action Footer */}
        <div className="p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 space-y-3 shadow-lg z-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {orderedPO ? (
            /* Post-Order State: ONLY show Copy and Share on WhatsApp */
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-extrabold text-xs text-foreground">
                        {orderedPO.poNumber}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded-md">
                        Created
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {orderedPO.supplierName} &bull; {formatCurrency(orderedPO.totalCost)}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrderedPO(null)}
                  className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Edit Items
                </Button>
              </div>

              {/* ONLY Copy and Share on WhatsApp buttons shown after order */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyIndent}
                  className="h-11 text-xs font-bold gap-2 rounded-xl border-border/80 bg-background/80 hover:bg-muted text-foreground active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy List'}</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="h-11 text-xs font-bold gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share on WhatsApp</span>
                </Button>
              </div>
            </div>
          ) : (
            /* Pre-Order State: Total & Single "Order PO" Action */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono truncate">
                    Target: {effectiveVendorName} ({activePurchaseItems.length} items)
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-foreground tracking-tight">
                    {formatCurrency(totalEstimatedCost)}
                  </span>
                </div>
              </div>

              {/* Primary Order Action Button */}
              <Button
                type="button"
                onClick={handleOrderPO}
                disabled={activePurchaseItems.length === 0}
                className="w-full h-11 text-xs sm:text-sm font-bold gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Order PO ({activePurchaseItems.length} items &bull; {formatCurrency(totalEstimatedCost)})</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


