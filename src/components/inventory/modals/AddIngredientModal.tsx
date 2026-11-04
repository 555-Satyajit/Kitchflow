'use client'

import React, { useState } from 'react'
import { Brand, Ingredient, InventoryCategory, StorageZone } from '@/types'
import { Store, PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface AddIngredientModalProps {
  brands: Brand[]
  onAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}

export function AddIngredientModal({
  brands,
  onAddIngredient,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: AddIngredientModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setIsOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen

  const [newIngName, setNewIngName] = useState('')
  const [newIngBrandId, setNewIngBrandId] = useState<string>('SHARED')
  const [newIngCategory, setNewIngCategory] = useState<InventoryCategory>('DRY_STAPLES')
  const [newIngSupplier, setNewIngSupplier] = useState<string>('')
  const [newIngStorageZone, setNewIngStorageZone] = useState<StorageZone>('DRY_STORE')
  const [newIngUnit, setNewIngUnit] = useState<'g' | 'ml' | 'pc' | 'kg' | 'l'>('g')
  const [newIngStock, setNewIngStock] = useState('1000')
  const [newIngThreshold, setNewIngThreshold] = useState('300')
  const [newIngCost, setNewIngCost] = useState('0.25')

  const handleCreateIngredient = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIngName.trim()) return

    onAddIngredient({
      brandId: newIngBrandId === 'SHARED' ? undefined : newIngBrandId,
      name: newIngName.trim(),
      category: newIngCategory,
      supplierName: newIngSupplier.trim() || undefined,
      storageZone: newIngStorageZone,
      unit: newIngUnit,
      currentStock: parseFloat(newIngStock) || 500,
      minThreshold: parseFloat(newIngThreshold) || 100,
      costPerUnit: parseFloat(newIngCost) || 0.1,
    })

    setNewIngName('')
    setNewIngSupplier('')
    setNewIngCategory('DRY_STAPLES')
    setNewIngStorageZone('DRY_STORE')
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial text-xs h-9 px-3 rounded-xl gap-1.5 font-semibold border-border/80 bg-background/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
          >
            <PackagePlus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>+ Raw SKU</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 overflow-y-auto rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
        <form onSubmit={handleCreateIngredient} className="space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Add Raw Ingredient SKU
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Register a new kitchen stock item and set its minimum Auto-86 threshold
            </p>
          </DialogHeader>

          <div className="space-y-3.5 py-1 text-xs">
            {/* Ingredient Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ing-name" className="text-xs font-semibold">
                Ingredient Name
              </Label>
              <Input
                id="ing-name"
                placeholder="e.g. Paneer Cubes / Tandoori Mayo"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                required
                className="h-10 text-xs sm:text-sm bg-background rounded-xl border-border/80"
              />
            </div>

            {/* Brand Allocation */}
            <div className="space-y-1.5">
              <Label htmlFor="ing-brand" className="text-xs font-semibold flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-primary" />
                <span>Brand Allocation</span>
              </Label>
              <Select value={newIngBrandId} onValueChange={setNewIngBrandId}>
                <SelectTrigger id="ing-brand" className="w-full h-10 rounded-xl border border-border/80 bg-background text-xs font-medium">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                  <SelectItem value="SHARED" className="text-xs font-semibold">
                    Shared Kitchen Inventory (All Brands)
                  </SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name} (Exclusive)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category & Storage Zone Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ing-cat" className="text-xs font-semibold">
                  Category
                </Label>
                <Select value={newIngCategory} onValueChange={(val) => setNewIngCategory(val as InventoryCategory)}>
                  <SelectTrigger id="ing-cat" className="w-full h-10 rounded-xl border border-border/80 bg-background text-xs font-medium">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                    <SelectItem value="DRY_STAPLES" className="text-xs">Dry Staples & Spices</SelectItem>
                    <SelectItem value="PRODUCE_DAIRY" className="text-xs">Dairy & Fresh Produce</SelectItem>
                    <SelectItem value="MEAT_POULTRY" className="text-xs">Meat & Poultry</SelectItem>
                    <SelectItem value="PACKAGING" className="text-xs">Packaging & Disposables</SelectItem>
                    <SelectItem value="BEVERAGES_RETAIL" className="text-xs">Retail Drinks & Cans</SelectItem>
                    <SelectItem value="CENTRAL_PREP" className="text-xs">Central Base & Marinades</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ing-zone" className="text-xs font-semibold">
                  Storage Location
                </Label>
                <Select value={newIngStorageZone} onValueChange={(val) => setNewIngStorageZone(val as StorageZone)}>
                  <SelectTrigger id="ing-zone" className="w-full h-10 rounded-xl border border-border/80 bg-background text-xs font-medium">
                    <SelectValue placeholder="Storage Location" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                    <SelectItem value="DRY_STORE" className="text-xs">Dry Store Room</SelectItem>
                    <SelectItem value="CHILLER" className="text-xs">Walk-in Chiller</SelectItem>
                    <SelectItem value="FREEZER" className="text-xs">Deep Freezer (-18°C)</SelectItem>
                    <SelectItem value="PACKAGING_BAY" className="text-xs">Packaging Dispatch Bay</SelectItem>
                    <SelectItem value="STATION_LINE" className="text-xs">Cook Station Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supplier / Vendor Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ing-supplier" className="text-xs font-semibold">
                Supplier / Vendor Name
              </Label>
              <Input
                id="ing-supplier"
                placeholder="e.g. Metro Cash & Carry / Wholesale Mandi"
                value={newIngSupplier}
                onChange={(e) => setNewIngSupplier(e.target.value)}
                className="h-10 text-xs sm:text-sm bg-background rounded-xl border-border/80"
              />
            </div>

            {/* Unit & Unit Cost Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ing-unit" className="text-xs font-semibold">
                  Stock Unit
                </Label>
                <Select value={newIngUnit} onValueChange={(val) => setNewIngUnit(val as 'g' | 'ml' | 'pc' | 'kg' | 'l')}>
                  <SelectTrigger id="ing-unit" className="w-full h-10 rounded-xl border border-border/80 bg-background text-xs font-medium">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                    <SelectItem value="g" className="text-xs">g (grams)</SelectItem>
                    <SelectItem value="ml" className="text-xs">ml (milliliters)</SelectItem>
                    <SelectItem value="pc" className="text-xs">pc (pieces)</SelectItem>
                    <SelectItem value="kg" className="text-xs">kg (kilograms)</SelectItem>
                    <SelectItem value="l" className="text-xs">l (liters)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ing-cost" className="text-xs font-semibold">
                  Cost / Unit (₹)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="ing-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.25"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(e.target.value)}
                    required
                    className="h-10 pl-7 text-xs sm:text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                  />
                </div>
              </div>
            </div>

            {/* Initial Stock & Threshold Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ing-stock" className="text-xs font-semibold">
                  Initial Stock
                </Label>
                <div className="relative">
                  <Input
                    id="ing-stock"
                    type="number"
                    placeholder="1000"
                    value={newIngStock}
                    onChange={(e) => setNewIngStock(e.target.value)}
                    required
                    className="h-10 text-xs sm:text-sm font-mono font-bold bg-background rounded-xl border-border/80 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-mono">
                    {newIngUnit}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ing-thresh" className="text-xs font-semibold">
                  Min 86 Buffer
                </Label>
                <div className="relative">
                  <Input
                    id="ing-thresh"
                    type="number"
                    placeholder="300"
                    value={newIngThreshold}
                    onChange={(e) => setNewIngThreshold(e.target.value)}
                    required
                    className="h-10 text-xs sm:text-sm font-mono font-bold bg-background rounded-xl border-border/80 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-mono">
                    {newIngUnit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Symmetrical Apple Action Footer */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              Save Ingredient
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

