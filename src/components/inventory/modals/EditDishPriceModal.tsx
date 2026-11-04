'use client'

import React, { useState, useEffect } from 'react'
import { MenuItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EditDishPriceModalProps {
  item: MenuItem | null
  onClose: () => void
  onUpdateMenuItemPrice?: (menuItemId: string, newSellingPrice: number, newPackagingCost?: number) => void
}

export function EditDishPriceModal({
  item,
  onClose,
  onUpdateMenuItemPrice,
}: EditDishPriceModalProps) {
  const [sellingPriceInput, setSellingPriceInput] = useState<string>('')
  const [pkgCostInput, setPkgCostInput] = useState<string>('')

  useEffect(() => {
    if (item) {
      setSellingPriceInput(item.sellingPrice.toString())
      setPkgCostInput(item.packagingCost.toString())
    }
  }, [item])

  if (!item) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(sellingPriceInput)
    const pkg = parseFloat(pkgCostInput)
    if (!isNaN(price) && onUpdateMenuItemPrice) {
      onUpdateMenuItemPrice(item.id, price, isNaN(pkg) ? undefined : pkg)
    }
    onClose()
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Adjust Selling Price & Packaging
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {item.name}
            </p>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            Adjust customer menu selling price and delivery packaging fee. Updates immediately sync across live orders and financial reports.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-dish-price" className="text-xs font-semibold">
                Selling Price (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="edit-dish-price"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="249"
                  value={sellingPriceInput}
                  onChange={(e) => setSellingPriceInput(e.target.value)}
                  required
                  className="h-11 pl-7 text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-pkg-cost" className="text-xs font-semibold">
                Packaging Fee (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="edit-pkg-cost"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="15"
                  value={pkgCostInput}
                  onChange={(e) => setPkgCostInput(e.target.value)}
                  required
                  className="h-11 pl-7 text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                />
              </div>
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
              Save Price
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

