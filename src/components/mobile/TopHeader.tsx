'use client'

import React from 'react'
import { AlertOctagon, CheckCircle2 } from 'lucide-react'

interface TopHeaderProps {
  isPausedAll: boolean
  onTogglePauseAll: () => void
  activeBrandsCount: number
}

export function TopHeader({
  isPausedAll,
  onTogglePauseAll,
  activeBrandsCount,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="text-white font-black text-sm">K</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white leading-tight flex items-center gap-1.5">
              KitchenOS
              <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-1.5 py-0.5 rounded border border-slate-700">
                {activeBrandsCount} Brands
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Real-Time Kitchen Feed</p>
          </div>
        </div>

        {/* Emergency Pause All Trigger */}
        <button
          onClick={onTogglePauseAll}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 touch-target ${
            isPausedAll
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              : 'bg-slate-800 text-slate-200 border border-slate-700 hover:border-red-500/50 hover:text-red-400'
          }`}
        >
          <AlertOctagon className={`w-4 h-4 ${isPausedAll ? 'text-red-400' : 'text-slate-400'}`} />
          <span>{isPausedAll ? 'PAUSED ALL' : 'PAUSE ALL'}</span>
        </button>
      </div>
    </header>
  )
}
