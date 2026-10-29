'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ClipboardList, 
  Flame, 
  PackageCheck, 
  Boxes, 
  TrendingUp 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useKitchen } from '@/context/KitchenContext'
import { useNavCounts } from '@/hooks/useNavCounts'
import { useOutlets } from '@/hooks/useOutlets'
import { NavCountsResult } from '@/features/orders/order-actions'

export interface NavigationBarProps {
  initialRole?: 'owner' | 'manager' | 'kitchen_staff';
  initialPermissions?: string[];
  initialNavCounts?: NavCountsResult;
}

export function NavigationBar({
  initialRole,
  initialPermissions,
  initialNavCounts,
}: NavigationBarProps = {}) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const { orders, isOrdersLoaded, navCounts, ingredients } = useKitchen()

  const { activeOutletId } = useOutlets()

  const [profileRole, setProfileRole] = useState<'owner' | 'manager' | 'kitchen_staff'>(
    initialRole || 'owner'
  )
  const [userPermissions, setUserPermissions] = useState<string[]>(
    initialPermissions || ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings']
  )

  // TanStack Query authoritative real-time nav counts synced with activeOutletId
  const { data: tanstackCounts } = useNavCounts(activeOutletId, initialNavCounts || navCounts)

  useEffect(() => {
    setMounted(true)

    try {
      const activeStaffRole = localStorage.getItem('kitchflow_active_staff_role')
      const activeStaffPerms = localStorage.getItem('kitchflow_active_staff_permissions')

      if (activeStaffRole) {
        setProfileRole(activeStaffRole as any)
      }

      if (activeStaffPerms) {
        try {
          const parsed = JSON.parse(activeStaffPerms)
          if (Array.isArray(parsed)) {
            setUserPermissions(parsed)
          }
        } catch {}
      }
    } catch (e) {}
  }, [])

  // Completely isolate public customer invoice pages, auth pages, and internal team onboarding portal
  if (
    pathname?.startsWith('/invoice') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/auth')
  ) {
    return null
  }

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

  const isNavReady = isOrdersLoaded || orders.length > 0 || authoritativeCounts !== null

  interface NavTab {
    href: string
    permission: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    isDynamic?: boolean
  }

  const rawTabs: NavTab[] = [
    { href: '/orders', permission: 'orders', label: 'Live Queue', icon: ClipboardList, badge: liveOrderCount, isDynamic: true },
    { href: '/kds', permission: 'kds', label: 'KDS Cook', icon: Flame, badge: kdsPendingCount, isDynamic: true },
    { href: '/packing', permission: 'packing', label: 'Dispatch', icon: PackageCheck, badge: packingPendingCount, isDynamic: true },
    { href: '/inventory', permission: 'inventory', label: 'Inventory', icon: Boxes, badge: lowStockCount, isDynamic: false },
    { href: '/margins', permission: 'margins', label: 'Margins', icon: TrendingUp, isDynamic: false },
  ]

  // Filter tabs dynamically by staff permissions or owner bypass
  const tabs = rawTabs.filter((t) => {
    if (profileRole === 'owner') return true
    return userPermissions.includes(t.permission)
  })

  if (pathname === '/login') return null

  return (
    /* Visible on mobile, tablets, and iPads. Hidden on laptops & desktops (lg:hidden) */
    <nav 
      suppressHydrationWarning
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/60 px-3 sm:px-6 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-xs"
    >
      <div 
        className={cn(
          "max-w-md mx-auto grid gap-0.5",
          tabs.length === 5 ? "grid-cols-5" :
          tabs.length === 4 ? "grid-cols-4" :
          tabs.length === 3 ? "grid-cols-3" :
          tabs.length === 2 ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || (pathname === '/' && tab.href === '/orders')

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 rounded-xl transition-colors duration-150 relative min-h-[46px]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground/80 hover:text-foreground"
              )}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={cn("w-5 h-5 transition-transform duration-150", isActive ? "stroke-[2.4] scale-105" : "stroke-[1.8]")} />
                {mounted && Boolean(tab.badge && tab.badge > 0) ? (
                  <span 
                    className={cn(
                      "absolute -top-1 -right-2.5 h-4 min-w-[16px] px-1 text-[9px] font-mono leading-none flex items-center justify-center rounded-full font-bold shadow-2xs transition-transform animate-in fade-in duration-150",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted-foreground/30 text-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={cn(
                "text-[10px] mt-1 font-medium tracking-tight truncate max-w-[64px]",
                isActive ? "font-bold text-primary" : "text-muted-foreground"
              )}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
