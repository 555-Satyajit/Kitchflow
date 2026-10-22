'use client'

import React, { useState } from 'react'
import { Brand, MenuItem, Channel } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Store, 
  PhoneCall, 
  User, 
  Utensils,
  Search,
  X
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface ManualOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: Brand[]
  menuItems: MenuItem[]
  onCreateOrder: (params: {
    brandId: string
    channel: Channel
    customerName: string
    customerPhone?: string
    customerAddress?: string
    items: { menuItemId: string; quantity: number }[]
  }) => void
}

export function ManualOrderModal({
  open,
  onOpenChange,
  brands,
  menuItems,
  onCreateOrder,
}: ManualOrderModalProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || '')
  const [channel, setChannel] = useState<Channel>('WALK_IN')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStation, setSelectedStation] = useState<string>('ALL')
  const [cart, setCart] = useState<{ [menuItemId: string]: number }>({})

  // Keep selected brand valid
  const currentBrand = brands.find((b) => b.id === selectedBrandId) || brands[0]
  const brandDishes = menuItems.filter((m) => m.brandId === currentBrand?.id)

  // Extract unique stations/categories available in this brand's menu
  const availableStations = Array.from(new Set(brandDishes.map((d) => d.station)))

  // Filtered dishes based on search and station category
  const filteredDishes = brandDishes.filter((dish) => {
    const matchesSearch = !searchQuery.trim() || 
      dish.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    const matchesStation = selectedStation === 'ALL' || dish.station === selectedStation
    return matchesSearch && matchesStation
  })

  const handleAddToCart = (dishId: string) => {
    setCart((prev) => ({
      ...prev,
      [dishId]: (prev[dishId] || 0) + 1,
    }))
  }

  const handleUpdateQty = (dishId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[dishId] || 0
      const next = current + delta
      if (next <= 0) {
        const copy = { ...prev }
        delete copy[dishId]
        return copy
      }
      return { ...prev, [dishId]: next }
    })
  }

  const totalItemsCount = Object.values(cart).reduce((sum, q) => sum + q, 0)
  const cartSubtotal = Object.entries(cart).reduce((sum, [id, q]) => {
    const item = menuItems.find((m) => m.id === id)
    return sum + (item ? item.sellingPrice * q : 0)
  }, 0)

  const handlePunchOrder = (e: React.FormEvent) => {
    e.preventDefault()
    if (totalItemsCount === 0) return

    const items = Object.entries(cart).map(([menuItemId, quantity]) => ({
      menuItemId,
      quantity,
    }))

    onCreateOrder({
      brandId: currentBrand.id,
      channel,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      items,
    })

    // Reset
    setCart({})
    setCustomerName('')
    setCustomerPhone('')
    setCustomerAddress('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[82dvh] sm:max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border border-border shadow-2xl">
        <form onSubmit={handlePunchOrder} className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border/80 bg-muted/20">
            <DialogHeader className="p-0 text-left">
              <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <span>Quick Counter POS</span>
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-0.5">
              Punch walk-in or phone orders straight to the kitchen
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs no-scrollbar">
            {/* Step 1: Select Brand Filter */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                1. Select Brand
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {brands.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setSelectedBrandId(b.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all border cursor-pointer",
                      selectedBrandId === b.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background text-foreground border-border/80 hover:bg-muted"
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Channel & Customer Details */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono">Order Type</label>
                  <div className="grid grid-cols-2 gap-1 bg-muted/80 p-0.5 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setChannel('WALK_IN')}
                      className={cn(
                        "py-1.5 rounded font-bold text-[11px] transition-all cursor-pointer",
                        channel === 'WALK_IN' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                      )}
                    >
                      Walk-In
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannel('DIRECT')}
                      className={cn(
                        "py-1.5 rounded font-bold text-[11px] transition-all cursor-pointer",
                        channel === 'DIRECT' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                      )}
                    >
                      Phone Delivery
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
                    {channel === 'WALK_IN' ? 'Customer / Token' : 'Customer Name'}
                  </label>
                  <Input
                    placeholder={channel === 'WALK_IN' ? 'e.g. Token #1' : 'e.g. Rahul Sharma'}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Conditional Phone & Delivery Address for Phone/Direct Takeaway */}
              {channel === 'DIRECT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/80 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-primary" />
                      <span>Phone Number</span>
                    </label>
                    <Input
                      type="tel"
                      placeholder="e.g. 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
                      Delivery Address / Flat
                    </label>
                    <Input
                      placeholder="e.g. Flat 402, Sunshine Apts"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Fast Tap Dish Tiles with Instant Search & Category Filters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  2. Select Dishes
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {filteredDishes.length} of {brandDishes.length} items
                </span>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search dishes by name (e.g. Biryani, Burger, Chai)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-background"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Station / Category Quick Filter Pills */}
              {availableStations.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedStation('ALL')}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border cursor-pointer",
                      selectedStation === 'ALL'
                        ? "bg-foreground text-background border-foreground shadow-2xs"
                        : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground"
                    )}
                  >
                    All ({brandDishes.length})
                  </button>
                  {availableStations.map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setSelectedStation(st)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border cursor-pointer",
                        selectedStation === st
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground"
                      )}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}

              {/* Dishes Grid */}
              {filteredDishes.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center space-y-1 bg-muted/20">
                  <p className="text-xs font-semibold text-foreground">No dishes found</p>
                  <p className="text-[11px] text-muted-foreground">
                    Try searching for another keyword or clear the filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto no-scrollbar pr-0.5">
                  {filteredDishes.map((dish) => {
                    const inCartQty = cart[dish.id] || 0
                    return (
                      <div
                        key={dish.id}
                        onClick={() => handleAddToCart(dish.id)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[68px]",
                          inCartQty > 0
                            ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                            : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        <div>
                          <h4 className="font-bold text-xs text-foreground line-clamp-1">{dish.name}</h4>
                          <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">
                            {dish.station}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-border/40">
                          <span className="font-extrabold font-mono text-primary text-xs">
                            {formatCurrency(dish.sellingPrice)}
                          </span>
                          {inCartQty > 0 ? (
                            <Badge variant="default" className="h-5 px-1.5 text-[10px] font-mono font-bold">
                              {inCartQty} in cart
                            </Badge>
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-0.5">
                              <Plus className="w-3 h-3" /> Add
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Step 4: Active Cart Summary */}
            {totalItemsCount > 0 && (
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>Cart ({totalItemsCount} items)</span>
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="text-[10px] text-destructive hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>

                <div className="space-y-1.5">
                  {Object.entries(cart).map(([id, qty]) => {
                    const item = menuItems.find((m) => m.id === id)
                    if (!item) return null
                    return (
                      <div key={id} className="flex items-center justify-between bg-background p-2 rounded-lg border border-border/60 text-xs">
                        <span className="font-medium text-foreground truncate max-w-[130px]">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-foreground text-xs">
                            {formatCurrency(item.sellingPrice * qty)}
                          </span>
                          <div className="flex items-center border border-border rounded bg-muted/40">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateQty(id, -1)
                              }}
                              className="px-2 py-0.5 text-xs font-bold hover:bg-muted cursor-pointer"
                            >
                              -
                            </button>
                            <span className="px-2 font-mono font-bold text-xs">{qty}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateQty(id, 1)
                              }}
                              className="px-2 py-0.5 text-xs font-bold hover:bg-muted cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Punch Action */}
          <div className="p-3.5 sm:p-4 border-t border-border/80 bg-card shrink-0 flex items-center justify-between gap-3 shadow-md z-10">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                Total:
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-foreground">
                {formatCurrency(cartSubtotal)}
              </span>
            </div>

            <Button
              type="submit"
              disabled={totalItemsCount === 0}
              className="h-10 px-4 text-xs font-extrabold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Punch to Kitchen</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
