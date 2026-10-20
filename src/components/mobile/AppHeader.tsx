'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ClipboardList, 
  Flame, 
  PackageCheck, 
  Boxes, 
  TrendingUp, 
  AlertOctagon, 
  UtensilsCrossed,
  ShieldAlert,
  Languages,
  UserCheck
} from 'lucide-react'
import { useKitchen } from '@/context/KitchenContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const pathname = usePathname()
  const { 
    isPausedAll, 
    pausedPlatforms, 
    handleToggleEmergencyPause, 
    brands, 
    orders, 
    ingredients,
    userRole,
    setUserRole,
    language,
    setLanguage
  } = useKitchen()

  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false)

  if (pathname === '/login') return null

  const kdsPendingCount = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length
  const packingPendingCount = orders.filter((o) => o.status === 'PREPARING' || o.status === 'READY').length
  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minThreshold).length

  // Hindi localization labels dictionary
  const t = {
    EN: {
      appName: 'KitchFlow',
      subTitle: 'Multi-brand Cloud Kitchen',
      liveQueue: 'Live Queue',
      kdsCook: 'KDS Kitchen',
      dispatch: 'Dispatch',
      inventory: 'Inventory',
      margins: 'Profit & Margins',
      emergencyPause: 'Emergency Pause',
      pausedAll: 'All Platforms Paused',
    },
    HI: {
      appName: 'किचन ओएस',
      subTitle: 'क्लाउड किचन ऑपरेटिंग सिस्टम',
      liveQueue: 'लाइव ऑर्डर्स',
      kdsCook: 'केडीएस कुक',
      dispatch: 'पैकिंग व डिस्पैच',
      inventory: 'स्टॉक व सामग्री',
      margins: 'लाभ व मार्जिन',
      emergencyPause: 'आपातकालीन रोक',
      pausedAll: 'सभी प्लेटफॉर्म रुके हुए',
    }
  }[language]

  const rawNavLinks = [
    { href: '/orders', label: t.liveQueue, icon: ClipboardList, badge: orders.length, roleRequired: 'OWNER' },
    { href: '/kds', label: t.kdsCook, icon: Flame, badge: kdsPendingCount },
    { href: '/packing', label: t.dispatch, icon: PackageCheck, badge: packingPendingCount },
    { href: '/inventory', label: t.inventory, icon: Boxes, badge: lowStockCount, roleRequired: 'OWNER' },
    { href: '/margins', label: t.margins, icon: TrendingUp, roleRequired: 'OWNER' },
  ]

  const navLinks = rawNavLinks.filter((item) => !item.roleRequired || item.roleRequired === userRole)

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Details */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link href="/orders" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm font-semibold text-foreground tracking-tight">
                    {t.appName}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                    {brands.length} Brands
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 hidden sm:inline-block">
                  {t.subTitle}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Bar (Only on laptops & desktop: lg:flex) */}
          <nav className="hidden lg:flex items-center space-x-1 lg:space-x-1.5">
            {navLinks.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (pathname === '/' && item.href === '/orders')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative",
                    isActive
                      ? "bg-accent text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="text-[10px] h-4 min-w-4 px-1 leading-none rounded-full flex items-center justify-center font-mono"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Action: Language, Role Selector, Emergency Pause Confirmation */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Hindi / English Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'EN' ? 'HI' : 'EN')}
              className="text-xs h-8 px-2 font-mono gap-1 text-foreground/80 hover:text-foreground border border-border"
              title="Toggle Language (English / हिंदी)"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="font-bold">{language}</span>
            </Button>

            {/* Role Switcher Pill */}
            <div className="flex items-center bg-muted/80 rounded-md p-0.5 text-xs border border-border">
              <button
                type="button"
                onClick={() => setUserRole('OWNER')}
                className={cn(
                  "px-2.5 py-1 rounded transition-colors font-bold text-xs cursor-pointer",
                  userRole === 'OWNER' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => setUserRole('LINE_COOK')}
                className={cn(
                  "px-2.5 py-1 rounded transition-colors font-bold text-xs cursor-pointer",
                  userRole === 'LINE_COOK' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cook
              </button>
            </div>

            {/* High-Impact Emergency Pause Button (Always prominent RED) */}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setIsPauseDialogOpen(true)}
              className={cn(
                "text-xs h-9 px-3 gap-1.5 font-black shadow-sm tracking-wide cursor-pointer",
                isPausedAll || pausedPlatforms.swiggy || pausedPlatforms.zomato
                  ? "bg-red-700 hover:bg-red-800 text-white animate-pulse border-2 border-white/40"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              <AlertOctagon className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span className="hidden sm:inline font-extrabold uppercase">
                {isPausedAll ? t.pausedAll : t.emergencyPause}
              </span>
              <span className="sm:hidden font-extrabold uppercase">
                {isPausedAll ? 'Paused' : 'Pause'}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Emergency Pause Active Warning Banners */}
      {isPausedAll ? (
        <div className="bg-destructive/15 border-b border-destructive/30 text-destructive text-xs py-2 px-4 text-center font-semibold flex items-center justify-center gap-2">
          <AlertOctagon className="w-4 h-4" />
          <span>⚠️ EMERGENCY PAUSE ACTIVE: Both Swiggy & Zomato storefronts are currently halted. No new orders will arrive.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleToggleEmergencyPause('ALL')}
            className="h-6 text-[10px] px-2 bg-background ml-2 text-foreground"
          >
            Resume Both
          </Button>
        </div>
      ) : (pausedPlatforms.swiggy || pausedPlatforms.zomato) ? (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2">
          <span>
            ⚠️ PARTIAL PAUSE: {pausedPlatforms.swiggy ? 'Swiggy is Paused' : ''} {pausedPlatforms.zomato ? 'Zomato is Paused' : ''}.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleToggleEmergencyPause('ALL')}
            className="h-6 text-[10px] px-2 bg-background ml-2 text-foreground"
          >
            Resume Platforms
          </Button>
        </div>
      ) : null}

      {/* Emergency Pause Modal with Confirmation & Per-Platform Controls */}
      <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <span>Aggregator Emergency Pause Controls</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <p className="text-muted-foreground">
              Pausing prevents incoming orders during peak kitchen rushes, power disruptions, or deep ingredient shortages. Choose whether to pause individual channels or trigger an emergency master stop.
            </p>

            <div className="space-y-2 pt-1">
              {/* Swiggy Status */}
              <div className="p-3 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground text-sm">Swiggy Storefront</span>
                  <p className="text-[11px] text-muted-foreground">
                    Status: {pausedPlatforms.swiggy || isPausedAll ? 'Paused (Offline)' : 'Active (Receiving Orders)'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={pausedPlatforms.swiggy || isPausedAll ? "default" : "destructive"}
                  onClick={() => handleToggleEmergencyPause('SWIGGY')}
                  className="text-xs h-8"
                >
                  {pausedPlatforms.swiggy || isPausedAll ? 'Resume Swiggy' : 'Pause Swiggy'}
                </Button>
              </div>

              {/* Zomato Status */}
              <div className="p-3 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground text-sm">Zomato Storefront</span>
                  <p className="text-[11px] text-muted-foreground">
                    Status: {pausedPlatforms.zomato || isPausedAll ? 'Paused (Offline)' : 'Active (Receiving Orders)'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={pausedPlatforms.zomato || isPausedAll ? "default" : "destructive"}
                  onClick={() => handleToggleEmergencyPause('ZOMATO')}
                  className="text-xs h-8"
                >
                  {pausedPlatforms.zomato || isPausedAll ? 'Resume Zomato' : 'Pause Zomato'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant={isPausedAll ? "outline" : "destructive"}
              onClick={() => {
                handleToggleEmergencyPause('ALL')
                setIsPauseDialogOpen(false)
              }}
              className="w-full sm:w-auto font-bold"
            >
              {isPausedAll ? 'Resume All Aggregators' : 'Emergency Pause All Platforms'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsPauseDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
