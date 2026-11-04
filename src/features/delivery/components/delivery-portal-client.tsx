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
  AlertTriangle,
  Loader2
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
import { useKitchenStore, selectDeliveryOrders } from '@/stores/useKitchenStore'
import { useShallow } from 'zustand/react/shallow'
import { markDeliveryCompletedAction, markDeliveryFailedAction } from '../delivery-actions'

interface DeliveryPortalClientProps {
  initialOrders: Order[]
  kitchenId?: string
}

export function DeliveryPortalClient({ initialOrders, kitchenId }: DeliveryPortalClientProps) {
  const storeOrders = useKitchenStore(useShallow(selectDeliveryOrders))
  const setBulkOrders = useKitchenStore((s) => s.setBulkOrders)

  React.useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setBulkOrders(initialOrders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const liveOrders = React.useMemo(() => {
    return storeOrders.filter((o) => {
      return !kitchenId || kitchenId === 'all' || !o.kitchenId || o.kitchenId === kitchenId
    })
  }, [storeOrders, kitchenId])

  // Default to DISPATCHED tab so orders sealed from Dispatch Station appear here immediately
  const [filterTab, setFilterTab] = useState<'DISPATCHED' | 'DELIVERED' | 'ALL'>('DISPATCHED')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDriver] = useState<string>('Raju (Runner #1)')

  // Filter orders relevant for in-house delivery riders (our DIRECT delivery orders only)
  const deliveryOrders = liveOrders.filter((o) => {
    if (o.channel !== 'DIRECT') return false

    // "Dispatched / On the Road": active delivery orders currently with the runner that haven't been completed or cancelled yet
    if (filterTab === 'DISPATCHED') {
      return o.status === 'DISPATCHED' && !o.deliveredAt && !o.undeliveredAt
    }
    // "Completed / History": orders marked delivered or reported undelivered
    if (filterTab === 'DELIVERED') {
      return !!o.deliveredAt || !!o.undeliveredAt
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

  const dispatchedActiveCount = liveOrders.filter((o) => o.channel === 'DIRECT' && o.status === 'DISPATCHED' && !o.deliveredAt && !o.undeliveredAt).length
  const deliveredCount = liveOrders.filter((o) => o.channel === 'DIRECT' && (!!o.deliveredAt || !!o.undeliveredAt)).length

  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null)
  const [undeliveredOrder, setUndeliveredOrder] = useState<Order | null>(null)
  const [failReason, setFailReason] = useState<string>('Customer Unreachable / Phone Switched Off')
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isMarkingDelivered = !!loadingOrderId
  const isMarkingUndelivered = !!loadingOrderId

  const handlePromptDeliver = (order: Order) => {
    setConfirmingOrder(order)
  }

  const handleConfirmDeliver = async () => {
    if (!confirmingOrder) return
    const orderToComplete = confirmingOrder
    setLoadingOrderId(orderToComplete.id)
    setConfirmingOrder(null)

    // 1. 0ms instant local optimistic update in Zustand
    useKitchenStore.setState((state) => {
      const existing = state.orders[orderToComplete.id]
      if (!existing) return state
      return {
        orders: {
          ...state.orders,
          [orderToComplete.id]: {
            ...existing,
            status: 'DISPATCHED',
            deliveredAt: new Date().toISOString(),
            paymentStatus: 'PAID',
          },
        },
      }
    })

    // 2. Persist to server
    try {
      const res = await markDeliveryCompletedAction({
        orderId: orderToComplete.id,
        kitchenId: kitchenId !== 'ALL' ? kitchenId : undefined,
      })
      if (!res.ok) throw new Error(res.error || 'Failed to complete delivery')

      setActionFeedback({
        message: `Order #${orderToComplete.orderNumber} successfully marked as Delivered!`,
        type: 'success',
      })
      setTimeout(() => setActionFeedback(null), 4000)
    } catch (err: any) {
      setActionFeedback({
        message: err?.message || 'Failed to complete delivery',
        type: 'error',
      })
      setTimeout(() => setActionFeedback(null), 5000)
    } finally {
      setLoadingOrderId(null)
    }
  }

  const handlePromptUndelivered = (order: Order) => {
    setUndeliveredOrder(order)
  }

  const handleConfirmUndelivered = async () => {
    if (!undeliveredOrder) return
    const orderToFail = undeliveredOrder
    const reasonToFail = failReason
    setLoadingOrderId(orderToFail.id)
    setUndeliveredOrder(null)

    // 1. 0ms instant local optimistic update in Zustand
    useKitchenStore.setState((state) => {
      const existing = state.orders[orderToFail.id]
      if (!existing) return state
      return {
        orders: {
          ...state.orders,
          [orderToFail.id]: {
            ...existing,
            status: 'CANCELLED',
            undeliveredAt: new Date().toISOString(),
            undeliveredReason: reasonToFail,
          },
        },
      }
    })

    // 2. Persist to server
    try {
      const res = await markDeliveryFailedAction({
        orderId: orderToFail.id,
        reason: reasonToFail,
        kitchenId: kitchenId !== 'ALL' ? kitchenId : undefined,
      })
      if (!res.ok) throw new Error(res.error || 'Failed to update order status')

      setActionFeedback({
        message: `Order #${orderToFail.orderNumber} marked as Undelivered / Issue.`,
        type: 'success',
      })
      setTimeout(() => setActionFeedback(null), 4000)
    } catch (err: any) {
      setActionFeedback({
        message: err?.message || 'Failed to update order status',
        type: 'error',
      })
      setTimeout(() => setActionFeedback(null), 5000)
    } finally {
      setLoadingOrderId(null)
    }
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

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          className={cn(
            "p-3 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-xs transition-all animate-in fade-in slide-in-from-top-2",
            actionFeedback.type === 'success'
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold"
              : "bg-red-500/15 border-red-500/30 text-red-800 dark:text-red-300 font-semibold"
          )}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="w-5 h-5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            Active Runs
          </span>
          <Badge 
            variant="outline" 
            className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-lg"
          >
            {dispatchedActiveCount} On Road
          </Badge>
        </div>
      </div>

      {/* Segmented Tab Control (Apple Inset Style) */}
      <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-2xl border border-border/60 text-xs font-semibold shadow-2xs">
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
          <span>To Deliver</span>
          {dispatchedActiveCount > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
              {dispatchedActiveCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('DELIVERED')}
          className={cn(
            "h-9 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98]",
            filterTab === 'DELIVERED' 
              ? "bg-background text-foreground shadow-sm font-bold" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Completed</span>
          {deliveredCount > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">({deliveredCount})</span>
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
              {filterTab === 'DISPATCHED' 
                ? 'No active orders currently out for delivery.' 
                : filterTab === 'DELIVERED'
                ? 'No completed delivery runs recorded today.'
                : 'No delivery history matching your search query.'}
            </p>
          </div>
        ) : (
          deliveryOrders.map((order) => {
            const isReady = order.status === 'READY'
            const isCooking = order.status === 'PREPARING' || order.status === 'ACCEPTED' || order.status === 'RECEIVED'
            const isDispatched = order.status === 'DISPATCHED' && !order.deliveredAt && !order.undeliveredAt
            const isDelivered = !!order.deliveredAt
            const isUndelivered = !!order.undeliveredAt

            return (
              <div 
                key={order.id} 
                className={cn(
                  "p-4 rounded-2xl border space-y-3.5 transition-all bg-card/90 backdrop-blur-md shadow-2xs",
                  isDelivered
                    ? "border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/10"
                    : isUndelivered
                    ? "border-red-500/30 bg-red-500/5 ring-1 ring-red-500/10"
                    : isDispatched
                    ? "border-blue-500/30 bg-blue-500/5 ring-1 ring-blue-500/10"
                    : isReady 
                    ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card to-card ring-1 ring-emerald-500/20" 
                    : "border-border/80"
                )}
              >
                {/* Header: Order Number, Channel Badge & Status */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono font-extrabold text-xs sm:text-sm text-foreground tracking-tight whitespace-nowrap">
                      {order.orderNumber}
                    </span>
                    <Badge 
                      className="text-[8px] sm:text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 border-none bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0"
                    >
                      DIRECT
                    </Badge>
                  </div>

                  <Badge 
                    className={cn(
                      "text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border-none flex items-center gap-1 shrink-0 whitespace-nowrap",
                      isDelivered ? "bg-emerald-600 text-white shadow-xs" :
                      isUndelivered ? "bg-red-600 text-white shadow-xs" :
                      isDispatched ? "bg-blue-600 text-white shadow-xs" :
                      isReady ? "bg-emerald-500 text-white shadow-xs animate-pulse" :
                      "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {isDelivered ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
                        <span>DELIVERED</span>
                      </>
                    ) : isUndelivered ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-white shrink-0" />
                        <span>FAILED / RETURNED</span>
                      </>
                    ) : isDispatched ? (
                      <>
                        <Bike className="w-3 h-3 text-white shrink-0" />
                        <span>OUT FOR DELIVERY</span>
                      </>
                    ) : isReady ? (
                      <>
                        <PackageCheck className="w-3 h-3 shrink-0" />
                        <span>PACKED & READY</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-3 h-3 text-amber-500 shrink-0" />
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

                {/* Delivered or Undelivered Status Badges & Action Buttons */}
                {isDelivered && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-medium">
                    <span className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Delivered to Customer
                    </span>
                    {order.deliveredAt && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}

                {isUndelivered && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs space-y-1 text-red-800 dark:text-red-300">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        Delivery Returned / Failed
                      </span>
                      {order.undeliveredAt && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(order.undeliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {order.undeliveredReason && (
                      <p className="text-[11px] text-red-700 dark:text-red-300 font-mono">
                        Reason: {order.undeliveredReason}
                      </p>
                    )}
                  </div>
                )}

                {/* 44px Ergonomic Delivery Action Buttons (Only shown for active Dispatched runs) */}
                {isDispatched && (
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={() => handlePromptDeliver(order)}
                      disabled={isMarkingDelivered && loadingOrderId === order.id}
                      className="w-full h-11 text-xs font-bold gap-2 rounded-xl cursor-pointer active:scale-[0.98] transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      {isMarkingDelivered && loadingOrderId === order.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                      <span>Delivered Successfully</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handlePromptUndelivered(order)}
                      disabled={isMarkingUndelivered && loadingOrderId === order.id}
                      className="w-full h-11 text-xs font-bold gap-2 rounded-xl cursor-pointer active:scale-[0.98] transition-all border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    >
                      {isMarkingUndelivered && loadingOrderId === order.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span>Not Delivered / Issue</span>
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
                  ₹{confirmingOrder?.financials?.grossAmount ?? 0} ({confirmingOrder?.paymentMethod ?? 'COD'} - {confirmingOrder?.paymentStatus ?? 'PENDING'})
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

      {/* Undelivered / Issue Reason Dialog */}
      <Dialog open={!!undeliveredOrder} onOpenChange={(open) => !open && setUndeliveredOrder(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-5 border border-border/80 shadow-2xl bg-card">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-500/20 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-foreground">
              Report Delivery Issue
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Specify why order <strong className="font-mono text-foreground">{undeliveredOrder?.orderNumber}</strong> could not be delivered to <strong className="text-foreground">{undeliveredOrder?.customerName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 my-2">
            <label className="text-[10px] font-mono font-bold uppercase text-muted-foreground block">
              Select Reason:
            </label>
            {[
              'Customer Unreachable / Phone Switched Off',
              'Customer Refused / Cancelled at Doorstep',
              'Incorrect / Incomplete Address',
              'Customer Not Available at Location',
              'Payment / Cash Issue (Refused to Pay)',
              'Accident / Vehicle Breakdown',
            ].map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setFailReason(r)}
                className={cn(
                  "w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer",
                  failReason === r 
                    ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400 font-bold" 
                    : "bg-background border-border hover:bg-muted text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 mt-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUndeliveredOrder(null)}
              className="w-full text-xs h-10 rounded-xl border-border/80 hover:bg-muted font-semibold"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleConfirmUndelivered}
              disabled={isMarkingUndelivered}
              className="w-full text-xs h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs cursor-pointer"
            >
              <span>Submit & Return</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
