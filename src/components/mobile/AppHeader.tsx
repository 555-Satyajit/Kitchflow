'use client'

import React, { useState, useEffect } from 'react'
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
  User,
  LogOut,
  ClipboardCheck,
  Settings,
  ChevronDown,
  Check,
  Building2,
  Loader2,
  History,
  Users
} from 'lucide-react'
import { signOutFromSupabase } from '@/actions/auth'
import { getOrganizationKitchensAction, switchActiveKitchenAction } from '@/actions/settings'
import { getNavCountsAction, NavCountsResult } from '@/features/orders/order-actions'
import { useKitchen } from '@/context/KitchenContext'
import { useNavCounts } from '@/hooks/useNavCounts'
import { useOutlets } from '@/hooks/useOutlets'
import { createClient } from '@/lib/supabase/client'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BrandManagerModal } from '@/components/brands/BrandManagerModal'
import { PurchaseOrderManagerModal } from '@/components/inventory/PurchaseOrderManagerModal'
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal'
import { WastageModal } from '@/components/inventory/WastageModal'
import { DispatchChecklistConfigModal } from '@/components/packing/DispatchChecklistConfigModal'
import { AddKitchenModal } from '@/components/kitchen/AddKitchenModal'
import { cn } from '@/lib/utils'
import { UserRole } from '@/types'

export interface AppHeaderProps {
  initialRole?: 'owner' | 'manager' | 'kitchen_staff';
  initialPermissions?: string[];
  initialName?: string;
  initialNavCounts?: NavCountsResult;
}

