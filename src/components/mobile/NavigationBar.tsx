'use client'

import React from 'react'
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

  // Completely isolate public customer invoice pages
  if (pathname?.startsWith('/invoice')) {
    return null
  }

  const { orders, ingredients, userRole } = useKitchen()

  const kdsPendingCount = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length
  const packingPendingCount = orders.filter((o) => o.status === 'PREPARING' || o.status === 'READY').length
  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minThreshold).length

  interface NavTab {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    roleRequired?: string
  }

  const rawTabs: NavTab[] = [
    { href: '/orders', label: 'Live Queue', icon: ClipboardList, badge: orders.length, roleRequired: 'OWNER' },
    { href: '/kds', label: 'KDS Cook', icon: Flame, badge: kdsPendingCount },
    { href: '/packing', label: 'Dispatch', icon: PackageCheck, badge: packingPendingCount },
    { href: '/inventory', label: 'Inventory', icon: Boxes, badge: lowStockCount, roleRequired: 'OWNER' },
    { href: '/margins', label: 'Margins', icon: TrendingUp, roleRequired: 'OWNER' },
  ]

  const tabs = rawTabs.filter((t) => !t.roleRequired || t.roleRequired === userRole)

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
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span 
                    className={cn(
                      "absolute -top-1 -right-2.5 h-4 min-w-[16px] px-1 text-[9px] font-mono leading-none flex items-center justify-center rounded-full font-bold shadow-2xs",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted-foreground/30 text-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
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
