'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brand, MenuItem, Channel, PaymentMethod, PaymentStatus, Order } from '@/types'
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
  Truck,
  Bike,
  Sparkles,
  Percent,
  Tag
} from 'lucide-react'
import { useKitchen } from '@/context/KitchenContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BillReceiptModal } from '@/components/pos/BillReceiptModal'
import { createManualOrderAction, searchCustomersAction, getPosCatalogAction } from '@/features/orders/order-actions'
import { useKitchenStore } from '@/stores/useKitchenStore'
import { broadcastKitchenEvent } from '@/lib/supabase/realtime-bus'
import { getDeviceUuid } from '@/lib/utils'
import QRCodeLib from 'qrcode'

export function POSClient() {
  const router = useRouter()
  const activeKitchenId = useKitchenStore((s) => s.activeKitchenId)
  const { brands, menuItems, orders, handleCreateManualOrder, setOrders, setBrands, setMenuItems } = useKitchen()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = React.useRef(false)

  // Cloud Kitchen Channel Selector:
  // 'WALK_IN' = Counter Pickup/Takeaway | 'DIRECT' = Kitchen Fleet Delivery | 'SWIGGY' = Swiggy Punch | 'ZOMATO' = Zomato Punch
  const [channel, setChannel] = useState<Channel>('WALK_IN')
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || '')

  // Customer & Dispatch Details
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [aggregatorOrderId, setAggregatorOrderId] = useState('')
  const [riderOtp, setRiderOtp] = useState('')

  // Search & Cart
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStation, setSelectedStation] = useState<string>('ALL')
  const [cart, setCart] = useState<{ [menuItemId: string]: number }>({})
  const [customerFoundBadge, setCustomerFoundBadge] = useState(false)
  const [customerSuggestions, setCustomerSuggestions] = useState<Array<{ name: string; phone: string; address?: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Discounts
  const [discountType, setDiscountType] = useState<'NONE' | '5%' | '10%' | 'FLAT50' | 'CUSTOM'>('NONE')
  const [customDiscountAmt, setCustomDiscountAmt] = useState<string>('')

  // Billing & Payment States
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [applyGst, setApplyGst] = useState<boolean>(true)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false)
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('')
  const [validationError, setValidationError] = useState<string>('')

  // Enforce POS permission guard
  useEffect(() => {
    try {
      const activeRole = localStorage.getItem('kitchflow_active_staff_role')
      const activePerms = localStorage.getItem('kitchflow_active_staff_permissions')
      if (activeRole && activeRole !== 'owner' && activePerms) {
        const perms = JSON.parse(activePerms)
        if (Array.isArray(perms) && !perms.includes('pos')) {
          const fallback = ['orders', 'kds', 'packing', 'inventory'].find((p) => perms.includes(p)) || 'orders'
          router.replace(`/${fallback}`)
        }
      }
    } catch { }
  }, [router])

  // Synchronize active brand when brands load asynchronously from KitchenContext
  useEffect(() => {
    if (brands.length > 0) {
      const exists = brands.some((b) => b.id === selectedBrandId)
      if (!selectedBrandId || !exists) {
        setSelectedBrandId(brands[0].id)
      }
    }
  }, [brands, selectedBrandId])

  // Fetch live brands & menu items from database or catalog on mount and whenever active outlet changes
  useEffect(() => {
    let isMounted = true
    const kid = activeKitchenId && activeKitchenId !== 'default' && activeKitchenId !== 'all' && activeKitchenId !== 'ALL'
      ? activeKitchenId
      : (typeof window !== 'undefined' ? localStorage.getItem('kitchflow_active_kitchen_id') || undefined : undefined)

    getPosCatalogAction(kid)
      .then((res) => {
        if (isMounted && res.ok && res.data) {
          if (res.data.brands && res.data.brands.length > 0) {
            setBrands(res.data.brands)
          }
          if (res.data.menuItems && res.data.menuItems.length > 0) {
            setMenuItems(res.data.menuItems)
          }
        }
      })
      .catch((err) => console.warn('POS Catalog fetch notice:', err))
    return () => {
      isMounted = false
    }
  }, [activeKitchenId, setBrands, setMenuItems])

  // Reusable Checkout Cart Component for Desktop Column & Mobile Bottom Sheet
  const renderCartContent = (isMobileSheet = false) => (
    <div className={cn("space-y-4", isMobileSheet && "pb-6")}>
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground">
              Kitchen Cart ({totalItemsCount})
            </h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              {currentBrand ? currentBrand.name : 'All Brands'}
            </p>
          </div>
        </div>
        {totalItemsCount > 0 && (
          <button
            type="button"
            onClick={() => setCart({})}
            className="text-xs text-muted-foreground hover:text-red-500 font-bold transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      {/* Cart Item List */}
      {totalItemsCount === 0 ? (
        <div className="py-10 text-center text-muted-foreground space-y-1.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <p className="text-xs font-bold text-foreground">Cart is empty</p>
          <p className="text-[11px] text-muted-foreground">Tap any dish above to add to cart</p>
        </div>
      ) : (
        <div className={cn("overflow-y-auto space-y-2 pr-1", isMobileSheet ? "max-h-[35vh]" : "max-h-56")}>
          {Object.entries(cart).map(([dishId, qty]) => {
            const item = menuItems.find((m) => m.id === dishId)
            if (!item) return null
            const brand = brands.find((b) => b.id === item.brandId)
            return (
              <div
                key={dishId}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/30 border border-border/60 text-xs hover:border-border transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold block truncate text-foreground text-xs leading-snug">{item.name}</span>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                    {brand && <span>{brand.name}</span>}
                    <span>•</span>
                    <span>{formatCurrency(item.sellingPrice)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono font-bold text-foreground text-xs">
                    {formatCurrency(item.sellingPrice * qty)}
                  </span>
                  <div className="flex items-center border border-border/80 rounded-xl bg-card shadow-2xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(dishId, -1)}
                      className="w-8 h-8 flex items-center justify-center text-xs font-bold hover:bg-muted active:scale-95 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <span className="px-1.5 font-mono font-bold text-xs min-w-5 text-center">{qty}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(dishId, 1)}
                      className="w-8 h-8 flex items-center justify-center text-xs font-bold hover:bg-muted active:scale-95 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Discount Selector */}
      {totalItemsCount > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-bold uppercase text-[10px] text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3 text-primary" />
              <span>Discount / Offer</span>
            </span>
            {discountAmount > 0 && (
              <span className="text-emerald-600 font-bold font-mono text-xs">
                - {formatCurrency(discountAmount)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold">
            {[
              { id: 'NONE' as const, label: 'None' },
              { id: '5%' as const, label: '5% Off' },
              { id: '10%' as const, label: '10% Off' },
              { id: 'FLAT50' as const, label: '₹50 Off' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDiscountType(d.id)}
                className={cn(
                  "py-2 rounded-xl border text-center transition-all min-h-9 flex items-center justify-center cursor-pointer",
                  discountType === d.id
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs font-black"
                    : "bg-card text-muted-foreground border-border/80 hover:bg-muted/60"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Smart Cloud Kitchen Payment Mode */}
      {totalItemsCount > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-border/80">
          {channel === 'SWIGGY' || channel === 'ZOMATO' ? (
            /* Aggregator Prepaid Banner */
            <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-orange-950 dark:text-orange-300">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                <span>Prepaid Online via {channel}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Customer already paid on the platform. No counter cash collected.
              </p>
            </div>
          ) : (
            /* Direct Counter / Fleet Payment Selector */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">
                  Payment Mode
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyGst}
                    onChange={(e) => setApplyGst(e.target.checked)}
                    className="rounded border-border accent-primary cursor-pointer w-4 h-4"
                  />
                  <span className="text-[11px] font-medium">Apply 5% GST</span>
                </label>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'UPI' as PaymentMethod, label: 'UPI / QR', icon: QrCode },
                  { id: 'CASH' as PaymentMethod, label: 'Cash', icon: Banknote },
                  { id: 'CARD' as PaymentMethod, label: 'Card / POS', icon: CreditCard },
                  ...(channel === 'DIRECT'
                    ? [{ id: 'COD' as PaymentMethod, label: 'Cash on Del', icon: Truck }]
                    : [{ id: 'DUE' as PaymentMethod, label: 'Pay Later', icon: Clock }]),
                ].map((m) => {
                  const Icon = m.icon
                  const isSelected = paymentMethod === m.id
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={cn(
                        "py-2.5 px-1 rounded-2xl border text-[11px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all min-h-12 active:scale-95 cursor-pointer",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card text-muted-foreground border-border/80 hover:bg-muted"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="truncate w-full text-[10px] leading-tight">{m.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Dynamic UPI QR Code Display on Screen */}
              {paymentMethod === 'UPI' && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block">
                      Scan UPI QR:
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      PhonePe, GPay, Paytm
                    </span>
                    <span className="font-mono font-black text-sm text-primary block pt-0.5">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                  {upiQrDataUrl && (
                    <img
                      src={upiQrDataUrl}
                      alt="Dynamic UPI QR"
                      className="w-16 h-16 rounded-xl border border-white/80 bg-white p-1 shadow-xs shrink-0"
                    />
                  )}
                </div>
              )}

              {/* Cash Tender Helper */}
              {paymentMethod === 'CASH' && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                      Cash Given:
                    </span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">₹</span>
                      <input
                        type="number"
                        placeholder={`${grandTotal}`}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-full h-8 pl-6 pr-2 text-xs font-mono font-bold bg-background rounded-xl border border-amber-500/40 text-foreground"
                      />
                    </div>
                  </div>

                  {cashTendered && Number(cashTendered) >= grandTotal && (
                    <div className="flex justify-between items-center text-xs font-mono pt-1 border-t border-amber-500/20">
                      <span className="text-muted-foreground">Return Change:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(changeToReturn)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 pt-0.5">
                    {[grandTotal, Math.ceil(grandTotal / 50) * 50, 500, 1000]
                      .filter((v, i, a) => v >= grandTotal && a.indexOf(v) === i)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashTendered(String(val))}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border bg-background hover:bg-muted active:scale-95"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bill Totals Summary */}
          <div className="space-y-1 text-xs text-muted-foreground bg-muted/40 p-3 rounded-2xl border border-border/60 font-mono">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="text-foreground">{formatCurrency(cartSubtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Discount:</span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            {applyGst && (
              <div className="flex justify-between text-[11px]">
                <span>GST (2.5% + 2.5%):</span>
                <span>+{formatCurrency(gstAmount)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Alert Message */}
      {validationError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Checkout Punch Action Button */}
      <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
            Total Payable:
          </span>
          <span className="text-xl font-black font-mono text-foreground">
            {formatCurrency(grandTotal)}
          </span>
        </div>

        <Button
          type="button"
          onClick={(e) => handlePunchOrder(e as any)}
          disabled={totalItemsCount === 0 || isSubmitting}
          className="h-11 px-5 text-xs font-black gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm cursor-pointer disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Punching...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Punch & Print KOT</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )

  // Customer Directory Helper
  const getSavedCustomers = (): Record<string, { name: string; address?: string }> => {
    try {
      const stored = localStorage.getItem('kitchenos_pos_customers')
      const directory = stored ? JSON.parse(stored) : {}
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

  // Handle phone change & auto-complete
  const handlePhoneChange = async (val: string) => {
    setCustomerPhone(val)
    const digits = val.replace(/\D/g, '')

    if (digits.length >= 3) {
      const directory = getSavedCustomers()
      const localMatches = Object.entries(directory)
        .filter(([p]) => p.includes(digits))
        .map(([p, data]) => ({ phone: p, name: data.name, address: data.address }))

      if (localMatches.length > 0) {
        setCustomerSuggestions(localMatches.slice(0, 5))
        setShowSuggestions(true)
        const exactMatch = directory[digits]
        if (exactMatch) {
          if (exactMatch.name) setCustomerName(exactMatch.name)
          if (exactMatch.address) setCustomerAddress(exactMatch.address)
          setCustomerFoundBadge(true)
        } else {
          setCustomerFoundBadge(false)
        }
      }

      try {
        const res = await searchCustomersAction(digits)
        if (res.ok && res.data && res.data.length > 0) {
          setCustomerSuggestions(res.data.slice(0, 5))
          setShowSuggestions(true)
          if (!customerName) {
            const first = res.data[0]
            if (first.phone.replace(/\D/g, '') === digits) {
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

  // Active Brand & Filtered Dishes (Single Brand Scope)
  const currentBrand = brands.find((b) => b.id === selectedBrandId) || brands[0]

  const filteredDishes = useMemo(() => {
    return menuItems.filter((dish) => {
      const matchesBrand = dish.brandId === currentBrand?.id
      const matchesSearch = !searchQuery.trim() ||
        dish.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      const matchesStation = selectedStation === 'ALL' || dish.station === selectedStation
      return matchesBrand && matchesSearch && matchesStation
    })
  }, [menuItems, currentBrand, searchQuery, selectedStation])

  // Unique Stations for current brand
  const availableStations = useMemo(() => {
    const set = new Set<string>()
    menuItems.filter((d) => d.brandId === currentBrand?.id).forEach((d) => {
      if (d.station) set.add(d.station)
    })
    return Array.from(set)
  }, [menuItems, currentBrand])

  // Cart Operations
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

  // Financial Calculations
  const totalItemsCount = Object.values(cart).reduce((sum, q) => sum + q, 0)
  const cartSubtotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, q]) => {
      const item = menuItems.find((m) => m.id === id)
      return sum + (item ? item.sellingPrice * q : 0)
    }, 0)
  }, [cart, menuItems])

  const discountAmount = useMemo(() => {
    if (discountType === '5%') return Math.round(cartSubtotal * 0.05)
    if (discountType === '10%') return Math.round(cartSubtotal * 0.10)
    if (discountType === 'FLAT50') return Math.min(cartSubtotal, 50)
    if (discountType === 'CUSTOM') return Math.min(cartSubtotal, Number(customDiscountAmt) || 0)
    return 0
  }, [discountType, cartSubtotal, customDiscountAmt])

  const taxableAmount = Math.max(0, cartSubtotal - discountAmount)
  const gstAmount = applyGst ? Math.round(taxableAmount * 0.05) : 0
  const grandTotal = taxableAmount + gstAmount
  const changeToReturn = cashTendered ? Math.max(0, Number(cashTendered) - grandTotal) : 0

  // Auto-generate Dynamic UPI QR code when UPI payment is selected
  useEffect(() => {
    if (paymentMethod !== 'UPI' || grandTotal <= 0) return
    const upiUri = `upi://pay?pa=cuttack.orders@okaxis&pn=KitchenOS&am=${grandTotal}&cu=INR&tn=Bill`
    QRCodeLib.toDataURL(upiUri, { width: 140, margin: 1, color: { dark: '#09090b', light: '#ffffff' } })
      .then((url) => setUpiQrDataUrl(url))
      .catch(() => setUpiQrDataUrl(''))
  }, [paymentMethod, grandTotal])

  const primaryBrandId = currentBrand?.id || brands[0]?.id || ''
  const primaryBrand = currentBrand || brands[0]

  // Punch Order Handler
  const handlePunchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current || isSubmitting || totalItemsCount === 0) return
    isSubmittingRef.current = true
    setIsSubmitting(true)
    setValidationError('')

    // 1. Enforce Channel-Specific Form Guards
    if (channel === 'WALK_IN') {
      if (!customerName.trim()) {
        setValidationError('Customer Name or Token identifier is required for Counter Pickup.')
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }
      if (customerPhone.trim()) {
        const cleanDigits = customerPhone.replace(/\D/g, '')
        if (cleanDigits.length > 0 && cleanDigits.length < 10) {
          setValidationError('Please enter a valid 10-digit mobile number, or leave blank.')
          isSubmittingRef.current = false
          setIsSubmitting(false)
          return
        }
      }
    } else if (channel === 'DIRECT') {
      const cleanDigits = customerPhone.replace(/\D/g, '')
      if (cleanDigits.length < 10) {
        setValidationError('Valid 10-digit customer phone number is required for Fleet Delivery.')
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }
      if (!customerName.trim()) {
        setValidationError('Customer name is required for Fleet Delivery.')
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }
      if (!customerAddress.trim()) {
        setValidationError('Delivery address & landmark are required for Fleet Delivery.')
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }
    } else if (channel === 'SWIGGY' || channel === 'ZOMATO') {
      if (!aggregatorOrderId.trim()) {
        setValidationError(`Please enter the ${channel === 'SWIGGY' ? 'Swiggy' : 'Zomato'} Order ID #`)
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }
    }

    const items = Object.entries(cart).map(([menuItemId, quantity]) => ({
      menuItemId,
      quantity,
    }))

    // Save customer directory for future autocomplete
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

    // Determine resolved customer identifier based on channel
    let resolvedCustomerName = customerName.trim()
    if (channel === 'WALK_IN' && !resolvedCustomerName) {
      resolvedCustomerName = 'Counter Pickup'
    } else if (channel === 'SWIGGY') {
      resolvedCustomerName = `Swiggy #${aggregatorOrderId || 'Online'}`
    } else if (channel === 'ZOMATO') {
      resolvedCustomerName = `Zomato #${aggregatorOrderId || 'Online'}`
    }

    // Determine resolved payment method and status
    let resolvedPaymentMethod: PaymentMethod = paymentMethod
    let resolvedPaymentStatus: PaymentStatus = 'PAID'

    if (channel === 'SWIGGY' || channel === 'ZOMATO') {
      resolvedPaymentMethod = 'UPI'
      resolvedPaymentStatus = 'PAID'
    } else if (channel === 'DIRECT') {
      if (paymentMethod === 'COD' || paymentMethod === 'DUE') {
        resolvedPaymentStatus = 'PENDING'
      } else {
        resolvedPaymentStatus = 'PAID'
      }
    } else {
      // Counter takeaway
      if (paymentMethod === 'DUE') {
        resolvedPaymentStatus = 'PENDING'
      } else {
        resolvedPaymentStatus = 'PAID'
      }
    }

    // Generate permanent client UUID (for PostgreSQL PK) & instant token
    const tempOrderId = crypto.randomUUID()
    const prefix = channel === 'WALK_IN' ? 'POS' : channel === 'DIRECT' ? 'DIR' : 'ORD'
    const tempOrderNumber = `#${prefix}-${Math.floor(100 + Math.random() * 900)}`

    const finalOrder: Order = {
      id: tempOrderId,
      orderNumber: tempOrderNumber,
      channel,
      brandId: primaryBrandId,
      brandName: primaryBrand.name,
      customerName: resolvedCustomerName,
      customerPhone: customerPhone.trim() || (riderOtp ? `OTP: ${riderOtp}` : undefined),
      customerAddress: customerAddress.trim() || undefined,
      status: 'PREPARING',
      paymentMethod: resolvedPaymentMethod,
      paymentStatus: resolvedPaymentStatus,
      targetPrepMinutes: 12,
      createdAt: new Date().toISOString(),
      acknowledgedAt: new Date().toISOString(),
      items: items.map((it, idx) => {
        const mi = menuItems.find((m) => m.id === it.menuItemId);
        return {
          id: `item-${tempOrderId}-${idx}`,
          menuItemId: it.menuItemId,
          name: mi?.name || 'Item',
          station: mi?.station || 'GRILL',
          quantity: it.quantity,
          price: mi?.sellingPrice || 0,
          stationDone: false,
        };
      }),
      checklist: {
        cutlery: false,
        saucesDips: false,
        napkins: false,
        tamperSeal: false,
        beverageSeparated: false,
      },
      financials: {
        grossAmount: cartSubtotal,
        discount: 0,
        commissionRate: 0,
        commissionAmount: 0,
        taxes: 0,
        packagingFeeCollected: channel === 'WALK_IN' ? 0 : 25,
        ingredientCost: 0,
        packagingCost: channel === 'WALK_IN' ? 0 : 25,
        netMargin: cartSubtotal,
        netMarginPercentage: 100,
      },
    }

    // 1. Instantly open receipt & reset cart (0ms for the cashier - NO 30s wait!)
    setCompletedOrder(finalOrder)
    setIsReceiptOpen(true)
    setCart({})
    setCashTendered('')
    setAggregatorOrderId('')
    setRiderOtp('')

    const effectiveKitchenId = activeKitchenId && activeKitchenId !== 'ALL' && activeKitchenId !== 'all' && activeKitchenId !== 'default'
      ? activeKitchenId
      : (typeof window !== 'undefined' ? localStorage.getItem('kitchflow_active_kitchen_id') || undefined : undefined)

    finalOrder.kitchenId = effectiveKitchenId

    // 2. Punch order atomically into Zustand + IndexedDB outbox
    try {
      await useKitchenStore.getState().punchOrder(finalOrder)
    } catch (err) {
      console.error('Failed to punch order into local store:', err)
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24 lg:pb-6">
      {/* Top Header: Title & Back Navigation */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/orders"
            className="w-9 h-9 shrink-0 rounded-xl border border-border/80 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shadow-2xs"
            aria-label="Back to orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                Dispatch POS
              </h1>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 shrink-0">
                Multi-Brand
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
              Takeaway, Fleet Delivery & Aggregator Punch
            </p>
          </div>
        </div>

        {/* Floating Cart Trigger for Mobile */}
        <div className="lg:hidden shrink-0">
          <Button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="h-9 px-3 rounded-xl font-black text-xs gap-1.5 bg-primary text-primary-foreground shadow-2xs active:scale-95 transition-transform"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cart</span>
            {totalItemsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-primary text-[10px] font-black flex items-center justify-center">
                {totalItemsCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={handlePunchOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Menu Selector & Dispatch Details */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">

          {/* 1. Cloud Kitchen Channel Selector */}
          <div className="space-y-1.5 p-3.5 bg-card/90 rounded-2xl border border-border/80 shadow-2xs">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground block">
              1. Order Dispatch Channel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'WALK_IN' as Channel, label: 'Counter Pickup', sub: 'Takeaway Window', icon: Store, color: 'text-emerald-500' },
                { id: 'DIRECT' as Channel, label: 'Fleet Delivery', sub: 'Phone / WhatsApp', icon: Bike, color: 'text-blue-500' },
                { id: 'SWIGGY' as Channel, label: 'Swiggy Punch', sub: 'Prepaid Aggregator', icon: Sparkles, color: 'text-orange-500' },
                { id: 'ZOMATO' as Channel, label: 'Zomato Punch', sub: 'Prepaid Aggregator', icon: Utensils, color: 'text-red-500' },
              ].map((c) => {
                const Icon = c.icon
                const isSelected = channel === c.id
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background text-foreground border-border/80 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Icon className={cn("w-4 h-4", isSelected ? "text-white" : c.color)} />
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold block leading-tight">{c.label}</span>
                      <span className={cn("text-[9px] block", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {c.sub}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Dispatch Metadata Input */}
          <div className="p-3.5 bg-card/90 rounded-2xl border border-border/80 shadow-2xs space-y-2.5">
            {channel === 'WALK_IN' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">
                      Customer Name / Token <span className="text-red-500">*</span>
                    </label>
                    {/* Quick Token Presets */}
                    <div className="flex items-center gap-1">
                      {['Token #1', 'Token #2', 'Takeaway'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCustomerName(t)}
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-border/60 bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    placeholder="e.g. Rahul S or Token #1"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={cn(
                      "h-10 text-xs bg-background rounded-xl",
                      !customerName.trim() && totalItemsCount > 0 && "border-amber-500/50"
                    )}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block mb-1">
                    Phone Number (Optional for SMS / WhatsApp Bill)
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. 98765 43210 (10 digits)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-10 text-xs bg-background rounded-xl font-mono"
                  />
                </div>
              </div>
            )}

            {channel === 'DIRECT' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground flex items-center justify-between mb-1">
                      <span>Customer Phone <span className="text-red-500">*</span></span>
                      {customerFoundBadge && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          ✓ Repeat Customer
                        </Badge>
                      )}
                    </label>
                    <Input
                      type="tel"
                      placeholder="10-digit mobile (e.g. 9438019539)"
                      value={customerPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className={cn(
                        "h-10 text-xs bg-background rounded-xl font-mono",
                        customerPhone && customerPhone.replace(/\D/g, '').length < 10 && "border-amber-500 focus-visible:ring-amber-500"
                      )}
                    />

                    {/* Auto-suggest dropdown */}
                    {showSuggestions && customerSuggestions.length > 0 && (
                      <div className="absolute top-[102%] left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-xl p-1.5 space-y-1">
                        <div className="flex items-center justify-between px-2 py-0.5 border-b border-border/40">
                          <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                            Saved Customers
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowSuggestions(false)}
                            className="text-xs text-muted-foreground hover:text-foreground font-bold"
                          >
                            ✕
                          </button>
                        </div>
                        {customerSuggestions.map((cust, idx) => (
                          <button
                            key={cust.phone + idx}
                            type="button"
                            onClick={() => handleSelectCustomer(cust)}
                            className="w-full text-left p-2 rounded-lg hover:bg-muted text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-bold truncate">{cust.name}</span>
                            <span className="font-mono text-primary text-[11px] bg-primary/10 px-1.5 py-0.5 rounded">
                              {cust.phone}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Satyajit Pujapanda"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-10 text-xs bg-background rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block mb-1">
                    Delivery Address & Landmark <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Flat 302, Sai Tower, Link Road, Cuttack"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="h-10 text-xs bg-background rounded-xl"
                  />
                </div>
              </div>
            )}

            {(channel === 'SWIGGY' || channel === 'ZOMATO') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block mb-1">
                    {channel === 'SWIGGY' ? 'Swiggy' : 'Zomato'} Order ID # <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. 5482 or ORD-99201"
                    value={aggregatorOrderId}
                    onChange={(e) => setAggregatorOrderId(e.target.value)}
                    className="h-10 text-xs bg-background rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block mb-1">
                    Rider OTP / Pickup Code
                  </label>
                  <Input
                    placeholder="e.g. 8402"
                    value={riderOtp}
                    onChange={(e) => setRiderOtp(e.target.value)}
                    className="h-10 text-xs bg-background rounded-xl font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Multi-Brand Filter Bar & Dish Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground">
                2. Select Brand & Menu
              </label>

              {/* Station Filter */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedStation('ALL')}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all",
                    selectedStation === 'ALL' ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  All Stations
                </button>
                {availableStations.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStation(st)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all",
                      selectedStation === st ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Tabs (Strict Single Brand Selection) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {brands.map((b) => {
                const isSelected = selectedBrandId === b.id
                return (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => {
                      if (selectedBrandId !== b.id) {
                        setSelectedBrandId(b.id)
                        setCart({}) // Keep cart strictly scoped to the active brand
                      }
                    }}
                    className={cn(
                      "px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all border cursor-pointer flex items-center gap-2",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? '#ffffff' : (b.color || '#f97316') }}
                    />
                    <span>{b.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Dish Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search across all brand dishes (Biryani, Kebab, Wraps, Rolls...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs bg-card rounded-xl border-border"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 4. Dish Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredDishes.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-card/40">
                <Utensils className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No dishes found matching criteria</p>
              </div>
            ) : (
              filteredDishes.map((dish) => {
                const qtyInCart = cart[dish.id] || 0
                const brand = brands.find((b) => b.id === dish.brandId)
                return (
                  <div
                    key={dish.id}
                    className={cn(
                      "p-3 rounded-2xl border bg-card text-card-foreground flex flex-col justify-between transition-all shadow-2xs select-none min-h-[110px]",
                      qtyInCart > 0 ? "border-primary ring-1 ring-primary/20 bg-primary/[0.02]" : "border-border/80"
                    )}
                  >
                    <div
                      onClick={() => handleAddToCart(dish.id)}
                      className="space-y-1 cursor-pointer"
                    >
                      {/* Brand Tag */}
                      {brand && (
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: brand.color || '#f97316' }} />
                          <span className="truncate">{brand.name}</span>
                        </div>
                      )}

                      <h3 className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                        {dish.name}
                      </h3>
                      {dish.station && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/40 inline-block font-semibold">
                          {dish.station}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/40">
                      <span className="font-mono font-extrabold text-xs text-foreground">
                        {formatCurrency(dish.sellingPrice)}
                      </span>

                      {qtyInCart > 0 ? (
                        /* Apple Stepper Pill with Minus, Count & Plus */
                        <div className="flex items-center bg-primary text-primary-foreground rounded-xl shadow-xs overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(dish.id, -1)
                            }}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/15 active:scale-90 transition-transform"
                            aria-label={`Reduce ${dish.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-1 text-xs font-black font-mono min-w-[20px] text-center">
                            {qtyInCart}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddToCart(dish.id)
                            }}
                            className="w-7 h-7 flex items-center justify-center hover:bg-black/15 active:scale-90 transition-transform"
                            aria-label={`Add another ${dish.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(dish.id)}
                          className="w-8 h-8 rounded-xl border border-border/80 bg-background flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white hover:border-primary active:scale-90 transition-all shadow-2xs cursor-pointer"
                          aria-label={`Add ${dish.name}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Unified Cart & Smart Cloud Kitchen Checkout (Desktop Only) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 p-4 rounded-3xl bg-card border border-border shadow-md sticky top-16">
          {renderCartContent(false)}
        </div>
      </form>

      {/* Apple-Style Mobile Bottom Cart Bar (Thumb-Zone Floating Bar) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-background/85 backdrop-blur-xl border-t border-border/80 shadow-2xl safe-area-pb">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary relative">
              <ShoppingBag className="w-5 h-5" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground block leading-tight">
                {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-base font-black font-mono text-foreground leading-tight block">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setIsCartOpen(true)}
            disabled={totalItemsCount === 0}
            className="h-12 px-5 rounded-2xl font-black text-xs gap-2 bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform disabled:opacity-40"
          >
            <span>Review & Pay</span>
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Apple-Style Mobile Bottom Sheet Drawer for Cart & Checkout */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[88vh] overflow-y-auto px-4 pt-3 pb-8 bg-card border-t border-border/80 shadow-2xl focus:outline-none"
        >
          {/* iOS Grabber handle */}
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4" />

          <SheetHeader className="sr-only">
            <SheetTitle>Order Cart & Payment</SheetTitle>
          </SheetHeader>

          {renderCartContent(true)}
        </SheetContent>
      </Sheet>

      {/* Bill & Thermal Receipt Modal */}
      <BillReceiptModal
        order={completedOrder}
        open={isReceiptOpen}
        onOpenChange={setIsReceiptOpen}
        onDone={() => router.push('/orders')}
      />
    </div>
  )
}
