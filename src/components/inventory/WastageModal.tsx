'use client'

import React, { useState } from 'react'
import { Ingredient } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  Trash2, 
  AlertTriangle, 
  Check, 
  Flame, 
  Scale,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface WastageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredients: Ingredient[]
  onRecordWastage: (ingredientId: string, lossQty: number, note: string) => void
}

export function WastageModal({
  open,
  onOpenChange,
  ingredients,
  onRecordWastage,
}: WastageModalProps) {
  const [selectedIngId, setSelectedIngId] = useState<string>(ingredients[0]?.id || '')
  const [lossAmount, setLossAmount] = useState<string>('500')
  const [lossReason, setLossReason] = useState<string>('Burnt during cook rush')
  const [isSuccess, setIsSuccess] = useState(false)

  const selectedIngredient = ingredients.find((i) => i.id === selectedIngId) || ingredients[0]

  const lossNum = parseFloat(lossAmount) || 0
  const estimatedCostLoss = selectedIngredient ? lossNum * selectedIngredient.costPerUnit : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIngredient || lossNum <= 0) return

    onRecordWastage(selectedIngredient.id, lossNum, lossReason.trim())
    setIsSuccess(true)
    setTimeout(() => {
      setIsSuccess(false)
      onOpenChange(false)
    }, 900)
  }

  // Common quick presets
  const commonLossNotes = [
    'Burnt on tawa / fryer rush',
    'Fell on kitchen floor',
    'Expired / sour milk or curd',
    'Trim / prep loss excess',
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl space-y-4">
        <DialogHeader className="text-left space-y-1.5 pb-1 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center shrink-0 shadow-inner">
              <Trash2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                Shift Wastage & Spoilage Log
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-0.5">
            Quickly log kitchen food waste to maintain accurate stock counts and capture kitchen leakage.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center shadow-inner">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <p className="text-sm font-bold text-foreground">Wastage Recorded</p>
            <p className="text-xs text-muted-foreground">Stock updated & audit entry written to ledger.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-1 text-xs">
            {/* Ingredient Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="waste-ing" className="text-xs font-semibold text-foreground">
                Wasted Ingredient SKU
              </Label>
              <select
                id="waste-ing"
                value={selectedIngId}
                onChange={(e) => setSelectedIngId(e.target.value)}
                className="w-full h-11 rounded-xl border border-border/80 bg-background px-3 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-destructive/20 shadow-2xs transition-all"
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id} className="bg-background text-foreground">
                    {ing.name} (In Stock: {ing.currentStock} {ing.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity Wasted */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="loss-qty" className="text-xs font-semibold text-foreground">
                  Quantity Lost / Dumped
                </Label>
                {selectedIngredient && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Unit: <strong className="text-foreground">{selectedIngredient.unit}</strong>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="loss-qty"
                  type="number"
                  placeholder="0"
                  value={lossAmount}
                  onChange={(e) => setLossAmount(e.target.value)}
                  required
                  min="0.1"
                  step="any"
                  className="font-mono font-extrabold text-sm h-11 rounded-xl bg-background border-border/80 text-foreground"
                />
                <div className="w-20 shrink-0 h-11 border border-border/80 rounded-xl bg-muted/40 flex items-center justify-center font-mono font-bold text-xs text-muted-foreground shadow-2xs">
                  {selectedIngredient?.unit || 'unit'}
                </div>
              </div>
            </div>

            {/* Quick Reason Presets */}
            <div className="space-y-2">
              <Label htmlFor="waste-note" className="text-xs font-semibold text-foreground">
                Reason for Wastage
              </Label>
              <Input
                id="waste-note"
                placeholder="Reason for waste..."
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                required
                className="text-xs h-10 rounded-xl bg-background border-border/80 text-foreground"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {commonLossNotes.map((preset) => {
                  const isSelected = lossReason === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLossReason(preset)}
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-lg border cursor-pointer font-medium active:scale-95 transition-all shadow-2xs",
                        isSelected
                          ? "bg-destructive/15 text-destructive border-destructive/30 font-bold"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                      )}
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cost Financial Impact Preview (Apple Inset Alert) */}
            {estimatedCostLoss > 0 && (
              <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-destructive font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Financial Loss (COGS):</span>
                </div>
                <span className="font-mono font-extrabold text-destructive text-base">
                  {formatCurrency(estimatedCostLoss)}
                </span>
              </div>
            )}

            <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted/50 active:scale-[0.98] transition-all"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="w-full sm:flex-1 h-11 rounded-xl text-xs font-bold shadow-destructive/20 active:scale-[0.98] transition-all gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Record Wastage</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

