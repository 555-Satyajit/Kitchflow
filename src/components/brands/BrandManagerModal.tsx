'use client'

import React, { useState } from 'react'
import { Brand } from '@/types'
import { Store, Plus, CheckCircle2, Palette, Sparkles, ArrowRight, X, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { saveBrandAction } from '@/actions/settings'
import { useQueryClient } from '@tanstack/react-query'
import { OUTLETS_QUERY_KEY } from '@/hooks/useOutlets'

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
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      // 1. Resolve active kitchen facility ID
      let targetKid = ''
      try {
        targetKid = localStorage.getItem('kitchflow_active_kitchen_id') || ''
      } catch (err) {}

      // If 'ALL' or empty, use first brand's kitchenId or fetch organization kitchens
      if (!targetKid || targetKid === 'ALL') {
        const firstWithKid = (brands.find((b) => 'kitchenId' in b) as any)?.kitchenId
        if (firstWithKid) {
          targetKid = firstWithKid
        } else {
          const { getOrganizationKitchensAction } = await import('@/actions/settings')
          const kRes = await getOrganizationKitchensAction()
          if (kRes.ok && kRes.data?.kitchens?.length) {
            targetKid = kRes.data.kitchens[0].id
          }
        }
      }

      if (!targetKid) {
        setErrorMessage('No active kitchen selected to attach this brand to.')
        setIsSubmitting(false)
        return
      }

      // 2. Persist directly to PostgreSQL database via Server Action
      const res = await saveBrandAction({
        kitchenId: targetKid,
        name: name.trim(),
        tagline: tagline.trim() || 'Virtual Cloud Kitchen Storefront',
        color: selectedColor,
      })

      if (!res.ok) {
        setErrorMessage(res.error || 'Failed to create brand')
        setIsSubmitting(false)
        return
      }

      // 3. Update React context optimistically & invalidate TanStack queries
      onAddBrand({
        name: name.trim(),
        tagline: tagline.trim() || 'Virtual Cloud Kitchen Storefront',
        color: selectedColor,
        active: true,
      })

      queryClient.invalidateQueries({ queryKey: OUTLETS_QUERY_KEY })

      setName('')
      setTagline('')
      setIsCreating(false)
    } catch (err: any) {
      console.error('Error creating brand:', err)
      setErrorMessage(err.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        showCloseButton={false}
        className="w-[92vw] max-w-lg max-h-[85vh] p-0 rounded-3xl border border-border/80 bg-background/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <DialogTitle className="sr-only">Virtual Cloud Kitchen Brands</DialogTitle>
        
        {/* Apple HIG Pinned Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground tracking-tight truncate">
                Virtual Kitchen Brands
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {brands.length} storefronts enabled for this outlet
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {!isCreating && (
              <Button
                size="sm"
                onClick={() => {
                  setErrorMessage(null)
                  setIsCreating(true)
                }}
                className="text-xs h-8.5 px-3 gap-1.5 font-bold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Brand</span>
              </Button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-neutral-200/50 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-3.5 flex-1">
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
                  disabled={isSubmitting}
                  className="text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs">Brand Name</label>
                <Input
                  placeholder="e.g. Aunty's Sandwich Club / Chai & Toasties"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                disabled={isSubmitting || !name.trim()}
                className="w-full h-10 rounded-xl font-bold text-xs shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer gap-2 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <span>Save & Enable Brand Storefront</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            /* Apple Inset Grouped Brand List */
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40 shadow-2xs">
              {brands.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                  <Store className="w-8 h-8 mx-auto opacity-40" />
                  <p>No brands configured for this facility.</p>
                </div>
              ) : (
                brands.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-2 ring-background border border-black/10"
                        style={{ backgroundColor: b.color }}
                      />
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="font-bold text-sm text-foreground truncate">{b.name}</h4>
                        <p className="text-[11px] text-muted-foreground truncate">{b.tagline}</p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0 px-2.5 py-0.5 rounded-full"
                    >
                      Active
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
