'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
  UserCheck,
  Menu,
  Globe,
  Store,
  SlidersHorizontal,
  ChevronRight,
  Truck,
  Trash2,
  Bike,
  User
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { BrandManagerModal } from '@/components/brands/BrandManagerModal'
import { PurchaseOrderManagerModal } from '@/components/inventory/PurchaseOrderManagerModal'
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal'
import { WastageModal } from '@/components/inventory/WastageModal'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const pathname = usePathname()

  // Completely isolate public customer invoice pages so customers never see inner kitchen software
  if (pathname?.startsWith('/invoice')) {
    return null
  }

  const { 
    isPausedAll, 
    pausedPlatforms, 
    handleToggleEmergencyPause, 
    brands, 
    orders, 
    ingredients,
    purchaseOrders,
    handleReceivePurchaseOrder,
    handleCreatePurchaseOrder,
    handleAdjustStockWithReason,
    userRole,
    setUserRole,
    language,
    setLanguage,
    handleAddBrand,
  } = useKitchen()

  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  const [isPOManagerOpen, setIsPOManagerOpen] = useState(false)
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false)
  const [isWastageOpen, setIsWastageOpen] = useState(false)

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
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/80 safe-area-pt">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center space-x-2 shrink-0">
            <Link href="/orders" className="flex items-center space-x-2">
              <div className="relative h-9 w-auto flex items-center">
                <Image 
                  src="/logo.png?v=2" 
                  alt="KitchFlow" 
                  width={140} 
                  height={36} 
                  className="h-8 sm:h-9 w-auto object-contain"
                  priority
                  unoptimized
                />
              </div>
              <span className="hidden xs:inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 ml-1">
                {brands.length} Brands
              </span>
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
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {Boolean(item.badge && item.badge > 0) && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] h-4 min-w-4 px-1 leading-none rounded-full flex items-center justify-center font-mono font-bold",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-foreground"
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Action: Emergency Pause + Hamburger Menu Drawer on Mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Controls visible on lg:flex */}
            <div className="hidden lg:flex items-center gap-2">
              {/* User Profile Chip (clicks to open drawer) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex items-center gap-1.5 px-3 h-8 sm:h-9 rounded-lg border border-border/80 bg-background/50 hover:bg-muted text-foreground text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                title="Open Management Drawer"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <span>Usalla</span>
              </button>
            </div>

            {/* High-Impact Emergency Pause Button (Subtle & calm in resting state, bright pulsing red when paused) */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPauseDialogOpen(true)}
              className={cn(
                "h-8 sm:h-9 px-2.5 sm:px-3 gap-1 sm:gap-1.5 font-bold shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0 rounded-lg",
                isPausedAll || pausedPlatforms.swiggy || pausedPlatforms.zomato
                  ? "bg-red-600 hover:bg-red-700 text-white animate-pulse ring-2 ring-red-400 border-red-600"
                  : "border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 bg-background/50"
              )}
            >
              <AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 stroke-[2.2]" />
              <span className="hidden sm:inline font-bold uppercase tracking-wide text-xs">
                {isPausedAll ? t.pausedAll : t.emergencyPause}
              </span>
              <span className="sm:hidden font-bold uppercase text-[11px]">
                {isPausedAll ? 'Paused' : 'Pause'}
              </span>
            </Button>

            {/* Menu Drawer (Accessible on mobile & desktop) */}
            <div>
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9 px-2.5 rounded-lg border-border/80 bg-background/50 hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    aria-label="Open menu"
                  >
                    <Menu className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs font-bold">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[88vw] max-w-sm sm:w-[360px] p-0 flex flex-col justify-between rounded-l-2xl border-l border-border/80 bg-background/95 backdrop-blur-xl">
                  {/* Scrollable Content Container */}
                  <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-60px)] no-scrollbar">
                    {/* Drawer Header with Logo & Language Segmented Switcher */}
                    <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                      <div className="relative h-7 w-auto flex items-center">
                        <Image 
                          src="/logo.png?v=2" 
                          alt="KitchFlow" 
                          width={120} 
                          height={30} 
                          className="h-6 w-auto object-contain"
                          unoptimized
                        />
                      </div>

                      {/* 1-Tap iOS Segmented Control for Language */}
                      <div 
                        role="tablist" 
                        aria-label="Language selection"
                        className="inline-flex items-center p-0.5 bg-muted/70 rounded-lg border border-border/50 shadow-2xs"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={language === 'EN'}
                          onClick={() => setLanguage('EN')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                            language === 'EN'
                              ? "bg-card text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={language === 'HI'}
                          onClick={() => setLanguage('HI')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                            language === 'HI'
                              ? "bg-card text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          हिंदी
                        </button>
                      </div>
                    </div>

                    {/* Apple Style Clean Profile Card */}
                    <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary font-mono shadow-2xs">
                            U
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-foreground">
                              Usalla
                            </span>
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/60">
                              Admin
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Kitchen Manager • {userRole === 'OWNER' ? 'Owner Access' : 'Cook Access'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">Online</span>
                      </div>
                    </div>

                    {/* iOS Inset Grouped Section: Quick Portals & Shift Tools */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1 font-mono">
                        Shift & Operations
                      </span>

                      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden divide-y divide-border/50 shadow-xs">
                        {/* Delivery Boy Portal Row */}
                        <Link
                          href="/delivery"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-2xs">
                              <Bike className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                Delivery Boy Portal
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                Direct phone delivery & rider dispatch runs
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        </Link>

                        {/* Supplier Orders & POs Row */}
                        <div className="p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                                <Truck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">
                                  Supplier Orders & POs
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Track WhatsApp indents & inbound supply
                                </p>
                              </div>
                            </div>
                            {purchaseOrders.filter((po) => po.status === 'PENDING_DELIVERY').length > 0 ? (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 font-mono text-[10px] h-4.5 px-1.5 border border-amber-500/30">
                                {purchaseOrders.filter((po) => po.status === 'PENDING_DELIVERY').length} Due
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                In Stock
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsMobileMenuOpen(false)
                                setIsPOManagerOpen(true)
                              }}
                              className="h-8 text-xs font-semibold border-border/80 hover:bg-muted cursor-pointer rounded-lg"
                            >
                              <span>Manage POs</span>
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => {
                                setIsMobileMenuOpen(false)
                                setIsCreatePOOpen(true)
                              }}
                              className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-lg shadow-2xs"
                            >
                              <span>+ New Indent</span>
                            </Button>
                          </div>
                        </div>

                        {/* Shift Wastage Row */}
                        <div className="flex items-center justify-between p-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 border border-destructive/20 shadow-2xs">
                              <Trash2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground">
                                Shift Wastage Log
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                Record burnt, spilled or expired food
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsMobileMenuOpen(false)
                              setIsWastageOpen(true)
                            }}
                            className="h-7 text-xs font-bold border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer rounded-lg shrink-0"
                          >
                            + Log Waste
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Connected Brands Inset Group */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 font-mono">
                          Connected Brands ({brands.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsMobileMenuOpen(false)
                            setIsBrandModalOpen(true)
                          }}
                          className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
                        >
                          Manage
                        </button>
                      </div>

                      <div className="p-3 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-wrap gap-1.5">
                        {brands.map((b) => (
                          <span
                            key={b.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted/60 border border-border/70 text-foreground/80 flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <span>{b.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer Status */}
                  <div className="p-4 border-t border-border/70 text-center bg-muted/20">
                    <p className="text-[10px] text-muted-foreground font-mono">
                      KitchFlow OS • v2.4 Multi-Brand
                    </p>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
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

      {/* Brand Manager Modal */}
      <BrandManagerModal
        open={isBrandModalOpen}
        onOpenChange={setIsBrandModalOpen}
        brands={brands}
        onAddBrand={handleAddBrand}
      />

      {/* Supplier Purchase Orders Manager Modal */}
      <PurchaseOrderManagerModal
        open={isPOManagerOpen}
        onOpenChange={setIsPOManagerOpen}
        purchaseOrders={purchaseOrders}
        onReceivePO={handleReceivePurchaseOrder}
        onCreateNewPO={() => setIsCreatePOOpen(true)}
      />

      {/* Create Stock Indent / PO Modal */}
      <PurchaseOrderModal
        open={isCreatePOOpen}
        onOpenChange={setIsCreatePOOpen}
        ingredients={ingredients}
        brands={brands}
        onSavePurchaseOrder={(po) => {
          handleCreatePurchaseOrder(po)
        }}
        onFulfillPurchaseOrder={(items) => {
          items.forEach((it) => {
            const po = handleCreatePurchaseOrder({
              supplierName: 'Direct Delivery Intake',
              horizon: 'MANUAL',
              items: [{
                ingredientId: it.ingredientId,
                ingredientName: ingredients.find((i) => i.id === it.ingredientId)?.name || 'Ingredient',
                quantity: it.addedStock,
                unit: ingredients.find((i) => i.id === it.ingredientId)?.unit || 'g',
                costPerUnit: ingredients.find((i) => i.id === it.ingredientId)?.costPerUnit || 0,
              }],
              totalEstimatedCost: 0,
            })
            handleReceivePurchaseOrder(po.id)
          })
        }}
      />

      {/* Quick Shift Wastage & Spoilage Modal */}
      <WastageModal
        open={isWastageOpen}
        onOpenChange={setIsWastageOpen}
        ingredients={ingredients}
        onRecordWastage={(ingId, lossQty, note) => {
          handleAdjustStockWithReason(ingId, -lossQty, 'WASTAGE_SPOILAGE', note)
        }}
      />
    </>
  )
}
