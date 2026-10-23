'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Order, OrderStatus } from '@/types'
import { formatCurrency, formatDuration, formatStationName, cn } from '@/lib/utils'
import { Plus, Info, ShoppingBag, Clock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

  // Live ticker for queue SLA countdown (client-side only after mount)
  React.useEffect(() => {
    setMounted(true)
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Helper to compute remaining SLA time
  const getOrderSLA = (order: Order) => {
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

  // Sort orders with the most at-risk (overdue or least remaining time) first
  const sortedOrders = [...orders].sort((a, b) => {
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
      {/* Top Banner / Metrics & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Live Order Dispatch Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time multi-brand routing and aggregator synchronization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pos">
            <Button
              variant="default"
              size="sm"
              className="text-xs h-9 gap-1.5 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>+ New Order (POS)</span>
            </Button>
          </Link>

          <Button
            onClick={onSimulateNewOrder}
            variant="outline"
            size="sm"
            className="text-xs h-9 gap-1.5 font-medium shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Simulate Order</span>
            <span className="sm:hidden">Simulate</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Count Badges */}
      <div className="flex items-center justify-between border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant={filter === 'ALL' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('ALL')}
            className="text-xs h-8 px-3 font-medium gap-1.5 shrink-0"
          >
            <span>All Orders</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none font-mono">
              {orders.length}
            </Badge>
          </Button>

          <Button
            variant={filter === 'ACTIVE' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('ACTIVE')}
            className="text-xs h-8 px-3 font-medium gap-1.5 shrink-0"
          >
            <span>Active Kitchen</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none font-mono">
              {activeOrdersCount}
            </Badge>
          </Button>

          <Button
            variant={filter === 'READY' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('READY')}
            className="text-xs h-8 px-3 font-medium gap-1.5 shrink-0"
          >
            <span>Ready for Rider</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none font-mono">
              {readyOrdersCount}
            </Badge>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 font-mono shrink-0 ml-4">
          <Clock className="w-3.5 h-3.5" />
          <span>Avg Cook: ~14m</span>
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
                  "overflow-hidden border-2 shadow-xs transition-colors flex flex-col justify-between",
                  sla.state === 'RED'
                    ? "border-red-500/80 bg-red-50/20 dark:bg-red-950/10"
                    : sla.state === 'AMBER'
                    ? "border-amber-500/80 bg-amber-50/20 dark:bg-amber-950/10"
                    : "border-border"
                )}
              >
                <div>
                  {/* Card Header with Live SLA Timer */}
                  <div className={cn(
                    "p-3.5 pb-3 flex items-start justify-between gap-2 border-b-2",
                    sla.state === 'RED' ? "bg-red-100/60 dark:bg-red-950/30 border-red-200" : sla.state === 'AMBER' ? "bg-amber-100/60 dark:bg-amber-950/30 border-amber-200" : "bg-muted/30 border-border/60"
                  )}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded text-white font-mono",
                          isSwiggy ? "bg-orange-600" : isZomato ? "bg-red-600" : "bg-neutral-800"
                        )}>
                          {order.channel}
                        </span>
                        <span className="font-extrabold text-foreground text-sm tracking-tight font-mono">
                          {order.orderNumber}
                        </span>
                        {/* Live SLA Urgency Pill */}
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 font-mono",
                          sla.state === 'RED' ? "bg-red-600 text-white font-black animate-pulse" : sla.state === 'AMBER' ? "bg-amber-500 text-black font-extrabold" : "bg-muted text-foreground/80"
                        )}>
                          <Clock className="w-3 h-3" />
                          <span>{sla.text}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-bold text-foreground">{order.brandName}</span>
                        <span className="text-foreground/80 font-medium">• {order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.2 rounded border border-border/60">
                            📞 {order.customerPhone}
                          </span>
                        )}
                        {order.customerAddress && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={order.customerAddress}>
                            📍 {order.customerAddress}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Distinctive High-Contrast Status Badges */}
                    <span
                      className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 border",
                        order.status === 'READY'
                          ? "bg-emerald-600 text-white border-emerald-700"
                          : order.status === 'PREPARING'
                          ? "bg-amber-500 text-black border-amber-600 font-black animate-pulse"
                          : order.status === 'ACCEPTED'
                          ? "bg-blue-600 text-white border-blue-700"
                          : "bg-muted text-foreground border-border"
                      )}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="p-4 space-y-2">
                    <div className="space-y-1.5">
                      {order.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-start justify-between text-xs py-1.5 px-2 rounded-md bg-muted/40 border border-border/40 gap-2"
                        >
                          <div className="flex items-start space-x-2 min-w-0 flex-1">
                            <span className="font-bold text-foreground font-mono text-xs shrink-0 mt-0.5">
                              {it.quantity}x
                            </span>
                            <span className="text-foreground/90 font-medium leading-snug break-words">
                              {it.name}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-semibold font-sans px-1.5 py-0 h-4 shrink-0 mt-0.5"
                          >
                            {formatStationName(it.station)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Controls & Financials */}
                <div className="p-4 pt-3 border-t border-border/60 bg-muted/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onInspectFinancials(order)}
                    className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left"
                  >
                    <Info className="w-3.5 h-3.5 text-muted-foreground/70" />
                    <span className="font-mono text-foreground font-semibold">
                      {formatCurrency(order.financials.netMargin)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({order.financials.netMarginPercentage}%)
                    </span>
                  </button>

                  <div className="flex items-center space-x-2 shrink-0">
                    {order.status === 'RECEIVED' && (
                      <Button
                        size="sm"
                        onClick={() => onUpdateStatus(order.id, 'ACCEPTED')}
                        className="text-xs h-8 px-3"
                      >
                        Accept
                      </Button>
                    )}
                    {order.status === 'ACCEPTED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onUpdateStatus(order.id, 'PREPARING')}
                        className="text-xs h-8 px-3"
                      >
                        Start Cook
                      </Button>
                    )}
                    {order.status === 'PREPARING' && (() => {
                      const allStationDone = order.items.every((it) => it.stationDone)
                      return (
                        <Button
                          size="sm"
                          disabled={!allStationDone}
                          onClick={() => onUpdateStatus(order.id, 'READY')}
                          className="text-xs h-8 px-3"
                          title={!allStationDone ? "Cooking in progress on KDS stations. Check off all items on KDS before marking ready." : "Mark order ready for dispatch"}
                        >
                          {allStationDone ? 'Mark Ready' : 'Cooking on KDS'}
                        </Button>
                      )
                    })()}
                    {order.status === 'READY' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(order.id, 'DISPATCHED')}
                        className="text-xs h-8 px-3"
                      >
                        Hand to Rider
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
