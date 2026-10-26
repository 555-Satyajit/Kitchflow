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
import { Badge } from '@/components/ui/badge'

export function NavigationBar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const { orders, isOrdersLoaded, navCounts, ingredients, userRole } = useKitchen()

  useEffect(() => {
    setMounted(true)
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

  // Dual-source conditional evaluation:
  // If active page has populated context orders, derive dynamic filtered counts.
  // Otherwise, fall back directly to authoritative recovery navCounts from PostgreSQL.
  const liveOrderCount = orders.length > 0 ? orders.length : (navCounts?.ordersCount ?? 0)
  const kdsPendingCount = orders.length > 0 
    ? orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length
    : (navCounts?.kdsCount ?? 0)
  const packingPendingCount = orders.length > 0
    ? orders.filter((o) => o.status === 'PREPARING' || o.status === 'READY').length
    : (navCounts?.packingCount ?? 0)
  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minThreshold).length

  const isNavReady = mounted && (isOrdersLoaded || navCounts !== null)

  interface NavTab {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    isDynamic?: boolean
    roleRequired?: string
  }

  const rawTabs: NavTab[] = [
    { href: '/orders', label: 'Live Queue', icon: ClipboardList, badge: liveOrderCount, isDynamic: true, roleRequired: 'OWNER' },
    { href: '/kds', label: 'KDS Cook', icon: Flame, badge: kdsPendingCount, isDynamic: true },
    { href: '/packing', label: 'Dispatch', icon: PackageCheck, badge: packingPendingCount, isDynamic: true },
    { href: '/inventory', label: 'Inventory', icon: Boxes, badge: lowStockCount, isDynamic: false, roleRequired: 'OWNER' },
    { href: '/margins', label: 'Margins', icon: TrendingUp, isDynamic: false, roleRequired: 'OWNER' },
  ]

  // Filter tabs by userRole only after mount to prevent SSR/client hydration differences if userRole differs
  const effectiveRole = mounted ? userRole : 'OWNER'
  const tabs = rawTabs.filter((t) => !t.roleRequired || t.roleRequired === effectiveRole)

  if (pathname === '/login') return null

  return (
    /* Visible on mobile, tablets, and iPads. Hidden on laptops & desktops (lg:hidden) */
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/60 px-3 sm:px-6 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-xs">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
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
                {tab.isDynamic && !isNavReady ? (
                  <span className="absolute -top-1 -right-2.5 h-3.5 w-4 rounded-full bg-muted animate-pulse" />
                ) : Boolean(tab.badge && tab.badge > 0) ? (
                  <span 
                    className={cn(
                      "absolute -top-1 -right-2.5 h-4 min-w-[16px] px-1 text-[9px] font-mono leading-none flex items-center justify-center rounded-full font-bold shadow-2xs transition-transform animate-in fade-in duration-200",
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
                "text-[10px] mt-1 tracking-tight leading-none transition-colors",
                isActive ? "font-bold text-primary" : "font-medium text-muted-foreground"
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
