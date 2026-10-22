'use client'

import React, { useState } from 'react'
import { Ingredient } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  Trash2, 
  AlertTriangle, 
  Check, 
  Flame, 
  FileText 
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
    'Trim / prep prep loss excess',
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6 rounded-2xl">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" />
            <span>Shift Wastage & Spoilage Log</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Quickly log kitchen food waste to maintain accurate stock counts and capture kitchen leakage.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <p className="text-sm font-bold text-foreground">Wastage Recorded</p>
            <p className="text-xs text-muted-foreground">Stock updated & audit entry written to ledger.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 py-1 text-xs">
            {/* Ingredient Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="waste-ing">Wasted Ingredient SKU</Label>
              <select
                id="waste-ing"
                value={selectedIngId}
                onChange={(e) => setSelectedIngId(e.target.value)}
                className="w-full h-10 rounded-lg border border-input bg-transparent px-3 text-xs font-semibold"
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
                <Label htmlFor="loss-qty">Quantity Lost / Dumped</Label>
                {selectedIngredient && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Unit: <strong>{selectedIngredient.unit}</strong>
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
                  className="font-mono font-bold text-sm h-10"
                />
                <div className="w-20 shrink-0 h-10 border border-border rounded-lg bg-muted/40 flex items-center justify-center font-mono font-bold text-xs text-muted-foreground">
                  {selectedIngredient?.unit || 'unit'}
                </div>
              </div>
            </div>

            {/* Quick Reason Presets */}
            <div className="space-y-1.5">
              <Label htmlFor="waste-note">Reason for Wastage</Label>
              <Input
                id="waste-note"
                placeholder="Reason for waste..."
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                required
                className="text-xs h-9"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {commonLossNotes.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLossReason(preset)}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer font-medium"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Financial Impact Preview */}
            {estimatedCostLoss > 0 && (
              <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-destructive font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Financial Loss (COGS):</span>
                </div>
                <span className="font-mono font-black text-destructive text-sm">
                  {formatCurrency(estimatedCostLoss)}
                </span>
              </div>
            )}

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                className="w-full sm:w-auto text-xs font-bold"
              >
                Record Wastage
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
