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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border/80 px-2 sm:px-4 py-2 safe-area-pb shadow-lg">
      <div className="max-w-xl mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || (pathname === '/' && tab.href === '/orders')

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative min-h-[52px]",
                isActive 
                  ? "text-primary font-bold bg-primary/10 shadow-2xs" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5]" : "stroke-[1.8]")} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <Badge 
                    variant={isActive ? "default" : "secondary"}
                    className={cn(
                      "absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[9px] font-mono leading-none flex items-center justify-center rounded-full font-bold",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-foreground"
                    )}
                  >
                    {tab.badge}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight leading-none font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
