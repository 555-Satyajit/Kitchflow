'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { 
  PackageCheck, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  RotateCcw,
  Utensils,
  Check,
  ChevronsUpDown
} from 'lucide-react'
import { MenuItem } from '@/types'
import { INITIAL_MENU_ITEMS } from '@/lib/mockData'
import { cn } from '@/lib/utils'

import {
  getDispatchRulesAction,
  createDispatchRuleAction,
  deleteDispatchRuleAction,
  resetDispatchRulesAction,
  DispatchRuleDTO
} from '@/features/packing/packing-actions'

export type DispatchCheckRule = DispatchRuleDTO

const DEFAULT_DISPATCH_RULES: DispatchCheckRule[] = [
  {
    id: 'rule-cutlery',
    label: 'Eco-Friendly Cutlery & Spoons',
    category: 'ALL',
    description: 'Wooden spoons, forks, paper tissues',
    isDefault: true,
  },
  {
    id: 'rule-sauces',
    label: 'Condiments, Extra Dips & Salan',
    category: 'ALL',
    description: 'Raita cups, ketchup, mint chutney',
    isDefault: true,
  },
  {
    id: 'rule-napkins',
    label: 'Branded Napkins & Wet Wipes',
    category: 'ALL',
    description: 'Sanitizing wet wipes & premium napkins',
    isDefault: true,
  },
  {
    id: 'rule-beverage',
    label: 'Cold Beverage Separation (Thermal Pouch)',
    category: 'BEVERAGE',
    description: 'Keep chilled drinks isolated from hot curries/dum boxes',
    isDefault: true,
  },
  {
    id: 'rule-tamper',
    label: 'Tamper-Evident Bag Seal & Barcode Bill',
    category: 'ALL',
    description: 'Printed receipt sticker + aggregator QR security seal',
    isDefault: true,
  },
]

const STORAGE_KEY = 'kitchflow_dispatch_checklist_rules_v1'

export function getCustomDispatchRules(): DispatchCheckRule[] {
  if (typeof window === 'undefined') return DEFAULT_DISPATCH_RULES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DISPATCH_RULES
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // fallback
  }
  return DEFAULT_DISPATCH_RULES
}

interface DispatchChecklistConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menuItems?: MenuItem[]
}

