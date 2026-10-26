'use client'

import React, { useState, useEffect } from 'react'
import { Order, Station } from '@/types'
import { Flame, Clock, CheckCircle2, Layers, Check, Bell, BellRing, Volume2, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatStationName } from '@/lib/utils'
import { useKitchen } from '@/context/KitchenContext'

interface KDSViewProps {
  orders: Order[]
  configuredStations?: Station[]
  onToggleStationItem: (orderId: string, itemId: string) => void
  onMarkOrderReady: (orderId: string) => void
  userRole?: string
}

export function KDSView({
  orders,
  configuredStations = [],
  onToggleStationItem,
  onMarkOrderReady,
  userRole = 'OWNER',
}: KDSViewProps) {
  // If in Cook mode, default station to DUM_BIRYANI instead of ALL
  const [selectedStation, setSelectedStation] = useState<Station | 'ALL'>('ALL')
  const [now, setNow] = useState<number>(0)
  const [mounted, setMounted] = useState<boolean>(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [managerAlertDismissed, setManagerAlertDismissed] = useState(false)
  const overdueAlertPlayedRef = React.useRef<Set<string>>(new Set())

  // selectedStation defaults to ALL unless filtered

  // Live 1-second ticker for precise live SLA countdown (client-only after mount)
  useEffect(() => {
    setMounted(true)
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Web Audio chime for new unacknowledged / overdue tickets
  const playAlertChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.3)
    } catch {
      // AudioContext might be blocked until user gesture
    }
  }

  // Dynamically detect stations configured on dishes and active in incoming orders
  const activeStations = React.useMemo(() => {
    const set = new Set<Station>()

    // 1. Stations from currently active cook orders
    orders.forEach((o) => {
      if (o.status === 'ACCEPTED' || o.status === 'PREPARING') {
        o.items.forEach((it) => {
          if (it.station && it.station !== 'ASSEMBLY') {
            set.add(it.station)
          }
        })
      }
    })

    // 2. Only specialized stations actually assigned to real dishes in the database
    if (configuredStations && configuredStations.length > 0) {
      configuredStations.forEach((st) => {
        if (st && st !== 'ASSEMBLY') {
          set.add(st)
        }
      })
    }

    return Array.from(set)
  }, [orders, configuredStations])

  // If there are multiple active stations, show 'ALL' plus each active station.
  // If no specialized stations are configured or active, stations array stays empty/hidden.
  const stations: (Station | 'ALL')[] = React.useMemo(() => {
    if (activeStations.length === 0) return []
    return ['ALL', ...activeStations]
  }, [activeStations])

  const activeOrders = orders.filter(
    (o) => o.status === 'ACCEPTED' || o.status === 'PREPARING'
  )

  // Calculate batch quantities for stations
  const batchCounts: Record<string, number> = {}
  activeOrders.forEach((order) => {
    order.items.forEach((item) => {
      if (selectedStation === 'ALL' || item.station === selectedStation || item.secondaryStations?.includes(selectedStation as Station)) {
        if (!item.stationDone) {
          batchCounts[item.name] = (batchCounts[item.name] || 0) + item.quantity
        }
      }
    })
  })

  // Format live SLA remaining time with color states:
  // Green: > 5 mins left
  // Amber: 0 - 5 mins left
  // Red Pulsing: <= 0 (OVERDUE +Xm Xs)
  const getSLAStatus = (order: Order) => {
    // If order is completed, ready, or dispatched, SLA timer stops running
    if (order.status === 'DISPATCHED') {
      return {
        formatted: 'DISPATCHED',
        isOverdue: false,
        state: 'GREEN' as const,
        remainingMinutes: 0,
      }
    }

    if (order.status === 'READY') {
      return {
        formatted: 'READY',
        isOverdue: false,
        state: 'GREEN' as const,
        remainingMinutes: 0,
      }
    }

    if (order.status === 'CANCELLED') {
      return {
        formatted: 'CANCELLED',
        isOverdue: false,
        state: 'GREEN' as const,
        remainingMinutes: 0,
      }
    }

    if (!mounted || now === 0) {
      return {
        formatted: `${order.targetPrepMinutes}m 00s left`,
        isOverdue: false,
        state: 'GREEN' as const,
        remainingMinutes: order.targetPrepMinutes,
      }
    }

    const createdTime = new Date(order.createdAt).getTime()
    const targetMs = order.targetPrepMinutes * 60 * 1000
    const elapsedMs = now - createdTime
    const remainingMs = targetMs - elapsedMs

    const totalSeconds = Math.floor(remainingMs / 1000)
    const isOverdue = totalSeconds <= 0
    const absSeconds = Math.abs(totalSeconds)
    const mins = Math.floor(absSeconds / 60)
    const secs = absSeconds % 60
    
    // Explicit "left" suffix for countdown, or "OVERDUE +Xm Xs" when timer reaches 0
    const formatted = isOverdue
      ? `OVERDUE +${mins}m ${secs < 10 ? '0' : ''}${secs}s`
      : `${mins}m ${secs < 10 ? '0' : ''}${secs}s left`

    let state: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'
    if (isOverdue) {
      state = 'RED'
    } else if (totalSeconds <= 5 * 60) {
      state = 'AMBER'
    }

    return {
      formatted,
      isOverdue,
      state,
      remainingMinutes: Math.round(totalSeconds / 60),
    }
  }

  // Detect overdue orders and trigger sound alert & manager notification
  const overdueOrders = activeOrders.filter((o) => {
    return mounted && now > 0 && getSLAStatus(o).isOverdue
  })

  // Play alert chime when an order first breaches SLA
  useEffect(() => {
    if (overdueOrders.length > 0 && soundEnabled) {
      overdueOrders.forEach((o) => {
        if (!overdueAlertPlayedRef.current.has(o.id)) {
          overdueAlertPlayedRef.current.add(o.id)
          playAlertChime()
        }
      })
    }
  }, [overdueOrders, soundEnabled])

  return (
    <div className="space-y-5">
      {/* Sleek Apple HIG Overdue Alert Banner (Compact, non-intrusive notification) */}
      {overdueOrders.length > 0 && !managerAlertDismissed && (
        <div className="flex items-center justify-between p-3 px-3.5 rounded-xl border border-red-500/50 bg-red-500/10 dark:bg-red-950/40 text-red-900 dark:text-red-100 text-xs shadow-xs transition-all">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-xs text-red-700 dark:text-red-300 block truncate">
                SLA Breached: Ticket {overdueOrders.map((o) => o.orderNumber).join(', ')}
              </span>
              <span className="text-[11px] text-muted-foreground block truncate">
                Target cook time exceeded. Prioritize on station.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => playAlertChime()}
              className="text-xs h-7 px-2.5 font-bold border-red-500/30 hover:bg-red-500/15 text-red-600 dark:text-red-400 bg-background/50 rounded-lg cursor-pointer"
            >
              Chime
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setManagerAlertDismissed(true)}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Top Header & Station Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Kitchen Display (KDS)
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block mt-0.5">
            {stations.length > 0 
              ? 'Multi-station touch cook tickets & aggregated line batches' 
              : 'Live cook tickets & order prep stream'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
          {/* Sound Notification Alert Toggle */}
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              playAlertChime()
            }}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-2xs shrink-0"
            title={soundEnabled ? "Audio chimes active (Click to mute)" : "Audio muted (Click to enable)"}
            aria-label="Toggle chime"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Bell className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Apple HIG Scrollable Station Segmented Pill Control - Only visible when multiple stations are active */}
          {stations.length > 0 && (
            <div className="flex-1 min-w-0 overflow-x-auto touch-pan-x no-scrollbar py-0.5">
              <div 
                role="tablist"
                aria-label="Kitchen Stations"
                className="inline-flex items-center p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 shadow-xs gap-1"
              >
                {stations.map((st) => {
                  const isSelected = selectedStation === st
                  return (
                    <button
                      key={st}
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedStation(st)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[32px] flex items-center justify-center",
                        isSelected
                          ? "bg-card text-foreground shadow-xs border border-border/50 font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <span>{formatStationName(st)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Item Batching Summary for Line Cooks */}
      {Object.keys(batchCounts).length > 0 && (
        <Card className="p-3.5 bg-muted/30 border-border/80 shadow-2xs">
          <div className="flex items-center space-x-2 text-foreground text-xs font-semibold mb-2">
            <Layers className="w-4 h-4 text-primary" />
            <span>Active Batch Cook Summary ({selectedStation})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(batchCounts).map(([name, count]) => (
              <Badge
                key={name}
                variant="secondary"
                className="text-xs py-1 px-2.5 gap-1.5 font-medium border border-border"
              >
                <span className="font-bold font-mono text-foreground">{count}x</span>
                <span>{name}</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeOrders.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground bg-card rounded-xl border border-dashed border-border p-8">
            <Flame className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50 stroke-[1.5]" />
            <p className="text-sm font-semibold text-foreground">No active cooking tickets</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              New orders accepted in the Live Queue will automatically arrive here at the cook stations.
            </p>
          </div>
        ) : (
          activeOrders.map((order) => {
            const relevantItems = order.items.filter(
              (it) => 
                selectedStation === 'ALL' || 
                it.station === selectedStation || 
                it.secondaryStations?.includes(selectedStation as Station)
            )
            if (relevantItems.length === 0) return null

            const allDone = relevantItems.every((it) => it.stationDone)
            const sla = getSLAStatus(order)

            return (
              <Card
                key={order.id}
                className={cn(
                  "overflow-hidden border rounded-2xl transition-all flex flex-col justify-between shadow-xs bg-card",
                  sla.state === 'RED'
                    ? "border-red-500/70 ring-1 ring-red-500/20"
                    : sla.state === 'AMBER'
                    ? "border-amber-500/70 ring-1 ring-amber-500/20"
                    : allDone
                    ? "border-emerald-500/70 ring-1 ring-emerald-500/20"
                    : "border-border/80"
                )}
              >
                <div>
                  {/* Apple HIG Ticket Header - Clean Two-Column Hierarchy */}
                  <div className={cn(
                    "p-3.5 pb-3 flex items-start justify-between gap-3 border-b transition-colors",
                    sla.state === 'RED'
                      ? "bg-red-500/10 border-red-200 dark:border-red-900/50"
                      : sla.state === 'AMBER'
                      ? "bg-amber-500/10 border-amber-200 dark:border-amber-900/50"
                      : allDone
                      ? "bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/50"
                      : "bg-muted/30 border-border/60"
                  )}>
                    {/* Left: Channel, Order Number & Brand */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md text-white font-mono shrink-0 shadow-2xs",
                          order.channel === 'SWIGGY' ? "bg-orange-600" : order.channel === 'ZOMATO' ? "bg-red-600" : "bg-neutral-800"
                        )}>
                          {order.channel}
                        </span>
                        <span className="text-base font-extrabold text-foreground font-mono tracking-tight">
                          {order.orderNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="font-bold text-foreground">{order.brandName}</span>
                        <span>•</span>
                        <span className="truncate max-w-[130px] font-medium">{order.customerName}</span>
                        {order.channel === 'DIRECT' && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                            Delivery
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Urgent SLA Countdown Pill */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 font-mono shadow-2xs border",
                        sla.state === 'RED'
                          ? "bg-red-600 text-white border-red-700 animate-pulse"
                          : sla.state === 'AMBER'
                          ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      )}>
                        <Clock className="w-3 h-3" />
                        <span>{sla.isOverdue ? `LATE: ${sla.formatted}` : sla.formatted}</span>
                      </span>

                      {allDone && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>All Items Cooked</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cook Checklist Items - Clean, edge-to-edge interactive tap rows */}
                  <div className="p-3 divide-y divide-border/40">
                    {relevantItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => onToggleStationItem(order.id, item.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer min-h-[56px] gap-3 active:scale-[0.98] group",
                          item.stationDone
                            ? "bg-muted/40 text-muted-foreground opacity-60"
                            : "hover:bg-muted/30 text-foreground"
                        )}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <span className={cn(
                            "text-sm font-black shrink-0 w-8 h-8 rounded-lg font-mono flex items-center justify-center transition-colors shadow-2xs",
                            item.stationDone
                              ? "bg-muted text-muted-foreground line-through"
                              : "bg-primary text-primary-foreground"
                          )}>
                            {item.quantity}x
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "font-bold text-sm leading-snug break-words transition-colors",
                              item.stationDone && "line-through text-muted-foreground"
                            )}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-medium text-muted-foreground font-mono">
                                Station: {formatStationName(item.station)}
                              </span>
                              {item.secondaryStations && item.secondaryStations.length > 0 && (
                                <span className="text-[10px] text-muted-foreground/80">
                                  → {item.secondaryStations.map((s) => formatStationName(s)).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Large Touch-Friendly Check Indicator */}
                        <div className={cn(
                          "w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                          item.stationDone
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                            : "border-border/80 bg-background group-hover:border-primary/60"
                        )}>
                          {item.stationDone ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <div className="w-2 h-2 rounded-sm bg-transparent group-hover:bg-primary/20" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Ready Trigger */}
                <div className="p-3 border-t border-border/60 bg-muted/15">
                  {allDone ? (
                    <Button
                      onClick={() => onMarkOrderReady(order.id)}
                      className="w-full text-xs h-10 font-bold gap-2 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready for Packing & Dispatch</span>
                    </Button>
                  ) : (
                    <div className="text-center text-[11px] font-medium text-muted-foreground py-1">
                      Tap anywhere on an item to check it off
                    </div>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
