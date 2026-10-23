'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  Bike, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  Search, 
  PackageCheck,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Navigation
} from 'lucide-react'
import { useKitchen } from '@/context/KitchenContext'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export default function DeliveryPortalPage() {
  const { orders, handleUpdateStatus } = useKitchen()
  const [filterTab, setFilterTab] = useState<'PENDING' | 'DISPATCHED' | 'ALL'>('PENDING')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDriver, setActiveDriver] = useState<string>('Raju (Runner #1)')

  // Filter orders relevant for delivery (DIRECT phone deliveries or platform rider pickups)
  const deliveryOrders = orders.filter((o) => {
    // Both Direct phone deliveries and Swiggy/Zomato rider pickups
    const isDelivery = o.channel === 'DIRECT' || o.channel === 'SWIGGY' || o.channel === 'ZOMATO'
    if (!isDelivery) return false

    if (filterTab === 'PENDING') {
      return o.status === 'READY' || o.status === 'PREPARING'
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

  const pendingCount = orders.filter((o) => (o.channel === 'DIRECT' || o.channel === 'SWIGGY' || o.channel === 'ZOMATO') && (o.status === 'READY' || o.status === 'PREPARING')).length
  const completedTodayCount = orders.filter((o) => (o.channel === 'DIRECT' || o.channel === 'SWIGGY' || o.channel === 'ZOMATO') && o.status === 'DISPATCHED').length

  const handleMarkDelivered = (orderId: string) => {
    handleUpdateStatus(orderId, 'DISPATCHED')
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between py-1 border-b border-border/60 pb-3">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kitchen Live Queue</span>
        </Link>
        <Badge variant="outline" className="font-mono text-xs gap-1 border-primary/30 text-primary bg-primary/10">
          <Bike className="w-3.5 h-3.5" />
          <span>Delivery Portal</span>
        </Badge>
      </div>

      {/* Driver Switcher Bar */}
      <div className="p-3 rounded-xl bg-card border border-border shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
            🚴
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">Active Rider</span>
            <span className="text-xs font-extrabold text-foreground">{activeDriver}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">Dispatched Today</span>
            <span className="text-xs font-black font-mono text-emerald-600">{completedTodayCount} Delivered</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-muted/80 p-0.5 rounded-lg border border-border text-xs font-bold">
        <button
          type="button"
          onClick={() => setFilterTab('PENDING')}
          className={cn(
            "py-1.5 rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-1",
            filterTab === 'PENDING' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
          )}
        >
          <span>To Pick / Deliver</span>
          {pendingCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('DISPATCHED')}
          className={cn(
            "py-1.5 rounded-md transition-all cursor-pointer text-center",
            filterTab === 'DISPATCHED' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
          )}
        >
          Delivered ({completedTodayCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={cn(
            "py-1.5 rounded-md transition-all cursor-pointer text-center",
            filterTab === 'ALL' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
          )}
        >
          All Runs
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by order #, customer name, phone, or flat address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-xs bg-background"
        />
      </div>

      {/* Order Cards List */}
      <div className="space-y-3">
        {deliveryOrders.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-1 bg-muted/20">
            <Bike className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <p className="text-xs font-semibold text-foreground">No orders in this queue</p>
            <p className="text-[11px] text-muted-foreground">
              {filterTab === 'PENDING' 
                ? 'All delivery orders have been handed over or delivered.' 
                : 'No delivery history found matching the query.'}
            </p>
          </div>
        ) : (
          deliveryOrders.map((order) => {
            const isReady = order.status === 'READY'
            const isDispatched = order.status === 'DISPATCHED'
            const isDirectPhone = order.channel === 'DIRECT'

            return (
              <div 
                key={order.id} 
                className={cn(
                  "p-3.5 rounded-xl border space-y-3 transition-all bg-card shadow-2xs",
                  isReady ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-border"
                )}
              >
                {/* Header: Order Number, Channel Badge & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs text-foreground">
                      {order.orderNumber}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[9px] font-bold uppercase font-mono px-1.5 h-4.5",
                        order.channel === 'DIRECT' ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                        order.channel === 'SWIGGY' ? "bg-orange-500/10 text-orange-600 border-orange-500/30" :
                        "bg-red-500/10 text-red-600 border-red-500/30"
                      )}
                    >
                      {order.channel}
                    </Badge>
                  </div>

                  <Badge 
                    className={cn(
                      "text-[10px] font-mono font-bold h-5 px-2",
                      isDispatched ? "bg-muted text-muted-foreground" :
                      isReady ? "bg-emerald-600 text-white animate-pulse" :
                      "bg-amber-500 text-white"
                    )}
                  >
                    {isDispatched ? 'DELIVERED' : isReady ? 'PACKED & READY' : 'COOKING'}
                  </Badge>
                </div>

                {/* Customer Details */}
                <div className="space-y-1.5 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-foreground">{order.customerName}</span>
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">{order.brandName}</span>
                  </div>

                  {/* Phone Call Button */}
                  {order.customerPhone && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-muted-foreground flex items-center gap-1 text-[11px]">
                        <Phone className="w-3 h-3 text-primary" />
                        <span>{order.customerPhone}</span>
                      </span>
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        Call Customer
                      </a>
                    </div>
                  )}

                  {/* Delivery Address & Maps Link */}
                  {order.customerAddress && (
                    <div className="flex items-start justify-between pt-1 border-t border-border/40 gap-2">
                      <div className="flex items-start gap-1 text-[11px] text-foreground">
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        <span>{order.customerAddress}</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary shrink-0 hover:underline"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Maps</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Ordered Items Summary */}
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <span className="font-bold uppercase tracking-wider text-[9px] font-mono block text-muted-foreground/80">
                    Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
                  </span>
                  <p className="line-clamp-2">
                    {order.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                  </p>
                </div>

                {/* Delivery Action Button */}
                {!isDispatched && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      onClick={() => handleMarkDelivered(order.id)}
                      className={cn(
                        "w-full h-9 text-xs font-black gap-1.5 cursor-pointer shadow-xs",
                        isReady 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isReady ? 'Mark Handed Over / Delivered' : 'Mark Delivered (Ready Early)'}</span>
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
