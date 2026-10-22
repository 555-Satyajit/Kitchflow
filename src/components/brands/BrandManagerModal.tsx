'use client'

import React, { useState } from 'react'
import { Brand } from '@/types'
import { Store, Plus, CheckCircle2, Palette } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BrandManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: Brand[]
  onAddBrand: (brand: Omit<Brand, 'id'>) => void
}

const PRESET_COLORS = [
  { name: 'Warm Amber', hex: '#f97316' },
  { name: 'Golden Honey', hex: '#eab308' },
  { name: 'Fresh Mint', hex: '#10b981' },
  { name: 'Royal Purple', hex: '#8b5cf6' },
  { name: 'Crimson Spice', hex: '#ef4444' },
  { name: 'Ocean Blue', hex: '#0ea5e9' },
]

export function BrandManagerModal({
  open,
  onOpenChange,
  brands,
  onAddBrand,
}: BrandManagerModalProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onAddBrand({
      name: name.trim(),
      tagline: tagline.trim() || 'Cloud Kitchen Virtual Storefront',
      color: selectedColor,
      active: true,
    })

    setName('')
    setTagline('')
    setIsCreating(false)
  }

  const content = (
    <div className="space-y-4">
      <div className="pb-3 border-b border-border/80 flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            <span>Virtual Cloud Kitchen Brands</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your digital storefronts running from this single kitchen
          </p>
        </div>
        {!isCreating && (
          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            className="text-xs h-8 gap-1 font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Brand</span>
          </Button>
        )}
      </div>

      {isCreating ? (
        <form onSubmit={handleSubmit} className="space-y-3.5 p-3.5 rounded-xl border-2 border-primary/40 bg-primary/5 text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Create New Virtual Brand</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Brand Name</label>
            <Input
              placeholder="e.g. Aunty's Sandwich Club / Chai & Toasties"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Cuisine Tagline</label>
            <Input
              placeholder="e.g. Fresh Gourmet Grilled Sandwiches & Snacks"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" />
              <span>Brand Theme Color</span>
            </label>
            <div className="flex items-center gap-2 pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  title={c.name}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center",
                    selectedColor === c.hex ? "scale-110 border-foreground ring-2 ring-primary/40" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  {selectedColor === c.hex && <CheckCircle2 className="w-4 h-4 text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" size="sm" className="w-full h-9 font-bold text-xs mt-2 cursor-pointer">
            Save & Enable Brand Storefront
          </Button>
        </form>
      ) : (
        <div className="space-y-2">
          {brands.map((b) => (
            <div
              key={b.id}
              className="p-3 rounded-xl border border-border/80 bg-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: b.color }}
                />
                <div>
                  <h4 className="font-bold text-xs text-foreground">{b.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{b.tagline}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/40">
                Active Storefront
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[85vh] p-5 overflow-y-auto rounded-2xl">
        {content}
      </DialogContent>
    </Dialog>
  )
}