export function DispatchChecklistConfigModal({
  open,
  onOpenChange,
  menuItems,
}: DispatchChecklistConfigModalProps) {
  const [rules, setRules] = useState<DispatchCheckRule[]>(() => getCustomDispatchRules())
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState<string>('ALL')
  const [newDesc, setNewDesc] = useState('')
  const [isComboboxOpen, setIsComboboxOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fallback to mock menu items if context menuItems is empty
  const activeMenuItems = (menuItems && menuItems.length > 0) ? menuItems : INITIAL_MENU_ITEMS

  // Load rules from DB whenever modal opens
  React.useEffect(() => {
    if (!open) return
    let isMounted = true

    getDispatchRulesAction().then((res) => {
      if (isMounted && res.ok && res.data) {
        setRules(res.data)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data))
          window.dispatchEvent(new Event('dispatch_rules_updated'))
        } catch {
          // ignore
        }
      }
    })

    return () => {
      isMounted = false
    }
  }, [open])

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim() || isSubmitting) return

    let targetItemName: string | undefined
    if (newCategory.startsWith('item:')) {
      const selectedId = newCategory.replace('item:', '')
      const match = activeMenuItems.find((m) => m.id === selectedId)
      targetItemName = match?.name
    }

    setIsSubmitting(true)
    try {
      const res = await createDispatchRuleAction({
        label: newLabel.trim(),
        category: newCategory,
        targetItemName,
        description: newDesc.trim() || undefined,
      })

      if (res.ok && res.data) {
        const updated = [...rules, res.data]
        setRules(updated)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          window.dispatchEvent(new Event('dispatch_rules_updated'))
        } catch {
          // ignore
        }
        setNewLabel('')
        setNewDesc('')
        setNewCategory('ALL')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    // Optimistic UI update
    const updated = rules.filter((r) => r.id !== id)
    setRules(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new Event('dispatch_rules_updated'))
    } catch {
      // ignore
    }

    await deleteDispatchRuleAction({ ruleId: id })
  }

  const handleResetDefaults = async () => {
    const res = await resetDispatchRulesAction()
    if (res.ok && res.data) {
      setRules(res.data)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data))
        window.dispatchEvent(new Event('dispatch_rules_updated'))
      } catch {
        // ignore
      }
    }
  }

  const getTargetBadgeLabel = (rule: DispatchCheckRule) => {
    if (rule.category === 'ALL') return 'All Orders'
    if (rule.category === 'BEVERAGE') return 'Beverage Orders'
    if (rule.category === 'BIRYANI') return 'Biryani Orders'
    if (rule.category === 'FRY_GRILL') return 'Burgers / Wraps'
    if (rule.category.startsWith('item:')) {
      const itemId = rule.category.replace('item:', '')
      const item = activeMenuItems.find((m) => m.id === itemId)
      return rule.targetItemName || item?.name || 'Specific Item'
    }
    return rule.category
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background border border-border/80 rounded-2xl shadow-xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0 shadow-2xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                Dispatch Verification Checklist
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure QA items packing crew must verify before sealing rider bags
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Add New Check Row */}
          <form onSubmit={handleAddRule} className="p-3.5 rounded-xl border border-border/80 bg-card space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Add Custom Dispatch Check</span>
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Station QA
              </Badge>
            </div>

            <div className="space-y-2.5">
              <Input
                placeholder="e.g., Check raita cup seal / Add extra mint dip"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-9 text-xs"
                required
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Optional detail or note"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="h-9 text-xs text-muted-foreground"
                />

                {/* Shadcn Combobox / Commandbox with Search */}
                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isComboboxOpen}
                      type="button"
                      className="h-9 w-full justify-between text-xs font-normal border-border/80 bg-background hover:bg-muted/40 cursor-pointer px-3"
                    >
                      <span className="truncate">
                        {newCategory === 'ALL'
                          ? 'Apply to: All Orders'
                          : activeMenuItems.find((m) => `item:${m.id}` === newCategory)?.name || 'Select target item...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] sm:w-[360px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search menu item or condition..." />
                      <CommandList>
                        <CommandEmpty>No matching menu item found.</CommandEmpty>
                        <CommandGroup heading="General Order Rules">
                          <CommandItem
                            value="all apply to all orders general"
                            onSelect={() => {
                              setNewCategory('ALL')
                              setIsComboboxOpen(false)
                            }}
                            className="text-xs flex items-center justify-between"
                          >
                            <span>Apply to: All Orders</span>
                            {newCategory === 'ALL' && <Check className="h-3.5 w-3.5 text-primary stroke-[3]" />}
                          </CommandItem>
                        </CommandGroup>

                        {activeMenuItems.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading={`Specific Menu Items (${activeMenuItems.length})`}>
                              {activeMenuItems.map((item) => {
                                const itemValue = `item:${item.id}`
                                const isSelected = newCategory === itemValue
                                return (
                                  <CommandItem
                                    key={item.id}
                                    value={`${item.name} ${item.description || ''}`}
                                    onSelect={() => {
                                      setNewCategory(itemValue)
                                      setIsComboboxOpen(false)
                                    }}
                                    className="text-xs flex items-center justify-between"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <Utensils className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="truncate">{item.name}</span>
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 stroke-[3]" />}
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" className="h-8 text-xs font-bold gap-1.5 cursor-pointer px-4">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Check Item</span>
              </Button>
            </div>
          </form>

          {/* Current Rules List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Active Checks ({rules.length})
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                title="Restore default kitchen checks"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
            </div>

            <div className="rounded-xl border border-border/80 divide-y divide-border/50 bg-card overflow-hidden shadow-2xs">
              {rules.map((rule) => (
                <div key={rule.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground leading-snug">
                        {rule.label}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/60 max-w-[200px] truncate">
                        {getTargetBadgeLabel(rule)}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {rule.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                    title="Remove check item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border/70 bg-muted/20 flex justify-between items-center text-xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Updated rules automatically apply to Dispatch screen</span>
          </span>
          <Button size="sm" variant="default" onClick={() => onOpenChange(false)} className="h-8 text-xs font-bold px-4 cursor-pointer">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
