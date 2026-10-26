'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brand, MenuItem, Channel, PaymentMethod, Order } from '@/types'
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
  ChevronDown,
  Banknote,
  QrCode,
  CreditCard,
  Clock,
  Printer,
  Share2,
  Truck
} from 'lucide-react'
import { useKitchen } from '@/context/KitchenContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BillReceiptModal } from '@/components/pos/BillReceiptModal'
import { createManualOrderAction, searchCustomersAction } from '@/features/orders/order-actions'
import { createClient } from '@/lib/supabase/client'

export default function POSPage() {
  const router = useRouter()
  const { brands, menuItems, orders, handleCreateManualOrder } = useKitchen()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || '')
  const [channel, setChannel] = useState<Channel>('WALK_IN')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStation, setSelectedStation] = useState<string>('ALL')
  const [cart, setCart] = useState<{ [menuItemId: string]: number }>({})
  const [customerFoundBadge, setCustomerFoundBadge] = useState(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<Array<{ name: string; phone: string; address?: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Billing & Payment States
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [applyGst, setApplyGst] = useState<boolean>(true)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false)

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

  // Handle phone change and auto-fill customer details from DB & Local Directory
  const handlePhoneChange = async (phoneInput: string) => {
    setCustomerPhone(phoneInput)
    const digits = phoneInput.replace(/\D/g, '')

    // 1. Instant local cache lookup
    if (digits.length >= 4) {
      const directory = getSavedCustomers()
      const localMatches: Array<{ name: string; phone: string; address?: string }> = []
      
      for (const [savedPhone, details] of Object.entries(directory)) {
        if (savedPhone.includes(digits) || details.name.toLowerCase().includes(phoneInput.toLowerCase())) {
          localMatches.push({
            phone: savedPhone,
            name: details.name,
            address: details.address,
          })
        }
      }

      if (localMatches.length > 0) {
        setCustomerSuggestions(localMatches.slice(0, 5))
        setShowSuggestions(true)
      }

      // Exact match auto-fill
      const exactMatch = directory[digits] || directory[digits.slice(-10)]
      if (exactMatch) {
        if (exactMatch.name) setCustomerName(exactMatch.name)
        if (exactMatch.address) setCustomerAddress(exactMatch.address)
        setCustomerFoundBadge(true)
      } else {
        setCustomerFoundBadge(false)
      }

      // 2. Query Postgres database asynchronously for any customer across all branch orders
      try {
        const res = await searchCustomersAction(digits)
        if (res.ok && res.data && res.data.length > 0) {
          setCustomerSuggestions(res.data.slice(0, 5))
          setShowSuggestions(true)
          if (!exactMatch && digits.length >= 10) {
            const first = res.data[0]
            if (first) {
              setCustomerName(first.name)
              if (first.address) setCustomerAddress(first.address)
              setCustomerFoundBadge(true)
            }
          }
        }
      } catch (err) {
        console.warn('DB customer lookup fallback:', err)
      }
    } else {
      setShowSuggestions(false)
      setCustomerFoundBadge(false)
    }
  }

  const handleSelectCustomer = (customer: { name: string; phone: string; address?: string }) => {
    setCustomerPhone(customer.phone)
    setCustomerName(customer.name)
    if (customer.address) setCustomerAddress(customer.address)
    setCustomerFoundBadge(true)
    setShowSuggestions(false)
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
  const gstAmount = applyGst ? Math.round(cartSubtotal * 0.05) : 0
  const grandTotal = cartSubtotal + gstAmount
  const changeToReturn = cashTendered ? Math.max(0, Number(cashTendered) - grandTotal) : 0

  const handlePunchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (totalItemsCount === 0 || isSubmitting) return

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

    setIsSubmitting(true)
    try {
      // 1. Optimistic update in KitchenContext state
      const optimisticOrder = handleCreateManualOrder({
        brandId: currentBrand.id,
        channel,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        paymentMethod,
        paymentStatus: paymentMethod === 'DUE' || paymentMethod === 'COD' ? 'PENDING' : 'PAID',
        items,
        skipServerPersist: true,
      })

      // 2. Direct Server Action execution (nextjs-app-architecture)
      const res = await createManualOrderAction({
        brandId: currentBrand.id,
        channel,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        paymentMethod,
        items,
      })

      const actualOrderId = res.ok ? res.data.orderId : optimisticOrder.id
      const actualOrderNumber = res.ok ? res.data.orderNumber : optimisticOrder.orderNumber

      const finalOrder: Order = {
        ...optimisticOrder,
        id: actualOrderId,
        orderNumber: actualOrderNumber,
      }

      // 3. Supabase Realtime WebSocket broadcast (sub-10ms KDS sync without DB WAL bottlenecks)
      try {
        const supabase = createClient()
        const channelRef = supabase.channel('kitchen-global-kds')
        channelRef.send({
          type: 'broadcast',
          event: 'order_status_changed',
          payload: { orderId: actualOrderId, status: 'PREPARING' },
        })
      } catch (realtimeErr) {
        console.warn('POS Realtime broadcast non-critical failure:', realtimeErr)
      }

      // 4. Show Bill/WhatsApp receipt modal & reset cart
      setCompletedOrder(finalOrder)
      setIsReceiptOpen(true)
      setCart({})
      setCashTendered('')
    } catch (err) {
      console.error('Failed to punch order:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      {/* iOS Styled Navigation Subheader */}
      <div className="flex items-center justify-between py-1">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-primary" />
          <span>Quick Counter POS</span>
        </Link>
        <Link 
          href="/orders" 
          className="text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-all px-2 py-1 rounded-lg hover:bg-muted/40"
        >
          Cancel
        </Link>
      </div>

      <form onSubmit={handlePunchOrder} className="space-y-4">
        {/* Step 1: Select Brand (Apple Inset Pill Bar) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono block">
            1. Select Brand
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {brands.map((b) => {
              const isSelected = selectedBrandId === b.id
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setSelectedBrandId(b.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all border cursor-pointer active:scale-[0.98] shadow-2xs flex items-center gap-2",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-foreground border-border/80 hover:bg-muted/50"
                  )}
                >
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: isSelected ? '#ffffff' : b.color }} 
                  />
                  <span>{b.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Order Type & Customer Details (Apple Segmented Control) */}
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground font-mono block">
              Order Type
            </label>
            <div className="grid grid-cols-2 gap-1 bg-muted/50 p-1 rounded-2xl border border-border/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setChannel('WALK_IN')}
                className={cn(
                  "h-9 rounded-xl font-bold text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
                  channel === 'WALK_IN' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Walk-In</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('DIRECT')}
                className={cn(
                  "h-9 rounded-xl font-bold text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
                  channel === 'DIRECT' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Phone Delivery</span>
              </button>
            </div>
          </div>

          {/* If Walk-In: Show Table Number with fast presets */}
          {channel === 'WALK_IN' ? (
            <div className="space-y-2 p-3 rounded-2xl bg-card/90 border border-border/80 backdrop-blur-md shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground font-mono">
                  Table Number
                </label>
                <div className="flex items-center gap-1">
                  {['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6'].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setCustomerName(t)}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg border cursor-pointer active:scale-95 transition-all shadow-2xs",
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
                className="h-10 text-xs bg-background rounded-xl border-border/80"
              />
            </div>
          ) : (
            /* If Phone Delivery: Show Customer Phone (Lookup), Name & Address */
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-card/90 border border-border/80 backdrop-blur-md shadow-2xs animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground font-mono flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-primary" />
                      <span>Phone Number</span>
                    </span>
                    {customerFoundBadge && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        ✓ Repeat Customer
                      </Badge>
                    )}
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. 98765 43210"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onFocus={() => {
                      if (customerSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    className="h-10 text-xs bg-background rounded-xl border-border/80"
                  />

                  {/* Customer Quick-Select Dropdown */}
                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute top-[102%] left-0 right-0 z-50 bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl shadow-lg p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between px-2 py-0.5 border-b border-border/40">
                        <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                          Saved Customers ({customerSuggestions.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSuggestions(false)}
                          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {customerSuggestions.map((cust, idx) => (
                          <button
                            key={cust.phone + idx}
                            type="button"
                            onClick={() => handleSelectCustomer(cust)}
                            className="w-full text-left p-2 rounded-lg hover:bg-muted/60 transition-all flex items-center justify-between gap-2 cursor-pointer active:scale-[0.99]"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-foreground block truncate">
                                {cust.name}
                              </span>
                              {cust.address && (
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {cust.address}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono font-semibold text-primary shrink-0 bg-primary/10 px-1.5 py-0.5 rounded-md">
                              {cust.phone}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground font-mono">
                    Customer Name
                  </label>
                  <Input
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-10 text-xs bg-background rounded-xl border-border/80"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground font-mono">
                  Delivery Address / Flat
                </label>
                <Input
                  placeholder="e.g. Flat 402, Sunshine Apts"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="h-10 text-xs bg-background rounded-xl border-border/80"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Dish Catalog with Sticky Filters & Scrollable Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Select Dishes
            </span>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md">
              {filteredDishes.length} of {brandDishes.length} items
            </span>
          </div>

          {/* Instant Search Bar & Category Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-xs rounded-xl border border-border/80 bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-2 focus:ring-primary/20 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            {availableStations.length > 1 && (
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border/80 bg-background text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer max-w-[150px] truncate shadow-2xs"
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
            <div className="p-8 rounded-2xl border border-dashed border-border/80 text-center space-y-1 bg-muted/20">
              <p className="text-xs font-bold text-foreground">No dishes found</p>
              <p className="text-[11px] text-muted-foreground">
                Try searching for another keyword or clear the filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[58vh] overflow-y-auto pr-1 pb-16 no-scrollbar">
              {filteredDishes.map((dish) => {
                const inCartQty = cart[dish.id] || 0
                return (
                  <div
                    key={dish.id}
                    onClick={() => handleAddToCart(dish.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[80px] select-none active:scale-[0.98] shadow-2xs backdrop-blur-xs",
                      inCartQty > 0
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                        : "border-border/80 bg-card/90 hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <div>
                      <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-snug">{dish.name}</h4>
                      <span className="text-[9px] text-muted-foreground font-mono block mt-1 uppercase tracking-wider">
                        {dish.station}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-border/40">
                      <span className="font-extrabold font-mono text-primary text-xs">
                        {formatCurrency(dish.sellingPrice)}
                      </span>
                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-1 bg-background rounded-lg border border-border/80 p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(dish.id, -1)
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded-md bg-muted text-foreground font-black text-xs hover:bg-muted/80 cursor-pointer active:scale-90"
                          >
                            −
                          </button>
                          <span className="font-mono font-bold text-xs px-1 text-primary">{inCartQty}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(dish.id, 1)
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-xs cursor-pointer active:scale-90"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5 hover:text-foreground">
                          <Plus className="w-3 h-3 text-primary" /> Add
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

          {/* Step 4: Billing & Payment Mode */}
          {totalItemsCount > 0 && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Payment Method
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyGst}
                    onChange={(e) => setApplyGst(e.target.checked)}
                    className="rounded border-border accent-primary cursor-pointer w-3.5 h-3.5"
                  />
                  <span>Apply 5% GST</span>
                </label>
              </div>

              {/* Payment Method Selector Grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'CASH' as PaymentMethod, label: 'Cash', icon: Banknote },
                  { id: 'UPI' as PaymentMethod, label: 'UPI / QR', icon: QrCode },
                  { id: 'CARD' as PaymentMethod, label: 'Card / EDC', icon: CreditCard },
                  { id: 'COD' as PaymentMethod, label: 'Cash on Del (COD)', icon: Truck },
                  { id: 'DUE' as PaymentMethod, label: 'Pay Later', icon: Clock },
                ].map((m) => {
                  const Icon = m.icon
                  const isSelected = paymentMethod === m.id
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={cn(
                        "flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer gap-1 text-center leading-tight",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate w-full">{m.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Cash Quick Tender Helper (Bigger Ergonomic Apple Inset Card) */}
              {paymentMethod === 'CASH' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1">
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-200 tracking-tight shrink-0">
                        Cash Tendered:
                      </span>
                      <div className="relative flex-1 max-w-[160px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-muted-foreground">
                          ₹
                        </span>
                        <input
                          type="number"
                          placeholder={`${grandTotal}`}
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          className="w-full h-10 pl-7 pr-3 text-sm font-mono font-extrabold bg-background rounded-xl border border-amber-500/40 text-foreground focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 shadow-2xs"
                        />
                      </div>
                    </div>

                    {cashTendered && Number(cashTendered) >= grandTotal && (
                      <div className="text-right shrink-0 bg-background/80 px-3 py-1 rounded-xl border border-border/60 shadow-2xs">
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          Return Change:
                        </span>
                        <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                          {formatCurrency(changeToReturn)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Fast Tender Preset Pills */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground font-semibold">Exact / Round:</span>
                    {[
                      grandTotal, 
                      Math.ceil(grandTotal / 50) * 50, 
                      Math.ceil(grandTotal / 100) * 100, 
                      500, 
                      1000
                    ]
                      .filter((val, idx, arr) => val >= grandTotal && arr.indexOf(val) === idx)
                      .slice(0, 4)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashTendered(String(val))}
                          className={cn(
                            "px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer active:scale-95 shadow-2xs",
                            cashTendered === String(val)
                              ? "bg-amber-500 text-white border-amber-600 font-extrabold"
                              : "bg-background text-foreground border-border/80 hover:bg-muted"
                          )}
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* UPI QR Instant Helper */}
              {paymentMethod === 'UPI' && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between text-xs">
                  <span className="text-blue-900 dark:text-blue-300 font-medium">
                    Show dynamic QR at counter for:
                  </span>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              )}

              {/* COD Delivery Helper */}
              {paymentMethod === 'COD' && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                  <span className="text-amber-900 dark:text-amber-300 font-medium">
                    Rider will collect cash at delivery:
                  </span>
                  <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              )}

              {/* Bill Summary Breakdown */}
              <div className="space-y-1 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/60 font-mono">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                {applyGst && (
                  <div className="flex justify-between text-[11px]">
                    <span>GST (2.5% CGST + 2.5% SGST):</span>
                    <span>+{formatCurrency(gstAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* In-Page Cart Checkout Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                Bill Total:
              </span>
              <span className="text-xl font-black font-mono text-foreground">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            <Button
              type="submit"
              disabled={totalItemsCount === 0 || isSubmitting}
              className="h-10 px-5 text-xs font-extrabold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Punching Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Punch & Print Bill</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Bill & WhatsApp Receipt Modal */}
      <BillReceiptModal
        order={completedOrder}
        open={isReceiptOpen}
        onOpenChange={setIsReceiptOpen}
        onDone={() => router.push('/orders')}
      />
    </div>
  )
}
