'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Bike, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  ChevronLeft, 
  Search, 
  X,
  PackageCheck,
  Flame,
  ArrowRight,
  AlertTriangle
} from 'lucide-react'
import { useKitchen } from '@/context/KitchenContext'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Order } from '@/types'

interface DeliveryPortalClientProps {
  initialOrders: Order[]
  kitchenId?: string
}

export function DeliveryPortalClient({ initialOrders }: DeliveryPortalClientProps) {
  const { orders, setOrders, handleUpdateStatus } = useKitchen()
  const [filterTab, setFilterTab] = useState<'PENDING' | 'DISPATCHED' | 'ALL'>('PENDING')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDriver] = useState<string>('Raju (Runner #1)')

  // Sync initial server-rendered orders from PostgreSQL into state on load
  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders((prev) => {
        // Merge so we don't wipe out any new in-memory orders
        const existingIds = new Set(prev.map((o) => o.id))
        const merged = [...prev]
        for (const o of initialOrders) {
          if (!existingIds.has(o.id)) {
            merged.push(o)
          } else {
            // Keep DB status as authoritative
            const idx = merged.findIndex((m) => m.id === o.id)
            if (idx !== -1) merged[idx] = o
          }
        }
        return merged
      })
    }
  }, [initialOrders, setOrders])

  // Filter orders relevant for in-house delivery riders (our DIRECT delivery orders only)
  const deliveryOrders = orders.filter((o) => {
    if (o.channel !== 'DIRECT') return false

    if (filterTab === 'PENDING') {
      return o.status === 'READY' || o.status === 'PREPARING' || o.status === 'ACCEPTED'
    }
    if (filterTab === 'DISPATCHED') {
      return o.status === 'DISPATCHED'
    }
    return true
  }).filter((o) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.customerAddress && o.customerAddress.toLowerCase().includes(q))
    )
  })

  const pendingCount = orders.filter((o) => o.channel === 'DIRECT' && (o.status === 'READY' || o.status === 'PREPARING' || o.status === 'ACCEPTED')).length
  const completedTodayCount = orders.filter((o) => o.channel === 'DIRECT' && o.status === 'DISPATCHED').length

  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null)

  const handlePromptDeliver = (order: Order) => {
    setConfirmingOrder(order)
  }

  const handleConfirmDeliver = () => {
    if (!confirmingOrder) return
    handleUpdateStatus(confirmingOrder.id, 'DISPATCHED')
    setConfirmingOrder(null)
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24 p-4 animate-in fade-in duration-150">
      {/* iOS Styled Navigation Subheader */}
      <div className="flex items-center justify-between py-1">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all"
        >
          <ChevronLeft className="w-4 h-4 text-primary" />
          <span>Kitchen Queue</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Badge 
            variant="outline" 
            className="text-[11px] font-medium py-1 px-2.5 gap-1.5 rounded-full border-border/80 bg-card/80 backdrop-blur-md shadow-2xs font-mono"
          >
            <Bike className="w-3.5 h-3.5 text-primary" />
            <span>Delivery Hub</span>
          </Badge>
        </div>
      </div>

      {/* Driver Status Inset Card */}
      <div className="p-3.5 rounded-2xl bg-card/90 border border-border/80 backdrop-blur-md shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase font-mono block">
              Active Rider
            </span>
            <span className="text-sm font-bold text-foreground">
              {activeDriver}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase font-mono block">
            Completed Shift
          </span>
          <Badge 
            variant="outline" 
            className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-lg"
          >
            {completedTodayCount} Delivered
          </Badge>
        </div>
      </div>

      {/* Segmented Tab Control (Apple Inset Style) */}
      <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-2xl border border-border/60 text-xs font-semibold shadow-2xs">
        <button
          type="button"
          onClick={() => setFilterTab('PENDING')}
          className={cn(
            "h-9 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
            filterTab === 'PENDING' 
              ? "bg-background text-foreground shadow-sm font-bold" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>To Deliver</span>
          {pendingCount > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('DISPATCHED')}
          className={cn(
            "h-9 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
            filterTab === 'DISPATCHED' 
              ? "bg-background text-foreground shadow-sm font-bold" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Delivered</span>
          {completedTodayCount > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">({completedTodayCount})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={cn(
            "h-9 rounded-xl transition-all cursor-pointer text-center active:scale-[0.98]",
            filterTab === 'ALL' 
              ? "bg-background text-foreground shadow-sm font-bold" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All Runs
        </button>
      </div>

      {/* iOS Ergonomic Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by order #, customer, phone, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-9 pr-8 text-xs rounded-xl border border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:ring-2 focus:ring-primary/20 shadow-2xs transition-all"
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

      {/* Delivery Orders List */}
      <div className="space-y-3.5">
        {deliveryOrders.length === 0 ? (
          <div className="p-10 rounded-3xl border border-dashed border-border/80 text-center space-y-2 bg-muted/20">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground/60">
              <Bike className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-foreground">No orders in this queue</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {filterTab === 'PENDING' 
                ? 'All delivery orders have been handed over to riders or marked delivered.' 
                : 'No delivery history matching your search query.'}
            </p>
          </div>
        ) : (
          deliveryOrders.map((order) => {
            const isReady = order.status === 'READY'
            const isDispatched = order.status === 'DISPATCHED'

            return (
              <div 
                key={order.id} 
                className={cn(
                  "p-4 rounded-2xl border space-y-3.5 transition-all bg-card/90 backdrop-blur-md shadow-2xs",
                  isReady 
                    ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card to-card ring-1 ring-emerald-500/20" 
                    : "border-border/80"
                )}
              >
                {/* Header: Order Number, Channel Badge & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-foreground tracking-tight">
                      {order.orderNumber}
                    </span>
                    <Badge 
                      className="text-[9px] font-bold uppercase font-mono px-2 py-0.5 border-none bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    >
                      DIRECT DELIVERY
                    </Badge>
                  </div>

                  <Badge 
                    className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border-none flex items-center gap-1",
                      isDispatched ? "bg-muted text-muted-foreground" :
                      isReady ? "bg-emerald-500 text-white shadow-xs animate-pulse" :
                      "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>DELIVERED</span>
                      </>
                    ) : isReady ? (
                      <>
                        <PackageCheck className="w-3 h-3" />
                        <span>PACKED & READY</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-3 h-3 text-amber-500" />
                        <span>COOKING</span>
                      </>
                    )}
                  </Badge>
                </div>

                {/* Customer Details & Tactile Action Buttons */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-xs">{order.customerName}</span>
                    <Badge variant="outline" className="text-[10px] font-medium font-mono text-muted-foreground bg-background/50">
                      {order.brandName}
                    </Badge>
                  </div>

                  {/* Contact & Map Quick Action Pills */}
                  {(order.customerPhone || order.customerAddress) && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-background border border-border/80 text-[11px] font-semibold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all shadow-2xs"
                        >
                          <Phone className="w-3 h-3 text-primary" />
                          <span>Call {order.customerPhone}</span>
                        </a>
                      )}

                      {order.customerAddress && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-background border border-border/80 text-[11px] font-semibold text-foreground hover:text-primary active:scale-[0.98] transition-all shadow-2xs"
                        >
                          <MapPin className="w-3 h-3 text-red-500" />
                          <span>Open Maps</span>
                        </a>
                      )}
                    </div>
                  )}

                  {order.customerAddress && (
                    <p className="text-[11px] text-muted-foreground leading-snug pt-0.5">
                      {order.customerAddress}
                    </p>
                  )}
                </div>

                {/* Ordered Items Summary */}
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <span className="font-semibold uppercase tracking-wider text-[9px] font-mono block text-muted-foreground/80">
                    Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
                  </span>
                  <p className="line-clamp-2 text-foreground/80 font-medium">
                    {order.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                  </p>
                </div>

                {/* 44px Ergonomic Delivery Action Button */}
                {!isDispatched && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      onClick={() => handlePromptDeliver(order)}
                      className={cn(
                        "w-full h-11 text-xs font-bold gap-2 rounded-xl cursor-pointer active:scale-[0.98] transition-all shadow-sm",
                        isReady 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20" 
                          : "bg-background border border-border hover:bg-muted text-foreground"
                      )}
                    >
                      <CheckCircle2 className={cn("w-4 h-4", isReady ? "text-white" : "text-primary")} />
                      <span>{isReady ? 'Mark Delivered to Customer' : 'Mark Delivered (Early Override)'}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Delivery Confirmation Dialog (Acknowledgment Gate) */}
      <Dialog open={!!confirmingOrder} onOpenChange={(open) => !open && setConfirmingOrder(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-5 border border-border/80 shadow-2xl bg-card">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-foreground">
              Confirm Delivery Completion
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Confirm that order{' '}
              <strong className="font-mono text-foreground">{confirmingOrder?.orderNumber}</strong> has been successfully handed over to customer{' '}
              <strong className="text-foreground">{confirmingOrder?.customerName}</strong>?
            </DialogDescription>
          </DialogHeader>

          {confirmingOrder && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5 my-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-[11px]">Brand:</span>
                <span className="font-bold text-foreground">{confirmingOrder.brandName}</span>
              </div>
              {confirmingOrder.customerAddress && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-[11px] shrink-0">Address:</span>
                  <span className="font-medium text-foreground text-right text-[11px] truncate max-w-[200px]">
                    📍 {confirmingOrder.customerAddress}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-border/40">
                <span className="text-muted-foreground text-[11px]">Amount:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{confirmingOrder.financials.grossAmount} ({confirmingOrder.paymentMethod} - {confirmingOrder.paymentStatus})
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 mt-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingOrder(null)}
              className="w-full text-xs h-10 rounded-xl border-border/80 hover:bg-muted font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeliver}
              className="w-full text-xs h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Yes, Delivered</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