export function AppHeader({
  initialRole,
  initialPermissions,
  initialName,
  initialNavCounts,
}: AppHeaderProps = {}) {
  const pathname = usePathname()

  const { 
    isPausedAll, 
    pausedPlatforms, 
    handleToggleEmergencyPause, 
    brands, 
    orders, 
    isOrdersLoaded,
    navCounts,
    ingredients,
    menuItems,
    purchaseOrders,
    handleReceivePurchaseOrder,
    handleCreatePurchaseOrder,
    handleAdjustStockWithReason,
    userRole,
    setUserRole,
    language,
    setLanguage,
    handleAddBrand,
    setBrands,
  } = useKitchen()

  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  const [isPOManagerOpen, setIsPOManagerOpen] = useState(false)
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false)
  const [isWastageOpen, setIsWastageOpen] = useState(false)
  const [isDispatchChecklistOpen, setIsDispatchChecklistOpen] = useState(false)
  const [isAddKitchenOpen, setIsAddKitchenOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [profileName, setProfileName] = useState(initialName || 'Sampad Jena')
  const [profileRole, setProfileRole] = useState<'owner' | 'manager' | 'kitchen_staff'>(initialRole || 'owner')
  const [userPermissions, setUserPermissions] = useState<string[]>(
    initialPermissions || ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings']
  )
  // TanStack Query for dynamic outlet management and instant switching
  const {
    outlets: tanstackOutlets,
    activeOutletId: tanstackActiveOutletId,
    activeOutletName: tanstackActiveOutletName,
    isSwitching: isSwitchingOutlet,
    selectOutlet,
  } = useOutlets()

  const activeOutletId = tanstackActiveOutletId || 'ALL'
  const storeName = tanstackActiveOutletName || 'All Outlets'
  const outlets = tanstackOutlets

  // TanStack Query authoritative real-time nav counts (must be called before any conditional early returns)
  const { data: tanstackCounts } = useNavCounts(activeOutletId, initialNavCounts || navCounts)

  useEffect(() => {
    setMounted(true)
    try {
      // Check if logged in as a specific staff member
      const activeStaffName = localStorage.getItem('kitchflow_active_staff_name')
      const activeStaffRole = localStorage.getItem('kitchflow_active_staff_role')
      const activeStaffPerms = localStorage.getItem('kitchflow_active_staff_permissions')

      if (activeStaffName) {
        setProfileName(activeStaffName)
        if (activeStaffRole) {
          setProfileRole(activeStaffRole as any)
          const mappedRole: UserRole = activeStaffRole === 'owner' 
            ? 'OWNER' 
            : activeStaffRole === 'manager' 
            ? 'KITCHEN_MANAGER' 
            : 'LINE_COOK';
          setUserRole(mappedRole)
        }
        if (activeStaffPerms) {
          try {
            const parsed = JSON.parse(activeStaffPerms)
            if (Array.isArray(parsed)) {
              setUserPermissions(parsed)
            }
          } catch {}
        }
      } else {
        const stored = localStorage.getItem('kitchflow_outlet_config')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.ownerCredentials?.name) {
            setProfileName(parsed.ownerCredentials.name)
          }
        }
      }
    } catch (e) {
      // Ignored
    }
  }, [setUserRole])

  const handleSelectOutlet = (outletId: string, outletName: string) => {
    selectOutlet(outletId, outletName)
  }

  // Completely isolate public customer invoice pages, auth pages, and internal team onboarding portal
  if (
    pathname?.startsWith('/invoice') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/auth')
  ) {
    return null
  }

  if (pathname === '/login') return null

  // Authoritative server badge counts with TanStack Query primary source and in-memory fallback
  const authoritativeCounts = tanstackCounts || initialNavCounts || navCounts
  const liveOrderCount = authoritativeCounts ? authoritativeCounts.ordersCount : orders.length
  const kdsPendingCount = authoritativeCounts 
    ? authoritativeCounts.kdsCount 
    : orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length
  const packingPendingCount = authoritativeCounts 
    ? authoritativeCounts.packingCount 
    : orders.filter((o) => o.status === 'PREPARING' || o.status === 'READY').length
  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minThreshold).length

  // Nav is ready immediately if either orders or navCounts are populated
  const isNavReady = isOrdersLoaded || orders.length > 0 || authoritativeCounts !== null

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
    { href: '/orders', permission: 'orders', label: t.liveQueue, icon: ClipboardList, badge: liveOrderCount, isDynamic: true },
    { href: '/kds', permission: 'kds', label: t.kdsCook, icon: Flame, badge: kdsPendingCount, isDynamic: true },
    { href: '/packing', permission: 'packing', label: t.dispatch, icon: PackageCheck, badge: packingPendingCount, isDynamic: true },
    { href: '/inventory', permission: 'inventory', label: t.inventory, icon: Boxes, badge: lowStockCount, isDynamic: false },
    { href: '/margins', permission: 'margins', label: t.margins, icon: TrendingUp, isDynamic: false },
  ]

  const navLinks = rawNavLinks.filter((item) => {
    if (profileRole === 'owner') return true
    return userPermissions.includes(item.permission)
  })

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/80 safe-area-pt relative">
        {/* Subtle iOS Top Progress Bar for instant outlet switching feedback */}
        {isSwitchingOutlet && (
          <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-primary/20 overflow-hidden z-50">
            <div className="h-full bg-primary animate-pulse w-full duration-700" />
          </div>
        )}
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
              {mounted && brands.length > 0 && (
                <span className="hidden xs:inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 ml-1">
                  {brands.length} Brands
                </span>
              )}
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
                  {mounted && Boolean(item.badge && item.badge > 0) ? (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] h-4 min-w-4 px-1 leading-none rounded-full flex items-center justify-center font-mono font-bold transition-transform animate-in fade-in duration-150",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-foreground"
                      )}
                    >
                      {item.badge}
                    </Badge>
                  ) : null}
                </Link>
              )
            })}
          </nav>

          {/* Right Action: Emergency Pause + Hamburger Menu Drawer on Mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Emergency Pause and Menu Drawer */}

            {/* Desktop Controls visible on lg:flex */}
            <div className="hidden lg:flex items-center gap-2">
              {/* User Profile Chip (clicks to open drawer) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex items-center gap-1.5 px-3 h-8 sm:h-9 rounded-lg border border-border/80 bg-background/50 hover:bg-muted text-foreground text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                title="Open Management Drawer"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-mono uppercase text-[10px] font-bold">
                  {profileName.charAt(0) || 'U'}
                </div>
                <span>{profileName}</span>
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

                    {/* Apple Style Clean Profile Card with Outlet Selector */}
                    <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary font-mono shadow-2xs uppercase">
                              {profileName.charAt(0) || 'U'}
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-foreground">
                                {profileName}
                              </span>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/60">
                                {profileRole === 'owner' ? 'Owner' : profileRole === 'manager' ? 'Manager' : 'Staff'}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground block truncate max-w-[170px]">
                              {storeName ? `${storeName} • ` : ''}Live Shift
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">Online</span>
                        </div>
                      </div>

                      {/* Outlet Switcher with Shadcn Select */}
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Store className="w-3 h-3 text-primary" />
                            <span>Active Outlet Facility</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              setIsAddKitchenOpen(true);
                            }}
                            className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            + Add Kitchen
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <Select
                            value={activeOutletId || 'ALL'}
                            onValueChange={(val) => {
                              if (val === 'ALL') {
                                handleSelectOutlet('ALL', 'All Outlets');
                              } else {
                                const target = outlets.find((o) => o.id === val);
                                if (target) {
                                  handleSelectOutlet(target.id, target.name);
                                }
                              }
                            }}
                            disabled={isSwitchingOutlet}
                          >
                            <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/60 text-xs font-semibold shadow-2xs">
                              <div className="flex items-center gap-2 truncate">
                                <Store className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="truncate">
                                  {isSwitchingOutlet
                                    ? 'Switching...'
                                    : activeOutletId === 'ALL'
                                    ? 'All Outlets'
                                    : (storeName || outlets.find(o => o.id === activeOutletId)?.name || 'Select Outlet')}
                                </span>
                              </div>
                            </SelectTrigger>

                            <SelectContent 
                              position="popper" 
                              className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-2xl p-1.5 z-50"
                            >
                              <SelectGroup>
                                <SelectLabel className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 flex justify-between items-center">
                                  <span>Cloud Kitchen Facilities</span>
                                  <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full font-mono">{outlets.length} Facilities</span>
                                </SelectLabel>

                                {/* ALL OUTLETS OPTION */}
                                <SelectItem
                                  value="ALL"
                                  className="py-2 px-2.5 rounded-xl cursor-pointer hover:bg-muted/70 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary font-bold my-1"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span>All Outlets</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                                      Global View
                                    </span>
                                  </div>
                                </SelectItem>

                                <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
                                  {outlets.map((outlet) => (
                                    <SelectItem
                                      key={outlet.id}
                                      value={outlet.id}
                                      className="py-2 px-2.5 rounded-xl cursor-pointer hover:bg-muted/70 focus:bg-primary/10 focus:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary text-xs"
                                    >
                                      <div className="flex items-center justify-between w-full gap-2">
                                        <span className="truncate">{outlet.name}</span>
                                        <span className="text-[9px] font-semibold text-muted-foreground shrink-0">
                                          {outlet.brandCount} Brands
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </div>

                                {(profileRole === 'owner' || profileRole === 'manager') && (
                                  <div className="pt-1 mt-1 border-t border-border/50">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        setIsAddKitchenOpen(true);
                                      }}
                                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                    >
                                      <Building2 className="w-3.5 h-3.5" />
                                      <span>+ Add New Kitchen Outlet</span>
                                    </button>
                                  </div>
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* iOS Inset Grouped Section: Quick Portals & Shift Tools */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1 font-mono">
                        Shift & Operations
                      </span>

                      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden divide-y divide-border/50 shadow-xs">
                        {/* Order History Link - Gated by history or orders permission */}
                        {(profileRole === 'owner' || userPermissions.includes('history') || userPermissions.includes('orders')) && (
                          <Link
                            href="/orders/history"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20 shadow-2xs">
                                <History className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                  Order History
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Past delivered orders, invoices, and reprint receipts
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          </Link>
                        )}

                        {/* Customer Directory Link - Gated by customers or pos permission */}
                        {(profileRole === 'owner' || userPermissions.includes('customers') || userPermissions.includes('pos')) && (
                          <Link
                            href="/customers"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-2xs">
                                <Users className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                  Customer Directory
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Guest profiles, loyalty tiers & direct POS order punch
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          </Link>
                        )}

                        {/* Settings Hub Link - Gated by settings permission */}
                        {(profileRole === 'owner' || userPermissions.includes('settings')) && (
                          <Link
                            href="/settings"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs">
                                <Settings className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                  Settings
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  Manage outlets, staff access, taxes & invoice details
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          </Link>
                        )}

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

                        {/* Dispatch QA Checklist Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMobileMenuOpen(false)
                            setIsDispatchChecklistOpen(true)
                          }}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors cursor-pointer group text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                              <ClipboardCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                Dispatch QA Checklist
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                Configure items checked before sealing rider bags
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        </button>

                        {/* Supplier Orders & POs Row - Gated by procurement permission */}
                        {(profileRole === 'owner' || userPermissions.includes('procurement')) && (
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
                        )}

                        {/* Shift Wastage Row - Gated by inventory permission */}
                        {(profileRole === 'owner' || userPermissions.includes('inventory')) && (
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
                        )}
                      </div>
                    </div>

                    {/* Connected Brands Inset Group */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 font-mono">
                          Connected Brands ({brands.length})
                        </span>
                        {(profileRole === 'owner' || userPermissions.includes('settings')) && (
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
                        )}
                      </div>

                      <div className="p-3 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-wrap gap-1.5">
                        {brands.length === 0 ? (
                          <div className="w-full py-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground italic">No brands connected yet</span>
                            {(profileRole === 'owner' || userPermissions.includes('settings')) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMobileMenuOpen(false)
                                  setIsBrandModalOpen(true)
                                }}
                                className="text-xs font-bold text-primary hover:underline cursor-pointer"
                              >
                                + Create Brand
                              </button>
                            )}
                          </div>
                        ) : (
                          brands.map((b) => (
                            <span
                              key={b.id}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-muted/60 border border-border/70 text-foreground/80 flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                              <span>{b.name}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer Status & Sign Out */}
                  <div className="p-4 border-t border-border/70 space-y-2 bg-muted/20">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsMobileMenuOpen(false)
                        try {
                          localStorage.removeItem('kitchflow_active_staff_name')
                          localStorage.removeItem('kitchflow_active_staff_role')
                          localStorage.removeItem('kitchflow_active_staff_permissions')
                        } catch {}
                        await signOutFromSupabase()
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out from Kitchen Station</span>
                    </button>
                    <p className="text-[10px] text-muted-foreground font-mono text-center">
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

            {!(profileRole === 'owner' || profileRole === 'manager' || userPermissions.includes('orders')) && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                Storefront pause controls require Store Manager or Owner authorization.
              </div>
            )}

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
                  disabled={!(profileRole === 'owner' || profileRole === 'manager' || userPermissions.includes('orders'))}
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
                  disabled={!(profileRole === 'owner' || profileRole === 'manager' || userPermissions.includes('orders'))}
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
              disabled={!(profileRole === 'owner' || profileRole === 'manager' || userPermissions.includes('orders'))}
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

      {/* Dispatch QA Verification Checklist Configuration Modal */}
      <DispatchChecklistConfigModal
        open={isDispatchChecklistOpen}
        onOpenChange={setIsDispatchChecklistOpen}
        menuItems={menuItems}
      />

      {/* Add Kitchen Outlet Modal */}
      <AddKitchenModal
        open={isAddKitchenOpen}
        onOpenChange={setIsAddKitchenOpen}
        onKitchenCreated={(kId, kName) => {
          selectOutlet(kId, kName);
        }}
      />
    </>
  )
}
