'use client'

import React, { useState } from 'react'
import { Brand } from '@/types'
import { Store, Plus, CheckCircle2, Palette, Sparkles, ArrowRight, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl overflow-y-auto no-scrollbar space-y-4">
        {/* Apple HIG Header with Icon Badge */}
        <div className="pb-3 border-b border-border/60 flex items-center justify-between pr-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground tracking-tight">
                Virtual Cloud Kitchen Brands
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage your digital storefronts running from this kitchen
              </p>
            </div>
          </div>
          {!isCreating && (
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="text-xs h-9 px-3 gap-1.5 font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs active:scale-[0.98] transition-all cursor-pointer shrink-0 ml-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand</span>
            </Button>
          )}
        </div>

        {isCreating ? (
          /* Create New Brand Form (Apple Inset Card) */
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4 p-4 rounded-2xl border border-primary/30 bg-primary/5 text-xs animate-in fade-in duration-200 shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-primary/20 pb-2.5">
              <span className="font-bold text-foreground text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Create New Virtual Brand</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground text-xs">Brand Name</label>
              <Input
                placeholder="e.g. Aunty's Sandwich Club / Chai & Toasties"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 text-xs rounded-xl bg-background border-border/80 text-foreground placeholder:text-muted-foreground/70"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground text-xs">Cuisine Tagline</label>
              <Input
                placeholder="e.g. Fresh Gourmet Grilled Sandwiches & Snacks"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="h-10 text-xs rounded-xl bg-background border-border/80 text-foreground placeholder:text-muted-foreground/70"
              />
            </div>

            <div className="space-y-2">
              <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-primary" />
                <span>Brand Theme Color</span>
              </label>
              <div className="flex items-center gap-2.5 pt-0.5">
                {PRESET_COLORS.map((c) => {
                  const isSelected = selectedColor === c.hex
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.name}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center active:scale-90 shadow-sm",
                        isSelected 
                          ? "scale-110 border-background ring-2 ring-primary ring-offset-2 ring-offset-background" 
                          : "border-transparent opacity-85 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white drop-shadow-md" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 rounded-xl font-bold text-xs shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer gap-2 mt-2"
            >
              <span>Save & Enable Brand Storefront</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
            </Button>
          </form>
        ) : (
          /* Brand List (Apple Inset Rows) */
          <div className="space-y-2.5">
            {brands.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 backdrop-blur-sm flex items-center justify-between gap-3 shadow-2xs hover:border-foreground/20 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-5 h-5 rounded-full shrink-0 shadow-xs ring-2 ring-background border border-black/10"
                    style={{ backgroundColor: b.color }}
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-foreground truncate">{b.name}</h4>
                    <p className="text-[11px] text-muted-foreground truncate">{b.tagline}</p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0 px-2 py-0.5 rounded-lg"
                >
                  Active Storefront
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

