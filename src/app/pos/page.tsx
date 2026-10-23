'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  X,
  ArrowLeft,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { useKitchen } from '@/context/KitchenContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function POSPage() {
  const router = useRouter()
  const { brands, menuItems, orders, handleCreateManualOrder } = useKitchen()

  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || '')
  const [channel, setChannel] = useState<Channel>('WALK_IN')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStation, setSelectedStation] = useState<string>('ALL')
  const [cart, setCart] = useState<{ [menuItemId: string]: number }>({})
  const [customerFoundBadge, setCustomerFoundBadge] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Load customer directory from localStorage or existing past orders
  const getSavedCustomers = (): Record<string, { name: string; address?: string }> => {
    try {
      const stored = localStorage.getItem('kitchenos_pos_customers')
      const directory = stored ? JSON.parse(stored) : {}
      
      // Also index any existing orders that had phone numbers
      orders.forEach((ord) => {
        if (ord.customerPhone) {
          const cleanPhone = ord.customerPhone.replace(/\D/g, '')
          if (cleanPhone && !directory[cleanPhone]) {
            directory[cleanPhone] = {
              name: ord.customerName || '',
              address: ord.customerAddress || ''
            }
          }
        }
      })
      return directory
    } catch {
      return {}
    }
  }

  // Handle phone change and auto-fill customer details if found
  const handlePhoneChange = (phoneInput: string) => {
    setCustomerPhone(phoneInput)
    const digits = phoneInput.replace(/\D/g, '')

    if (digits.length >= 10) {
      const directory = getSavedCustomers()
      const match = directory[digits] || directory[digits.slice(-10)]
      if (match) {
        if (match.name) setCustomerName(match.name)
        if (match.address) setCustomerAddress(match.address)
        setCustomerFoundBadge(true)
        return
      }
    }
    setCustomerFoundBadge(false)
  }

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

    // Save/update customer directory for reuse on next order
    if (customerPhone.trim()) {
      try {
        const cleanDigits = customerPhone.replace(/\D/g, '')
        if (cleanDigits.length >= 7) {
          const directory = getSavedCustomers()
          directory[cleanDigits] = {
            name: customerName.trim(),
            address: customerAddress.trim() || undefined
          }
          localStorage.setItem('kitchenos_pos_customers', JSON.stringify(directory))
        }
      } catch (err) {
        console.error('Failed saving customer profile', err)
      }
    }

    handleCreateManualOrder({
      brandId: currentBrand.id,
      channel,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      items,
    })

    setCart({})
    router.push('/orders')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      {/* Clean Single-Line Header */}
      <div className="flex items-center justify-between py-1 border-b border-border/60 pb-3">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quick Counter POS</span>
        </Link>
        <Link href="/orders" className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </Link>
      </div>

      <form onSubmit={handlePunchOrder} className="space-y-4">
        {/* Step 1: Select Brand */}
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

        {/* Step 2: Order Type & Customer Details (Cleanly Stacked at Top) */}
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono">Order Type</label>
            <div className="grid grid-cols-2 gap-1 bg-muted/80 p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setChannel('WALK_IN')}
                className={cn(
                  "py-1.5 rounded font-bold text-xs transition-all cursor-pointer text-center",
                  channel === 'WALK_IN' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Walk-In
              </button>
              <button
                type="button"
                onClick={() => setChannel('DIRECT')}
                className={cn(
                  "py-1.5 rounded font-bold text-xs transition-all cursor-pointer text-center",
                  channel === 'DIRECT' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Phone Delivery
              </button>
            </div>
          </div>

          {/* If Walk-In: Show Table Number with fast presets */}
          {channel === 'WALK_IN' ? (
            <div className="space-y-1.5 p-2 rounded-xl bg-muted/20 border border-border/60">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
                  Table Number
                </label>
                <div className="flex items-center gap-1">
                  {['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6'].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setCustomerName(t)}
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-bold rounded border cursor-pointer transition-all",
                        customerName === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                placeholder="e.g. Table 1 or T-4 (or enter custom table/token)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          ) : (
            /* If Phone Delivery: Show Customer Phone (Lookup), Name & Address */
            <div className="space-y-2 p-2.5 rounded-xl bg-muted/30 border border-border/80 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-primary" />
                      <span>Phone Number</span>
                    </span>
                    {customerFoundBadge && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        ✓ Repeat Customer
                      </Badge>
                    )}
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. 98765 43210"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
                    Customer Name
                  </label>
                  <Input
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
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

        {/* Step 3: Dish Catalog with Sticky Filters & Scrollable Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
              Select Dishes
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {filteredDishes.length} of {brandDishes.length} items
            </span>
          </div>

          {/* Instant Search Bar & Category Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search dishes..."
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

            {/* Category Dropdown */}
            {availableStations.length > 1 && (
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">All Categories ({brandDishes.length})</option>
                {availableStations.map((st) => {
                  const count = brandDishes.filter((d) => d.station === st).length
                  return (
                    <option key={st} value={st}>
                      {st} ({count})
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          {/* High-Capacity Dish Catalog (Scrolls smoothly for 100s of items) */}
          {filteredDishes.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-1 bg-muted/20">
              <p className="text-xs font-semibold text-foreground">No dishes found</p>
              <p className="text-[11px] text-muted-foreground">
                Try searching for another keyword or clear the filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[58vh] overflow-y-auto pr-1 pb-16">
              {filteredDishes.map((dish) => {
                const inCartQty = cart[dish.id] || 0
                return (
                  <div
                    key={dish.id}
                    onClick={() => handleAddToCart(dish.id)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[72px] select-none active:scale-[0.98]",
                      inCartQty > 0
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div>
                      <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-tight">{dish.name}</h4>
                      <span className="text-[9px] text-muted-foreground font-mono block mt-1">
                        {dish.station}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                      <span className="font-extrabold font-mono text-primary text-xs">
                        {formatCurrency(dish.sellingPrice)}
                      </span>
                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(dish.id, -1)
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-background border border-border text-foreground font-black text-xs hover:bg-muted cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-xs px-1 text-primary">{inCartQty}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(dish.id, 1)
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-primary text-primary-foreground font-black text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-0.5 hover:text-foreground">
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

        {/* Step 4: Order Cart (Normal in-page flow, not in fixed bottom bar) */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <span>Cart ({totalItemsCount} items)</span>
            </span>
            {totalItemsCount > 0 && (
              <button
                type="button"
                onClick={() => setCart({})}
                className="text-[11px] text-destructive hover:underline cursor-pointer font-semibold"
              >
                Clear All
              </button>
            )}
          </div>

          {totalItemsCount === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-lg bg-muted/20">
              No items in cart. Tap any dish above to add.
            </div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(cart).map(([id, qty]) => {
                const item = menuItems.find((m) => m.id === id)
                if (!item) return null
                return (
                  <div key={id} className="flex items-center justify-between bg-muted/30 p-2.5 rounded-lg border border-border/60 text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[170px]">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-foreground text-xs">
                        {formatCurrency(item.sellingPrice * qty)}
                      </span>
                      <div className="flex items-center border border-border rounded-md bg-background shadow-2xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateQty(id, -1)
                          }}
                          className="px-2 py-0.5 text-xs font-black hover:bg-muted cursor-pointer"
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
                          className="px-2 py-0.5 text-xs font-black hover:bg-muted cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* In-Page Cart Checkout Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                Total:
              </span>
              <span className="text-xl font-black font-mono text-foreground">
                {formatCurrency(cartSubtotal)}
              </span>
            </div>

            <Button
              type="submit"
              disabled={totalItemsCount === 0}
              className="h-10 px-6 text-xs font-extrabold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Punch to Kitchen</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
