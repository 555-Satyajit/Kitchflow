'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Order, OrderStatus } from '@/types'
import { formatCurrency, formatDuration, formatStationName, cn } from '@/lib/utils'
import { Plus, Info, ShoppingBag, Clock, ArrowRight, CheckCircle2, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BillReceiptModal } from '@/components/pos/BillReceiptModal'

interface OrdersQueueViewProps {
  orders: Order[]
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void
  onInspectFinancials: (order: Order) => void
  onSimulateNewOrder: () => void
  onOpenManualOrder?: () => void
}

export function OrdersQueueView({
  orders,
  onUpdateStatus,
  onInspectFinancials,
  onSimulateNewOrder,
  onOpenManualOrder,
}: OrdersQueueViewProps) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'READY'>('ALL')
  const [now, setNow] = useState<number>(0)
  const [mounted, setMounted] = useState<boolean>(false)
  const [billingReceiptOrder, setBillingReceiptOrder] = useState<Order | null>(null)

  // Live ticker for queue SLA countdown (client-side only after mount)
  React.useEffect(() => {
    setMounted(true)
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Helper to compute remaining SLA time
  const getOrderSLA = (order: Order) => {
    // If order is completed, dispatched, or ready, SLA timer is fulfilled and should stop running
    if (order.status === 'DISPATCHED') {
      return {
        remainingSec: 9999,
        isOverdue: false,
        text: order.channel === 'DIRECT' ? 'OUT FOR DELIVERY' : 'HANDED TO RIDER',
        state: 'GREEN' as const,
      }
    }

    if (order.status === 'READY') {
      return {
        remainingSec: 9999,
        isOverdue: false,
        text: 'READY FOR PICKUP',
        state: 'GREEN' as const,
      }
    }

    if (order.status === 'CANCELLED') {
      return {
        remainingSec: 9999,
        isOverdue: false,
        text: 'CANCELLED',
        state: 'GRAY' as const,
      }
    }

    if (!mounted || now === 0) {
      return {
        remainingSec: (order.targetPrepMinutes || 14) * 60,
        isOverdue: false,
        text: `${order.targetPrepMinutes || 14}m 00s`,
        state: 'GREEN' as const,
      }
    }

    const created = new Date(order.createdAt).getTime()
    const targetMs = (order.targetPrepMinutes || 14) * 60 * 1000
    const elapsed = now - created
    const remainingSec = Math.floor((targetMs - elapsed) / 1000)
    const isOverdue = remainingSec < 0
    const absSec = Math.abs(remainingSec)
    const m = Math.floor(absSec / 60)
    const s = absSec % 60
    // Explicit "left" suffix for countdown, or "OVERDUE +Xm Xs" when timer reaches 0
    const text = isOverdue
      ? `OVERDUE +${m}m ${s < 10 ? '0' : ''}${s}s`
      : `${m}m ${s < 10 ? '0' : ''}${s}s left`

    return {
      remainingSec,
      isOverdue,
      text,
      state: isOverdue ? 'RED' : remainingSec <= 300 ? 'AMBER' : 'GREEN',
    }
  }

  // Deduplicate orders by order.id to guarantee unique keys across concurrent state updates
  const uniqueOrders = React.useMemo(() => {
    const seen = new Set<string>()
    return orders.filter((o) => {
      if (!o.id || seen.has(o.id)) return false
      seen.add(o.id)
      return true
    })
  }, [orders])

  // Sort orders with the most at-risk (overdue or least remaining time) first
  const sortedOrders = [...uniqueOrders].sort((a, b) => {
    const slaA = getOrderSLA(a).remainingSec
    const slaB = getOrderSLA(b).remainingSec
    return slaA - slaB
  })

  const activeOrdersCount = sortedOrders.filter(
    (o) => o.status === 'RECEIVED' || o.status === 'ACCEPTED' || o.status === 'PREPARING'
  ).length
  const readyOrdersCount = sortedOrders.filter((o) => o.status === 'READY').length

  const filteredOrders = sortedOrders.filter((o) => {
    if (filter === 'ACTIVE') return o.status === 'RECEIVED' || o.status === 'ACCEPTED' || o.status === 'PREPARING'
    if (filter === 'READY') return o.status === 'READY'
    return true
  })

  return (
    <div className="space-y-5">
      {/* Apple HIG Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Live Orders
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block mt-0.5">
            Real-time multi-brand routing and kitchen dispatch
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <Link href="/pos" className="w-full sm:w-auto">
            <Button
              variant="default"
              size="sm"
              className="w-full sm:w-auto h-10 px-4 gap-2 font-bold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-xl transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>New Order</span>
            </Button>
          </Link>

          <Button
            onClick={onSimulateNewOrder}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto h-10 px-4 gap-2 font-semibold shadow-2xs border-border/80 hover:bg-muted bg-background/50 rounded-xl transition-all active:scale-95 cursor-pointer text-foreground"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span>Simulate</span>
          </Button>
        </div>
      </div>

      {/* Apple HIG Segmented Control: Queue Filter & SLA Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div 
          role="tablist" 
          aria-label="Order status filter"
          className="flex items-center p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 shadow-xs w-full sm:w-auto"
        >
          <button
            role="tab"
            aria-selected={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[34px]",
              filter === 'ALL'
                ? "bg-card text-foreground shadow-xs border border-border/50 font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <span>All</span>
            <span
              className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full",
                filter === 'ALL'
                  ? "bg-muted text-foreground"
                  : "bg-muted/60 text-muted-foreground"
              )}
            >
              {orders.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={filter === 'ACTIVE'}
            onClick={() => setFilter('ACTIVE')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[34px]",
              filter === 'ACTIVE'
                ? "bg-card text-foreground shadow-xs border border-border/50 font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <span className="hidden xs:inline">Active</span>
            <span className="xs:hidden">Kitchen</span>
            <span
              className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full",
                filter === 'ACTIVE'
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                  : "bg-muted/60 text-muted-foreground"
              )}
            >
              {activeOrdersCount}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={filter === 'READY'}
            onClick={() => setFilter('READY')}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[34px]",
              filter === 'READY'
                ? "bg-card text-foreground shadow-xs border border-border/50 font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <span>Ready</span>
            <span
              className={cn(
                "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full",
                filter === 'READY'
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted/60 text-muted-foreground"
              )}
            >
              {readyOrdersCount}
            </span>
          </button>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2 font-mono shrink-0 px-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>Target Cook: ~14m</span>
          </span>
        </div>
      </div>

      {/* Orders Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground bg-card rounded-xl border border-dashed border-border p-8">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50 stroke-[1.5]" />
            <p className="text-sm font-semibold text-foreground">No orders in this queue</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Simulate incoming customer orders from Swiggy, Zomato or Direct Brand storefront to view live queue cards.
            </p>
            <Button
              onClick={onSimulateNewOrder}
              variant="outline"
              size="sm"
              className="mt-4 text-xs h-8"
            >
              Simulate First Order
            </Button>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isSwiggy = order.channel === 'SWIGGY'
            const isZomato = order.channel === 'ZOMATO'
            const sla = getOrderSLA(order)

            return (
              <Card 
                key={order.id} 
                className={cn(
                  "overflow-hidden border rounded-2xl shadow-xs transition-all flex flex-col justify-between bg-card",
                  sla.state === 'RED'
                    ? "border-red-500/70 ring-1 ring-red-500/20"
                    : sla.state === 'AMBER'
                    ? "border-amber-500/70 ring-1 ring-amber-500/20"
                    : "border-border/80"
                )}
              >
                <div>
                  {/* Apple HIG Card Header: Clean 2-column layout */}
                  <div className={cn(
                    "p-3.5 pb-3 flex items-start justify-between gap-3 border-b transition-colors",
                    sla.state === 'RED' 
                      ? "bg-red-500/10 border-red-200 dark:border-red-900/50" 
                      : sla.state === 'AMBER' 
                      ? "bg-amber-500/10 border-amber-200 dark:border-amber-900/50" 
                      : "bg-muted/30 border-border/60"
                  )}>
                    {/* Left: Channel, Order Number & Customer */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Compact Channel Tag */}
                        <span className={cn(
                          "text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md text-white font-mono shrink-0 shadow-2xs",
                          isSwiggy ? "bg-orange-600" : isZomato ? "bg-red-600" : "bg-neutral-800"
                        )}>
                          {order.channel}
                        </span>
                        <span className="font-extrabold text-foreground text-sm tracking-tight font-mono">
                          {order.orderNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="font-bold text-foreground">{order.brandName}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] font-medium">{order.customerName}</span>
                        {order.channel === 'DIRECT' && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                            Delivery
                          </span>
                        )}
                      </div>
                      {order.customerAddress && (
                        <p className="text-[11px] text-muted-foreground/80 truncate max-w-[220px]" title={order.customerAddress}>
                          📍 {order.customerAddress}
                        </p>
                      )}
                    </div>

                    {/* Right: Status Pill & SLA Countdown */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {/* Apple HIG Tinted Status Pill */}
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shadow-2xs",
                          order.status === 'READY'
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : order.status === 'PREPARING'
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-extrabold"
                            : order.status === 'ACCEPTED'
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                            : "bg-muted text-foreground/80 border-border"
                        )}
                      >
                        {order.status}
                      </span>

                      {/* Live SLA Countdown Pill */}
                      {order.status !== 'DISPATCHED' && order.status !== 'CANCELLED' ? (
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 font-mono",
                          sla.state === 'RED' 
                            ? "bg-red-600 text-white font-bold animate-pulse" 
                            : sla.state === 'AMBER' 
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold" 
                            : "text-muted-foreground bg-muted/60"
                        )}>
                          <Clock className="w-2.5 h-2.5" />
                          <span>{sla.text}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 font-mono text-muted-foreground bg-muted/40">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                          <span>Fulfilled</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Items: Clean borderless list rows */}
                  <div className="p-3.5 py-2.5 divide-y divide-border/40">
                    {order.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-2 gap-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <span className="font-bold text-foreground font-mono text-xs shrink-0 w-6 text-center py-0.5 rounded-md bg-muted/60">
                            {it.quantity}x
                          </span>
                          <span className="text-foreground/90 font-medium leading-snug break-words">
                            {it.name}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-medium px-2 py-0.5 h-5 shrink-0 bg-muted/30 border-border/70 text-muted-foreground"
                        >
                          {formatStationName(it.station)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls & Financials */}
                <div className="p-3 border-t border-border/60 bg-muted/15 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onInspectFinancials(order)}
                    className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left py-1 px-1.5 rounded-lg hover:bg-muted/50 -ml-1"
                    title="Click to inspect unit economics, taxes, and aggregator commissions"
                  >
                    <Info className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span className="font-mono text-foreground font-bold">
                      {formatCurrency(order.financials.netMargin)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      ({order.financials.netMarginPercentage}%)
                    </span>
                  </button>

                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Bill Receipt & WhatsApp Share Button */}
                    <button
                      type="button"
                      onClick={() => setBillingReceiptOrder(order)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
                      title="View Tax Invoice & Send on WhatsApp"
                      aria-label="View Tax Invoice"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {order.status === 'RECEIVED' && (
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(order.id, 'ACCEPTED')}
                        className="text-xs h-8 px-3.5 font-bold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-lg"
                      >
                        Accept
                      </Button>
                    )}

                    {order.status === 'ACCEPTED' && (
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(order.id, 'PREPARING')}
                        className="text-xs h-8 px-3.5 font-bold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-lg"
                      >
                        Start Cook
                      </Button>
                    )}

                    {order.status === 'PREPARING' && (() => {
                      const allStationDone = order.items.every((it) => it.stationDone)
                      return allStationDone ? (
                        <Button
                          size="sm"
                          onClick={() => onUpdateStatus(order.id, 'READY')}
                          className="text-xs h-8 px-3.5 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer rounded-lg"
                        >
                          Mark Ready
                        </Button>
                      ) : (
                        <div 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-semibold shadow-2xs"
                          title="Cooking in progress on station KDS displays"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Cooking on KDS</span>
                        </div>
                      )
                    })()}

                    {order.status === 'READY' && (
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(order.id, 'DISPATCHED')}
                        className="text-xs h-8 px-3.5 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer rounded-lg"
                      >
                        {order.channel === 'DIRECT' ? 'Out for Delivery' : 'Hand to Rider'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Bill & WhatsApp Receipt Dialog */}
      <BillReceiptModal
        order={billingReceiptOrder}
        open={Boolean(billingReceiptOrder)}
        onOpenChange={(open) => {
          if (!open) setBillingReceiptOrder(null)
        }}
      />
    </div>
  )
}
