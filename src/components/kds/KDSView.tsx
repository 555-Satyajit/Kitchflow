'use client'

import React, { useState, useEffect } from 'react'
import { Order, Station } from '@/types'
import { Flame, Clock, CheckCircle2, Layers, Check, Bell, BellRing, Volume2, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatStationName } from '@/lib/utils'

interface KDSViewProps {
  orders: Order[]
  onToggleStationItem: (orderId: string, itemId: string) => void
  onMarkOrderReady: (orderId: string) => void
  userRole?: string
}

export function KDSView({
  orders,
  onToggleStationItem,
  onMarkOrderReady,
  userRole = 'OWNER',
}: KDSViewProps) {
  // If in Cook mode, default station to DUM_BIRYANI instead of ALL
  const [selectedStation, setSelectedStation] = useState<Station | 'ALL'>(() => {
    return userRole === 'LINE_COOK' ? 'DUM_BIRYANI' : 'ALL'
  })
  const [now, setNow] = useState<number>(0)
  const [mounted, setMounted] = useState<boolean>(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [managerAlertDismissed, setManagerAlertDismissed] = useState(false)
  const overdueAlertPlayedRef = React.useRef<Set<string>>(new Set())

  // Keep selectedStation aligned if role flips to LINE_COOK
  useEffect(() => {
    if (userRole === 'LINE_COOK' && selectedStation === 'ALL') {
      setSelectedStation('DUM_BIRYANI')
    }
  }, [userRole, selectedStation])

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

  const stations: (Station | 'ALL')[] = [
    'ALL',
    'GRILL',
    'FRY',
    'TANDOOR',
    'DUM_BIRYANI',
    'WOK',
    'PIZZA',
    'BEVERAGE',
    'DESSERT',
    'ASSEMBLY',
  ]

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
    const createdTime = new Date(o.createdAt).getTime()
    const targetMs = o.targetPrepMinutes * 60 * 1000
    return mounted && now > 0 && (now - createdTime >= targetMs)
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
      {/* Overdue Manager Notification Alert Banner */}
      {overdueOrders.length > 0 && !managerAlertDismissed && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-red-600 bg-red-100/95 dark:bg-red-950/80 text-red-900 dark:text-red-100 text-xs shadow-md animate-pulse">
          <div className="flex items-center space-x-2.5">
            <BellRing className="w-5 h-5 shrink-0 text-red-600 animate-bounce" />
            <div>
              <span className="font-extrabold text-sm block">
                🚨 MANAGER ALERT: {overdueOrders.length} {overdueOrders.length === 1 ? 'Order Has' : 'Orders Have'} Breached SLA!
              </span>
              <span className="font-medium text-xs opacity-90">
                Ticket {overdueOrders.map((o) => o.orderNumber).join(', ')} exceeded target prep time. Immediate expediter intervention required.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => playAlertChime()}
              className="text-xs h-7 px-2 font-bold"
            >
              Sound Siren
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManagerAlertDismissed(true)}
              className="text-xs h-7 px-2 bg-background text-foreground"
            >
              Acknowledge
            </Button>
          </div>
        </div>
      )}

      {/* Top Header & Station Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Kitchen Display System (KDS)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live SLA timers, multi-station touch tickets, and aggregated line batches
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
          {/* Sound Notification Alert Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              playAlertChime()
            }}
            className="text-xs h-8 gap-1.5 font-medium shrink-0"
            title="Toggle ticket chime audio"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden md:inline">Chime</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden md:inline">Muted</span>
              </>
            )}
          </Button>

          {/* Station Segment Control (Fully touch & mouse scrollable with full station name visibility) */}
          <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain py-1">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/80 w-max">
              {stations.map((st) => (
                <Button
                  key={st}
                  variant={selectedStation === st ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedStation(st)}
                  className="text-xs h-8 px-3 font-semibold tracking-wide shrink-0 whitespace-nowrap active:scale-95 transition-transform"
                >
                  {formatStationName(st)}
                </Button>
              ))}
            </div>
          </div>
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
                  "overflow-hidden border-2 transition-all flex flex-col justify-between shadow-sm",
                  sla.state === 'RED'
                    ? "border-red-500 bg-red-50/70 dark:bg-red-950/30"
                    : sla.state === 'AMBER'
                    ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30"
                    : allDone
                    ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                    : "border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/15"
                )}
              >
                <div>
                  {/* Top Ticket Header - Full Tint by Urgency */}
                  <div className={cn(
                    "p-4 pb-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 border-b-2",
                    sla.state === 'RED'
                      ? "bg-red-100/90 dark:bg-red-900/50 border-red-200 dark:border-red-800"
                      : sla.state === 'AMBER'
                      ? "bg-amber-100/90 dark:bg-amber-900/50 border-amber-200 dark:border-amber-800"
                      : "bg-emerald-100/80 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800"
                  )}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-black text-foreground font-mono tracking-tight whitespace-nowrap">
                        {order.orderNumber}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-background/80 text-foreground border border-border shadow-2xs whitespace-nowrap">
                        {order.brandName}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider text-white whitespace-nowrap",
                        order.channel === 'SWIGGY' ? "bg-orange-600" : order.channel === 'ZOMATO' ? "bg-red-600" : "bg-neutral-800"
                      )}>
                        {order.channel}
                      </span>
                    </div>

                    {/* Bold Urgency Countdown Pill */}
                    <div className={cn(
                      "flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-lg border-2 font-bold shadow-2xs shrink-0 whitespace-nowrap font-mono",
                      sla.state === 'RED'
                        ? "bg-red-600 text-white border-red-700 animate-pulse"
                        : sla.state === 'AMBER'
                        ? "bg-amber-500 text-black border-amber-600"
                        : "bg-emerald-600 text-white border-emerald-700"
                    )}>
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>{sla.isOverdue ? `LATE: ${sla.formatted}` : sla.formatted}</span>
                    </div>
                  </div>

                  {/* Cook Checklist Items - Entire Card Tappable (54px+ min touch target) */}
                  <div className="p-3.5 sm:p-4 space-y-2.5">
                    {relevantItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => onToggleStationItem(order.id, item.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border-2 text-left transition-all cursor-pointer min-h-[58px] gap-3 active:scale-[0.98]",
                          item.stationDone
                            ? "bg-muted/60 border-border/80 text-muted-foreground opacity-60"
                            : "bg-card border-foreground/20 text-foreground hover:border-foreground/40 shadow-xs"
                        )}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                          <span className={cn(
                            "text-lg font-black shrink-0 px-2.5 py-1 rounded-lg font-mono",
                            item.stationDone
                              ? "bg-muted text-muted-foreground line-through"
                              : "bg-foreground text-background"
                          )}>
                            {item.quantity}x
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "font-extrabold text-base leading-tight break-words",
                              item.stationDone && "line-through text-muted-foreground"
                            )}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-foreground/80 border border-border/60">
                                Station: {formatStationName(item.station)}
                              </span>
                              {item.secondaryStations && item.secondaryStations.length > 0 && (
                                <span className="text-xs font-semibold text-muted-foreground">
                                  → {item.secondaryStations.map((s) => formatStationName(s)).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Large 32px Touch Target Checkbox */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center border-2 shrink-0 transition-all",
                          item.stationDone
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-foreground/30 bg-background"
                        )}>
                          {item.stationDone && <Check className="w-5 h-5 stroke-[3]" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-3.5 sm:p-4 pt-3 border-t-2 border-border/60 bg-background/50">
                  {allDone ? (
                    <Button
                      onClick={() => onMarkOrderReady(order.id)}
                      className="w-full text-sm h-12 font-bold gap-2 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Ready for Packing & Dispatch</span>
                    </Button>
                  ) : (
                    <div className="text-center text-xs font-bold text-muted-foreground py-1.5">
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
