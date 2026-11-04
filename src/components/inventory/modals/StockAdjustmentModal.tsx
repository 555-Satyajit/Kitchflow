'use client'

import React, { useState, useEffect } from 'react'
import { Ingredient, StockReasonCode } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface StockAdjustmentModalProps {
  ingredient: Ingredient | null
  onClose: () => void
  onAdjustStockWithReason: (ingredientId: string, delta: number, reason: StockReasonCode, note?: string) => void
}

export function StockAdjustmentModal({
  ingredient,
  onClose,
  onAdjustStockWithReason,
}: StockAdjustmentModalProps) {
  const [adjustDelta, setAdjustDelta] = useState<string>('-10')
  const [adjustReason, setAdjustReason] = useState<StockReasonCode>('WASTAGE_SPOILAGE')
  const [adjustNote, setAdjustNote] = useState<string>('')

  useEffect(() => {
    if (ingredient) {
      setAdjustDelta('-1')
      setAdjustReason('WASTAGE_SPOILAGE')
      setAdjustNote('')
    }
  }, [ingredient])

  if (!ingredient) return null

  const getUnitPresets = (unit: string) => {
    if (unit === 'pc') {
      return [
        { label: '-1 pc', delta: -1, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '-5 pc', delta: -5, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '+10 pc', delta: 10, reason: 'PURCHASE_INFLOW' as StockReasonCode },
        { label: '+50 pc', delta: 50, reason: 'PURCHASE_INFLOW' as StockReasonCode },
      ]
    }
    if (unit === 'g') {
      return [
        { label: '-100g', delta: -100, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '-500g', delta: -500, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '+1kg', delta: 1000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
        { label: '+5kg', delta: 5000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
      ]
    }
    return [
      { label: '-100ml', delta: -100, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
      { label: '-500ml', delta: -500, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
      { label: '+1L', delta: 1000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
      { label: '+5L', delta: 5000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
    ]
  }

  const handleCommitAdjustment = (e: React.FormEvent) => {
    e.preventDefault()
    const deltaNum = parseFloat(adjustDelta)
    if (isNaN(deltaNum) || deltaNum === 0) return

    onAdjustStockWithReason(ingredient.id, deltaNum, adjustReason, adjustNote.trim() || undefined)
    onClose()
  }

  return (
    <Dialog open={Boolean(ingredient)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
        <form onSubmit={handleCommitAdjustment} className="space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Stock Adjustment
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {ingredient.name} &bull; Unit: <span className="font-mono font-semibold">{ingredient.unit}</span>
            </p>
          </DialogHeader>

          {/* Current Stock Banner */}
          <div className="p-3 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Current Stockroom:</span>
            <span className="text-sm font-bold font-mono text-foreground">
              {ingredient.currentStock} {ingredient.unit}
            </span>
          </div>

          {/* Quick Preset Buttons for 1-Tap Mobile Kitchen Use */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Quick Delta Presets:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {getUnitPresets(ingredient.unit).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setAdjustDelta(preset.delta.toString())
                    setAdjustReason(preset.reason)
                  }}
                  className={cn(
                    "py-1.5 px-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer text-center active:scale-[0.97]",
                    adjustDelta === preset.delta.toString()
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                      : "bg-background/80 hover:bg-muted text-foreground border-border/70"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Adjustment Delta Input */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-delta" className="text-xs font-semibold">
              Adjustment Quantity ({ingredient.unit})
            </Label>
            <div className="relative">
              <Input
                id="adj-delta"
                type="number"
                step="any"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                required
                className="h-10 text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                placeholder="e.g. -500 or +1000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                {ingredient.unit}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use negative values (e.g., -5) for wastage/prep; positive for restocking.
            </p>
          </div>

          {/* Reason Code Dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason" className="text-xs font-semibold">
              Audit Reason Code
            </Label>
            <select
              id="adj-reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value as StockReasonCode)}
              className="w-full h-10 rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="WASTAGE_SPOILAGE" className="bg-background text-foreground">
                Wastage / Spoilage / Burnt Food
              </option>
              <option value="AUDIT_CORRECTION" className="bg-background text-foreground">
                Physical Inventory Audit Correction
              </option>
              <option value="PURCHASE_INFLOW" className="bg-background text-foreground">
                Supplier Purchase / Stock Inflow
              </option>
              <option value="RECIPE_AUTO_CONSUMPTION" className="bg-background text-foreground">
                Manual Kitchen Prep Consumption
              </option>
            </select>
          </div>

          {/* Staff Remark */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-note" className="text-xs font-semibold">
              Staff Remark (Optional)
            </Label>
            <Input
              id="adj-note"
              placeholder="e.g. Expired batch or box #204"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              className="h-10 text-xs bg-background rounded-xl border-border/80"
            />
          </div>

          {/* Apple HIG Action Footer: Cancel + Confirm */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              Record in Ledger
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

