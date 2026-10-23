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
  Trash2
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
            {/* Desktop Controls (Role Switcher & Language visible on lg:flex) */}
            <div className="hidden lg:flex items-center gap-2">
              {/* Hindi / English Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === 'EN' ? 'HI' : 'EN')}
                className="text-[11px] h-8 px-2.5 font-mono gap-1 text-foreground/80 hover:text-foreground border-border/80 bg-background/50 hover:bg-muted/80 rounded-lg cursor-pointer"
                title="Toggle Language (English / हिंदी)"
              >
                <Languages className="w-3.5 h-3.5" />
                <span className="font-bold">{language}</span>
              </Button>

              {/* Role Switcher Pill */}
              <div className="flex items-center bg-muted/90 rounded-lg p-0.5 text-xs border border-border/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setUserRole('OWNER')}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all font-bold text-[11px] cursor-pointer",
                    userRole === 'OWNER' 
                      ? "bg-background text-foreground shadow-2xs font-extrabold" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Owner
                </button>
                <button
                  type="button"
                  onClick={() => setUserRole('LINE_COOK')}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all font-bold text-[11px] cursor-pointer",
                    userRole === 'LINE_COOK' 
                      ? "bg-background text-foreground shadow-2xs font-extrabold" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cook
                </button>
              </div>
            </div>

            {/* High-Impact Emergency Pause Button (Compact on mobile, full on desktop) */}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setIsPauseDialogOpen(true)}
              className={cn(
                "h-8 sm:h-9 px-2 sm:px-3 gap-1 sm:gap-1.5 font-bold shadow-xs cursor-pointer transition-transform active:scale-95 shrink-0 rounded-lg",
                isPausedAll || pausedPlatforms.swiggy || pausedPlatforms.zomato
                  ? "bg-red-700 hover:bg-red-800 text-white animate-pulse ring-2 ring-red-400"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              <AlertOctagon className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span className="hidden sm:inline font-extrabold uppercase tracking-wide text-xs">
                {isPausedAll ? t.pausedAll : t.emergencyPause}
              </span>
              <span className="sm:hidden font-extrabold uppercase text-[11px]">
                {isPausedAll ? 'Paused' : 'Pause'}
              </span>
            </Button>

            {/* Mobile Hamburger Menu Drawer */}
            <div className="lg:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg border-border/80 bg-background/50 hover:bg-muted text-foreground flex items-center justify-center cursor-pointer"
                    aria-label="Open menu"
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] p-5 flex flex-col justify-between">
                  <div className="space-y-6">
                    <SheetHeader className="p-0 text-left border-b border-border/70 pb-3">
                      <SheetTitle className="flex items-center">
                        <div className="relative h-8 w-auto flex items-center">
                          <Image 
                            src="/logo.png?v=2" 
                            alt="KitchFlow" 
                            width={130} 
                            height={32} 
                            className="h-7 w-auto object-contain"
                            unoptimized
                          />
                        </div>
                      </SheetTitle>
                    </SheetHeader>

                    {/* Active Kitchen Profile & Role */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Active Kitchen Role
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 bg-muted/70 p-1 rounded-xl border border-border/80">
                        <button
                          type="button"
                          onClick={() => setUserRole('OWNER')}
                          className={cn(
                            "py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            userRole === 'OWNER'
                              ? "bg-background text-foreground shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Owner</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserRole('LINE_COOK')}
                          className={cn(
                            "py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            userRole === 'LINE_COOK'
                              ? "bg-background text-foreground shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>Line Cook</span>
                        </button>
                      </div>
                    </div>

                    {/* Language Switcher */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Kitchen Language
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 bg-muted/70 p-1 rounded-xl border border-border/80">
                        <button
                          type="button"
                          onClick={() => setLanguage('EN')}
                          className={cn(
                            "py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            language === 'EN'
                              ? "bg-background text-foreground shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>English</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguage('HI')}
                          className={cn(
                            "py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                            language === 'HI'
                              ? "bg-background text-foreground shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Languages className="w-3.5 h-3.5" />
                          <span>हिंदी (Hindi)</span>
                        </button>
                      </div>
                    </div>



                    {/* Supplier Orders & Stock Procurement (PO Manager) */}
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Supplier Orders & POs</span>
                        </div>
                        {purchaseOrders.filter((po) => po.status === 'PENDING_DELIVERY').length > 0 ? (
                          <Badge className="bg-amber-500 text-white font-mono text-[10px] h-4.5 px-1.5">
                            {purchaseOrders.filter((po) => po.status === 'PENDING_DELIVERY').length} Pending
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            All Stocked
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Track WhatsApp purchase indents and tap &quot;Mark Received&quot; when the supply van arrives.
                      </p>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsMobileMenuOpen(false)
                            setIsPOManagerOpen(true)
                          }}
                          className="h-8 text-xs font-bold gap-1 bg-background hover:bg-muted border-border/80 cursor-pointer"
                        >
                          <span>Manage POs</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => {
                            setIsMobileMenuOpen(false)
                            setIsCreatePOOpen(true)
                          }}
                          className="h-8 text-xs font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        >
                          <span>+ New Indent</span>
                        </Button>
                      </div>
                    </div>

                    {/* Quick Shift Wastage & Spoilage Button */}
                    <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          <span>Shift Wastage Log</span>
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          Record burnt, spilled or spoiled food items.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          setIsWastageOpen(true)
                        }}
                        className="h-7 text-xs font-bold border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
                      >
                        + Log Waste
                      </Button>
                    </div>

                    {/* Active Multi-Brand Summary */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Store className="w-3.5 h-3.5 text-primary" />
                          <span>Connected Brands ({brands.length})</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsMobileMenuOpen(false)
                            setIsBrandModalOpen(true)
                          }}
                          className="h-6 text-[11px] px-2 text-primary font-bold hover:bg-primary/10 gap-1 cursor-pointer"
                        >
                          <span>+ Manage</span>
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {brands.map((b) => (
                          <span
                            key={b.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-background border border-border/70 text-foreground/80 flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                            <span>{b.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer Status */}
                  <div className="pt-4 border-t border-border/70 text-center">
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
