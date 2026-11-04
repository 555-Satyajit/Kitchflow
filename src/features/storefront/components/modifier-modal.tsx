'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StorefrontDish, StorefrontModifierOption } from '../types'
import { formatCurrency } from '@/lib/utils'
import { Check, Plus, Sparkles } from 'lucide-react'

interface ModifierModalProps {
  dish: StorefrontDish | null
  isOpen: boolean
  onClose: () => void
  onAddToCart: (
    dish: StorefrontDish,
    quantity: number,
    selectedModifiers: {
      groupId: string
      groupName: string
      optionId: string
      optionName: string
      price: number
    }[],
    specialInstructions: string
  ) => void
}

export function ModifierModal({
  dish,
  isOpen,
  onClose,
  onAddToCart,
}: ModifierModalProps) {
  if (!dish) return null

  // Café / Quick Service Modifier groups customized by station
  const isBeverage = dish.station === 'BEVERAGE'
  const isFood = !isBeverage

  const milkOptions: StorefrontModifierOption[] = [
    { id: 'whole', name: 'Whole Dairy Milk', price: 0 },
    { id: 'oat', name: 'Oat Milk (Oatly)', price: 45 },
    { id: 'almond', name: 'Almond Milk', price: 40 },
    { id: 'skim', name: 'Low-Fat Skim Milk', price: 0 },
  ]

  const sweetOptions: StorefrontModifierOption[] = [
    { id: 'reg_sweet', name: 'Standard Sweetness', price: 0 },
    { id: 'low_sweet', name: 'Less Sweet (50%)', price: 0 },
    { id: 'no_sweet', name: 'Unsweetened (0%)', price: 0 },
    { id: 'vanilla', name: 'Madagascar Vanilla Syrup', price: 35 },
    { id: 'caramel', name: 'Salted Caramel Drizzle', price: 35 },
  ]

  const foodAddons: StorefrontModifierOption[] = [
    { id: 'extra_cheese', name: 'Extra Melted Cheese', price: 40 },
    { id: 'spicy_dip', name: 'Smoked Ghost Pepper Dip', price: 30 },
    { id: 'fried_egg', name: 'Crispy Fried Farm Egg', price: 35 },
  ]

  const [selectedMilk, setSelectedMilk] = useState<StorefrontModifierOption>(
    milkOptions[0]
  )
  const [selectedSweet, setSelectedSweet] = useState<StorefrontModifierOption>(
    sweetOptions[0]
  )
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [instructions, setInstructions] = useState('')
  const [quantity, setQuantity] = useState(1)

  // Calculate live total price per item
  let addonPrice = 0
  if (isBeverage) {
    addonPrice += selectedMilk.price + selectedSweet.price
  } else {
    selectedAddons.forEach((addonId) => {
      const match = foodAddons.find((a) => a.id === addonId)
      if (match) addonPrice += match.price
    })
  }
  const itemUnitPrice = dish.sellingPrice + addonPrice
  const totalAmount = itemUnitPrice * quantity

  const handleConfirm = () => {
    const formattedModifiers = []

    if (isBeverage) {
      if (selectedMilk.price > 0 || selectedMilk.id !== 'whole') {
        formattedModifiers.push({
          groupId: 'milk',
          groupName: 'Milk Choice',
          optionId: selectedMilk.id,
          optionName: selectedMilk.name,
          price: selectedMilk.price,
        })
      }
      if (selectedSweet.price > 0 || selectedSweet.id !== 'reg_sweet') {
        formattedModifiers.push({
          groupId: 'sweetness',
          groupName: 'Sweetness / Flavour',
          optionId: selectedSweet.id,
          optionName: selectedSweet.name,
          price: selectedSweet.price,
        })
      }
    } else {
      selectedAddons.forEach((id) => {
        const option = foodAddons.find((a) => a.id === id)
        if (option) {
          formattedModifiers.push({
            groupId: 'addons',
            groupName: 'Extra Add-ons',
            optionId: option.id,
            optionName: option.name,
            price: option.price,
          })
        }
      })
    }

    onAddToCart(dish, quantity, formattedModifiers, instructions.trim())
    onClose()
  }

  const toggleFoodAddon = (id: string) => {
    if (selectedAddons.includes(id)) {
      setSelectedAddons(selectedAddons.filter((a) => a !== id))
    } else {
      setSelectedAddons([...selectedAddons, id])
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="sm:max-w-md w-full max-h-[85vh] p-0 flex flex-col rounded-3xl overflow-hidden bg-background/95 backdrop-blur-2xl border-border/60 shadow-2xl">
        <DialogHeader className="p-4.5 pb-3 border-b border-border/40 text-left bg-muted/20">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                dish.dietary === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <DialogTitle className="text-base font-bold tracking-tight text-foreground line-clamp-1">
              {dish.name}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 pt-0.5">
            {dish.description || 'Crafted fresh upon order.'}
          </p>
        </DialogHeader>

        {/* Scrollable Modifier Options */}
        <div className="flex-1 overflow-y-auto p-4.5 space-y-5 text-sm">
          {isBeverage ? (
            <>
              {/* Milk Selection (Single Choice) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground tracking-wide uppercase font-mono">
                    Choice of Milk
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-medium">
                    Required
                  </span>
                </div>
                <div className="space-y-1.5">
                  {milkOptions.map((opt) => {
                    const isSelected = selectedMilk.id === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedMilk(opt)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                            : 'border-border/60 bg-card hover:bg-muted/40 text-foreground'
                        }`}
                      >
                        <span className="text-xs font-medium">{opt.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-muted-foreground">
                            {opt.price > 0 ? `+${formatCurrency(opt.price)}` : 'Free'}
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sweetness / Syrup Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground tracking-wide uppercase font-mono">
                    Sweetness & Syrups
                  </span>
                </div>
                <div className="space-y-1.5">
                  {sweetOptions.map((opt) => {
                    const isSelected = selectedSweet.id === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedSweet(opt)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                            : 'border-border/60 bg-card hover:bg-muted/40 text-foreground'
                        }`}
                      >
                        <span className="text-xs font-medium">{opt.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-muted-foreground">
                            {opt.price > 0 ? `+${formatCurrency(opt.price)}` : 'Free'}
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Food Extra Add-ons (Multi-Choice) */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground tracking-wide uppercase font-mono">
                  Extra Add-ons & Sides
                </span>
                <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-medium">
                  Optional
                </span>
              </div>
              <div className="space-y-1.5">
                {foodAddons.map((opt) => {
                  const isChecked = selectedAddons.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleFoodAddon(opt.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                          : 'border-border/60 bg-card hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <span className="text-xs font-medium">{opt.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-muted-foreground">
                          +{formatCurrency(opt.price)}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isChecked
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Kitchen Note */}
          <div className="space-y-1.5 pt-1">
            <span className="font-semibold text-xs text-foreground tracking-wide uppercase font-mono">
              Cooking Instructions
            </span>
            <input
              type="text"
              placeholder="e.g. Less ice, extra hot, dressing separate..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-border/80 bg-background/80 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-border/40 bg-card/80 backdrop-blur-md flex items-center gap-3">
          {/* Quantity Pill */}
          <div className="flex items-center gap-2.5 border border-border/60 rounded-2xl p-1 bg-background/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted active:scale-95 text-foreground font-bold"
            >
              -
            </button>
            <span className="text-xs font-bold font-mono w-4 text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-muted active:scale-95 text-foreground font-bold"
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <Button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-11 rounded-2xl text-xs font-semibold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-between px-4"
          >
            <span>Add Item</span>
            <span className="font-mono font-bold">
              {formatCurrency(totalAmount)}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

