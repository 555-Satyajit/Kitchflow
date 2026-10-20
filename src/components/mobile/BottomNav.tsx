'use client'

import React from 'react'
import { 
  ClipboardList, 
  Flame, 
  PackageCheck, 
  Boxes, 
  TrendingUp, 
  AlertTriangle 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TabType = 'orders' | 'kds' | 'packing' | 'inventory' | 'margins'

interface BottomNavProps {
  currentTab: TabType
  onSelectTab: (tab: TabType) => void
  ordersCount: number
  kdsPendingCount: number
  packingPendingCount: number
  lowStockCount: number
}

export function BottomNav({
  currentTab,
  onSelectTab,
  ordersCount,
  kdsPendingCount,
  packingPendingCount,
  lowStockCount,
}: BottomNavProps) {
  interface NavTab {
    id: TabType
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    badgeColor?: string
  }

  const tabs: NavTab[] = [
    { id: 'orders', label: 'Queue', icon: ClipboardList, badge: ordersCount },
    { id: 'kds', label: 'KDS', icon: Flame, badge: kdsPendingCount },
    { id: 'packing', label: 'Pack', icon: PackageCheck, badge: packingPendingCount },
    { id: 'inventory', label: 'Stock', icon: Boxes, badge: lowStockCount, badgeColor: 'bg-red-500' },
    { id: 'margins', label: 'Profit', icon: TrendingUp },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 safe-area-pb">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = currentTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as TabType)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative touch-target",
                isActive 
                  ? "text-orange-400 bg-orange-500/10 font-bold" 
                  : "text-slate-400 hover:text-slate-200 active:scale-95"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2 text-[10px] text-white font-extrabold px-1.5 py-0.2 rounded-full min-w-[16px] text-center",
                      tab.badgeColor || "bg-orange-600"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
