'use client'

import React, { useState, useEffect } from 'react'
import { Ingredient } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EditIngredientCostModalProps {
  ingredient: Ingredient | null
  onClose: () => void
  onUpdateIngredientCost?: (ingredientId: string, newCost: number) => void
}

export function EditIngredientCostModal({
  ingredient,
  onClose,
  onUpdateIngredientCost,
}: EditIngredientCostModalProps) {
  const [costInput, setCostInput] = useState<string>('')

  useEffect(() => {
    if (ingredient) {
      setCostInput(ingredient.costPerUnit.toString())
    }
  }, [ingredient])

  if (!ingredient) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cost = parseFloat(costInput)
    if (!isNaN(cost) && onUpdateIngredientCost) {
      onUpdateIngredientCost(ingredient.id, cost)
    }
    onClose()
  }

  return (
    <Dialog open={Boolean(ingredient)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Update Ingredient Cost
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {ingredient.name} &bull; Unit: <span className="font-mono font-semibold">{ingredient.unit}</span>
            </p>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            Update your supplier purchase cost per {ingredient.unit}. Changes automatically recalculate recipe BOM food margins across all brands.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-unit-cost" className="text-xs font-semibold">
              Cost per {ingredient.unit} (₹)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₹
              </span>
              <Input
                id="edit-unit-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.15"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                required
                className="h-11 pl-8 text-base font-mono font-bold bg-background rounded-xl border-border/80"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                /{ingredient.unit}
              </span>
            </div>
          </div>

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
              Save Cost
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

