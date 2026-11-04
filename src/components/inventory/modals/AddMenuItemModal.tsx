'use client'

import React, { useState, useEffect } from 'react'
import { Brand, Ingredient, MenuItem, Station } from '@/types'
import { formatStationName } from '@/lib/utils'
import {
  Utensils,
  Sparkles,
  Wand2,
  ChefHat,
  Mic,
  Trash2,
  Plus,
  ArrowRightLeft,
  Check,
  ChevronsUpDown,
  AlertCircle,
} from 'lucide-react'
import { estimateRecipeBOM, AIBOMSuggestion } from '@/lib/aiBOMEstimator'
import { generateDishWithGeminiAction } from '@/features/inventory/inventory-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface AddMenuItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: Brand[]
  ingredients: Ingredient[]
  onAddMenuItem: (newItem: Omit<MenuItem, 'id'>) => void
  onAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
  initialItemName?: string
  autoTriggerAI?: boolean
}

export function AddMenuItemModal({
  open,
  onOpenChange,
  brands,
  ingredients,
  onAddMenuItem,
  onAddIngredient,
  initialItemName = '',
  autoTriggerAI = false,
}: AddMenuItemModalProps) {
  const [newItemName, setNewItemName] = useState(initialItemName)
  const [newItemBrandId, setNewItemBrandId] = useState(brands[0]?.id || '')
  const [newItemStation, setNewItemStation] = useState<Station>('ASSEMBLY')
  const [showMultiStations, setShowMultiStations] = useState(false)
  const [customStations, setCustomStations] = useState<Array<{ id: string; label: string }>>([])
  const [isStationPopoverOpen, setIsStationPopoverOpen] = useState(false)
  const [stationSearchQuery, setStationSearchQuery] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('249')
  const [newItemPkgCost, setNewItemPkgCost] = useState('15')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<AIBOMSuggestion | null>(null)
  const [aiSource, setAiSource] = useState<'gemini' | 'local_fallback' | null>(null)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Extra Ingredient Picker & SKU Remapping State
  const [isAddingExtraIng, setIsAddingExtraIng] = useState(false)
  const [extraSelectedIngId, setExtraSelectedIngId] = useState<string>('')
  const [extraCustomName, setExtraCustomName] = useState<string>('')
  const [extraQty, setExtraQty] = useState<string>('50')
  const [extraUnit, setExtraUnit] = useState<'g' | 'ml' | 'pc'>('g')
  const [extraCost, setExtraCost] = useState<string>('0.25')
  const [remappingIndex, setRemappingIndex] = useState<number | null>(null)

  // Voice Recognition (Web Speech API)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (open) {
      if (!newItemBrandId && brands.length > 0) {
        setNewItemBrandId(brands[0].id)
      } else if (newItemBrandId && !brands.some((b) => b.id === newItemBrandId) && brands.length > 0) {
        setNewItemBrandId(brands[0].id)
      }
      if (initialItemName) {
        setNewItemName(initialItemName)
        if (autoTriggerAI) {
          handleGenerateAIBOM(initialItemName)
        }
      }
    } else {
      setIsListening(false)
    }
  }, [open, initialItemName, autoTriggerAI, brands, newItemBrandId])

  const handleGenerateAIBOM = async (targetName?: string) => {
    const nameToAnalyze = targetName || newItemName
    if (!nameToAnalyze.trim()) return

    setIsGeneratingAI(true)
    try {
      const activeBrand = brands.find((b) => b.id === newItemBrandId) || brands[0]
      const availableInventory = ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        costPerUnit: i.costPerUnit,
        category: i.category,
      }))

      const res = await generateDishWithGeminiAction({
        dishName: nameToAnalyze,
        brandName: activeBrand?.name,
        availableInventory,
      })

      if (res.ok && res.data) {
        const suggestion = res.data.suggestion
        setAiSuggestion(suggestion)
        setAiSource(res.data.source)
        setNewItemStation(suggestion.station)
        if (suggestion.station !== 'ASSEMBLY') {
          setShowMultiStations(true)
        }
        setNewItemPrice(suggestion.suggestedPrice.toString())
        setNewItemPkgCost(suggestion.packagingCost.toString())
        setNewItemDescription(suggestion.description)
      } else {
        const suggestion = estimateRecipeBOM(nameToAnalyze)
        setAiSuggestion(suggestion)
        setAiSource('local_fallback')
        setNewItemStation(suggestion.station)
        if (suggestion.station !== 'ASSEMBLY') {
          setShowMultiStations(true)
        }
        setNewItemPrice(suggestion.suggestedPrice.toString())
        setNewItemPkgCost(suggestion.packagingCost.toString())
        setNewItemDescription(suggestion.description)
      }
    } catch (err) {
      console.warn('Gemini dish generator error, falling back:', err)
      const suggestion = estimateRecipeBOM(nameToAnalyze)
      setAiSuggestion(suggestion)
      setAiSource('local_fallback')
      setNewItemStation(suggestion.station)
      if (suggestion.station !== 'ASSEMBLY') {
        setShowMultiStations(true)
      }
      setNewItemPrice(suggestion.suggestedPrice.toString())
      setNewItemPkgCost(suggestion.packagingCost.toString())
      setNewItemDescription(suggestion.description)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Voice dictation is supported on Chrome, Safari, and modern Android/iOS mobile browsers.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'en-IN'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setSpeechError(null)
      }

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0][0].transcript
        if (spokenText) {
          const formatted = spokenText
            .trim()
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
          setNewItemName(formatted)
          handleGenerateAIBOM(formatted)
        }
        setIsListening(false)
      }

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err)
        setSpeechError('Microphone listening paused. Speak clearly or type dish name.')
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsListening(false)
    }
  }

  const handleUpdateIngredientQuantity = (index: number, newQty: number) => {
    if (!aiSuggestion) return
    const updated = [...aiSuggestion.recipe]
    updated[index] = { ...updated[index], quantity: Math.max(0, newQty) }
    setAiSuggestion({ ...aiSuggestion, recipe: updated })
  }

  const handleRemoveRecipeIngredient = (index: number) => {
    if (!aiSuggestion) return
    const updated = aiSuggestion.recipe.filter((_, i) => i !== index)
    setAiSuggestion({ ...aiSuggestion, recipe: updated })
  }

  const handleCommitExtraIngredient = () => {
    const qtyNum = parseFloat(extraQty) || 1
    let ingredientName = ''
    let unit: 'g' | 'ml' | 'pc' = extraUnit
    let costPerUnit = parseFloat(extraCost) || 0.2
    let matchedId: string | null = null
    let isExisting = false

    if (extraSelectedIngId && extraSelectedIngId !== '__CUSTOM__') {
      const stockItem = ingredients.find((i) => i.id === extraSelectedIngId)
      if (stockItem) {
        ingredientName = stockItem.name
        unit = (['g', 'ml', 'pc'].includes(stockItem.unit) ? stockItem.unit : 'g') as any
        costPerUnit = stockItem.costPerUnit || 0.2
        matchedId = stockItem.id
        isExisting = true
      }
    } else {
      if (!extraCustomName.trim()) return
      ingredientName = extraCustomName.trim()
      isExisting = false
      matchedId = null
    }

    if (!ingredientName) return

    const newRecipeItem = {
      ingredientName,
      quantity: qtyNum,
      unit,
      estimatedCostPerUnit: costPerUnit,
      category: 'OTHER' as const,
      matchedIngredientId: matchedId,
      isExisting,
    }

    setAiSuggestion((prev) => {
      const current = prev || {
        dishName: newItemName.trim() || 'Custom Specialty Dish',
        station: newItemStation,
        suggestedPrice: parseFloat(newItemPrice) || 199,
        packagingCost: parseFloat(newItemPkgCost) || 15,
        description: newItemDescription.trim(),
        recipe: [],
      }
      return {
        ...current,
        recipe: [...current.recipe, newRecipeItem],
      }
    })

    setIsAddingExtraIng(false)
    setExtraSelectedIngId('')
    setExtraCustomName('')
    setExtraQty('50')
  }

  const handleRemapIngredient = (index: number, stockIngredientId: string) => {
    if (!aiSuggestion) return
    const stockItem = ingredients.find((i) => i.id === stockIngredientId)
    if (!stockItem) return

    const updated = [...aiSuggestion.recipe]
    updated[index] = {
      ...updated[index],
      ingredientName: stockItem.name,
      unit: (['g', 'ml', 'pc'].includes(stockItem.unit) ? stockItem.unit : 'g') as any,
      estimatedCostPerUnit: stockItem.costPerUnit || 0.2,
      matchedIngredientId: stockItem.id,
      isExisting: true,
    }
    setAiSuggestion({ ...aiSuggestion, recipe: updated })
    setRemappingIndex(null)
  }

  const handleCreateMenuItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    const recipeItems = (aiSuggestion?.recipe || []).map((r, idx) => {
      const existingIng = r.matchedIngredientId
        ? ingredients.find((i) => i.id === r.matchedIngredientId)
        : ingredients.find((i) => i.name.toLowerCase() === r.ingredientName.toLowerCase())

      const ingId = existingIng?.id || `i-ai-${Date.now()}-${idx}`

      if (!existingIng) {
        onAddIngredient({
          brandId: newItemBrandId,
          name: r.ingredientName,
          unit: r.unit,
          currentStock: 0,
          minThreshold: r.unit === 'pc' ? 10 : 250,
          costPerUnit: r.estimatedCostPerUnit,
        })
      }

      return {
        ingredientId: ingId,
        ingredientName: existingIng?.name || r.ingredientName,
        quantity: r.quantity,
        unit: r.unit,
      }
    })

    const selectedBrandId =
      (newItemBrandId && brands.some((b) => b.id === newItemBrandId) ? newItemBrandId : brands[0]?.id) || 'b1'

    onAddMenuItem({
      brandId: selectedBrandId,
      name: newItemName.trim(),
      description: newItemDescription.trim() || 'Freshly prepared specialty dish.',
      station: newItemStation,
      secondaryStations: aiSuggestion?.secondaryStations,
      sellingPrice: parseFloat(newItemPrice) || 199,
      packagingCost: parseFloat(newItemPkgCost) || 15,
      isAvailable: true,
      swiggyOnline: true,
      zomatoOnline: true,
      lastSyncedAt: new Date().toISOString(),
      recipe: recipeItems,
    })

    setNewItemName('')
    setNewItemDescription('')
    setAiSuggestion(null)
    onOpenChange(false)
  }

  // Live Financial / Margin metrics
  const bomRecipeItems = aiSuggestion?.recipe || []
  const estFoodCost = bomRecipeItems.reduce((acc, item) => {
    return acc + (item.quantity * (item.estimatedCostPerUnit || 0))
  }, 0)
  const numPrice = parseFloat(newItemPrice) || 0
  const numPkg = parseFloat(newItemPkgCost) || 0
  const totalCogs = estFoodCost + numPkg
  const grossMarginPct = numPrice > 0 ? ((numPrice - totalCogs) / numPrice) * 100 : 0

  if (!open) return null

  const modalFormContent = (isMobileView: boolean) => (
    <>
      <div className={cn("grid gap-6 items-start", isMobileView ? "grid-cols-1" : "grid-cols-1 md:grid-cols-12")}>
        {/* Left Column: Dish Essentials & Live Financials */}
        <div className={cn("space-y-3.5 text-xs", !isMobileView && "md:col-span-5")}>
          {/* Dish Name & Voice Dictation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={isMobileView ? "mobile-menu-name" : "menu-name"} className="text-xs font-semibold">
                Dish Name
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!newItemName.trim() || isGeneratingAI}
                onClick={() => handleGenerateAIBOM()}
                className="h-6 text-[10px] px-2 text-primary font-bold gap-1 cursor-pointer hover:bg-primary/10"
              >
                <Wand2 className="w-3 h-3" />
                <span>{isGeneratingAI ? 'Estimating...' : 'Auto-BOM'}</span>
              </Button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={isMobileView ? "mobile-menu-name" : "menu-name"}
                  placeholder="e.g. Corn Cheese Grilled Sandwich"
                  value={newItemName}
                  onChange={(e) => {
                    setNewItemName(e.target.value)
                    if (aiSuggestion) setAiSuggestion(null)
                  }}
                  required
                  className={cn("text-xs pr-10 rounded-xl", isMobileView ? "h-11 sm:text-sm bg-background border-border/80" : "h-10")}
                />
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  title={isListening ? 'Listening... click to stop' : 'Click and speak dish name (Hinglish/English)'}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 rounded-full transition-all cursor-pointer",
                    isMobileView ? "p-2 rounded-lg" : "p-1.5",
                    isListening
                      ? "bg-red-500 text-white animate-pulse shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {isListening ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="button"
                size="sm"
                variant={isMobileView ? "default" : "secondary"}
                disabled={!newItemName.trim() || isGeneratingAI}
                onClick={() => handleGenerateAIBOM()}
                className={cn(
                  "shrink-0 gap-1.5 font-bold text-xs rounded-xl cursor-pointer",
                  isMobileView
                    ? "h-11 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all"
                    : "h-10 px-3 border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary"
                )}
                title="Smart Recipe AI maps portions, ingredients, station & cost"
              >
                {isMobileView ? <Wand2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isMobileView ? (isGeneratingAI ? '...' : 'AI') : 'AI BOM'}</span>
              </Button>
            </div>

            {isListening && (
              <p className="text-[11px] text-red-500 font-semibold animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Listening... Bolie dish ka naam (e.g. &quot;Corn Cheese Grilled Sandwich&quot;)
              </p>
            )}

            {speechError && (
              <p className="text-[10px] text-amber-600 font-medium">{speechError}</p>
            )}

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">Presets:</span>
              {[
                'Corn Cheese Grilled Sandwich',
                'Corn Salt & Pepper',
                'Paneer Club Sandwich',
                'Crispy Peri Peri Fries',
                'Chicken Biryani'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setNewItemName(preset)
                    handleGenerateAIBOM(preset)
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border/80 cursor-pointer font-medium transition-colors shrink-0 whitespace-nowrap active:scale-[0.97]"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Brand & Cook Station */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="menu-brand" className="text-xs font-semibold">Brand</Label>
              <Select value={newItemBrandId} onValueChange={setNewItemBrandId}>
                <SelectTrigger id="menu-brand" className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="menu-station" className="text-xs font-semibold">Cook Station</Label>
                {newItemStation !== 'ASSEMBLY' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewItemStation('ASSEMBLY')
                      setShowMultiStations(false)
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-semibold cursor-pointer"
                    title="Reset back to Main Kitchen"
                  >
                    Reset
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMultiStations(!showMultiStations)}
                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    {showMultiStations ? 'Hide' : '+ Split'}
                  </button>
                )}
              </div>

              <Popover open={isStationPopoverOpen} onOpenChange={setIsStationPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="menu-station"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isStationPopoverOpen}
                    className="w-full h-9 justify-between text-xs font-normal border-border/80 bg-background hover:bg-muted/40 rounded-xl cursor-pointer"
                  >
                    <span className="truncate font-semibold">
                      {newItemStation === 'ASSEMBLY'
                        ? 'Main Kitchen (Default)'
                        : customStations.find((c) => c.id === newItemStation)?.label ||
                        formatStationName(newItemStation)}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or type new station..."
                      value={stationSearchQuery}
                      onValueChange={setStationSearchQuery}
                      className="h-9 text-xs"
                    />
                    <CommandList className="max-h-[220px]">
                      <CommandEmpty className="py-2 px-3 text-xs text-muted-foreground">
                        {stationSearchQuery.trim() ? (
                          <button
                            type="button"
                            onClick={() => {
                              const clean = stationSearchQuery.trim()
                              const id = clean.toUpperCase().replace(/\s+/g, '_') as Station
                              if (!customStations.some((c) => c.id === id)) {
                                setCustomStations((prev) => [...prev, { id, label: clean }])
                              }
                              setNewItemStation(id)
                              setStationSearchQuery('')
                              setIsStationPopoverOpen(false)
                            }}
                            className="w-full text-left font-semibold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create &quot;{stationSearchQuery.trim()}&quot;</span>
                          </button>
                        ) : (
                          'No station found.'
                        )}
                      </CommandEmpty>

                      <CommandGroup heading="Default">
                        <CommandItem
                          value="Main Kitchen / All-in-One Counter"
                          onSelect={() => {
                            setNewItemStation('ASSEMBLY')
                            setIsStationPopoverOpen(false)
                          }}
                          className="text-xs cursor-pointer justify-between font-semibold"
                        >
                          <span>Main Kitchen (Default)</span>
                          {newItemStation === 'ASSEMBLY' && <Check className="w-3.5 h-3.5 text-primary" />}
                        </CommandItem>
                      </CommandGroup>

                      {customStations.length > 0 && (
                        <CommandGroup heading="Custom Stations">
                          {customStations.map((cs) => (
                            <CommandItem
                              key={cs.id}
                              value={cs.label}
                              onSelect={() => {
                                setNewItemStation(cs.id as Station)
                                setIsStationPopoverOpen(false)
                              }}
                              className="text-xs cursor-pointer justify-between text-primary font-medium"
                            >
                              <span>⭐ {cs.label}</span>
                              {newItemStation === cs.id && <Check className="w-3.5 h-3.5 text-primary" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {showMultiStations && (
                        <CommandGroup heading="Specialized Stations">
                          {[
                            { id: 'GRILL', label: 'Grill & Tawa Line' },
                            { id: 'FRY', label: 'Fryer Station' },
                            { id: 'BEVERAGE', label: 'Beverage & Shake Bar' },
                            { id: 'PIZZA', label: 'Pizza & Baking Deck' },
                            { id: 'WOK', label: 'Wok & Chinese Line' },
                            { id: 'TANDOOR', label: 'Tandoor & Breads' },
                            { id: 'DUM_BIRYANI', label: 'Dum Biryani Section' },
                            { id: 'DESSERT', label: 'Desserts & Sweets' },
                            { id: 'PACKING', label: 'Packing / Dispatch Only' },
                          ].map((st) => (
                            <CommandItem
                              key={st.id}
                              value={st.label}
                              onSelect={() => {
                                setNewItemStation(st.id as Station)
                                setIsStationPopoverOpen(false)
                              }}
                              className="text-xs cursor-pointer justify-between"
                            >
                              <span>{st.label}</span>
                              {newItemStation === st.id && <Check className="w-3.5 h-3.5 text-primary" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Price & Packaging Cost */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="menu-price" className="text-xs font-semibold">Selling Price (₹)</Label>
              <Input
                id="menu-price"
                type="number"
                placeholder="249"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                required
                className="h-9 rounded-xl font-mono font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-pkg" className="text-xs font-semibold">Packaging (₹)</Label>
              <Input
                id="menu-pkg"
                type="number"
                placeholder="15"
                value={newItemPkgCost}
                onChange={(e) => setNewItemPkgCost(e.target.value)}
                required
                className="h-9 rounded-xl font-mono font-bold"
              />
            </div>
          </div>

          {/* Live Financial & Margin Analysis Card */}
          <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                Unit Profitability
              </span>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full font-mono",
                grossMarginPct >= 60
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : grossMarginPct >= 40
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
              )}>
                {grossMarginPct.toFixed(0)}% Margin {grossMarginPct >= 60 ? '✨ Healthy' : grossMarginPct >= 40 ? '⚠️ Moderate' : '❌ Low'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-border/50">
              <div className="bg-background/80 p-1.5 rounded-lg border border-border/60">
                <span className="text-[9px] text-muted-foreground block">Food BOM</span>
                <span className="text-xs font-bold font-mono text-foreground">₹{estFoodCost.toFixed(1)}</span>
              </div>
              <div className="bg-background/80 p-1.5 rounded-lg border border-border/60">
                <span className="text-[9px] text-muted-foreground block">Total COGS</span>
                <span className="text-xs font-bold font-mono text-foreground">₹{totalCogs.toFixed(1)}</span>
              </div>
              <div className="bg-background/80 p-1.5 rounded-lg border border-border/60">
                <span className="text-[9px] text-muted-foreground block">Gross Profit</span>
                <span className="text-xs font-bold font-mono text-primary">₹{(numPrice - totalCogs).toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Item Description */}
          <div className="space-y-1.5">
            <Label htmlFor="menu-desc" className="text-xs font-semibold">Prep Notes & Description</Label>
            <Input
              id="menu-desc"
              placeholder="e.g. Fresh cottage cheese tossed with peppers and aromatic spices"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              className="h-9 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Right Column: Recipe BOM & Ingredient Tracking */}
        <div className={cn("space-y-3", !isMobileView && "md:col-span-7")}>
          <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3 shadow-2xs">
            {/* BOM Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <ChefHat className="w-4 h-4 text-primary" />
                <span>Commercial Recipe Breakdown (BOM)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-background border border-border/70 text-muted-foreground font-semibold">
                {bomRecipeItems.length} Tracked SKUs
              </span>
            </div>

            {/* AI Loading State */}
            {isGeneratingAI && (
              <div className="p-4 rounded-xl border border-primary/30 bg-background/80 flex items-center gap-3 animate-pulse">
                <Sparkles className="w-5 h-5 text-primary animate-spin shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Smart Recipe AI Analyzing...</p>
                  <p className="text-[11px] text-muted-foreground">Mapping existing stockroom SKUs, calculating commercial portions & unit food cost...</p>
                </div>
              </div>
            )}

            {/* Scrollable Hero Ingredients List */}
            <div className="max-h-[290px] overflow-y-auto space-y-2 pr-1">
              {bomRecipeItems.length === 0 && !isGeneratingAI && (
                <div className="p-5 text-center rounded-xl bg-background/60 border border-dashed border-border/80 text-muted-foreground space-y-2">
                  <Sparkles className="w-6 h-6 mx-auto text-primary/60" />
                  <p className="text-xs font-medium">Type a dish name and click &quot;AI BOM&quot; to auto-generate ingredients, or add them manually below.</p>
                </div>
              )}

              {bomRecipeItems.map((ing, idx) => (
                <div
                  key={`${ing.ingredientName}-${idx}`}
                  className="p-2.5 rounded-xl bg-background border border-border/70 space-y-2 shadow-2xs transition-all hover:border-primary/40"
                >
                  {/* Top row: Ingredient Name & Status + Cost + Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-bold text-foreground truncate text-xs sm:text-sm">
                        {ing.ingredientName}
                      </span>
                      {ing.isExisting ? (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                          ✓ In Stock
                        </span>
                      ) : (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>+ New</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-foreground">
                        ₹{(ing.quantity * (ing.estimatedCostPerUnit || 0)).toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeIngredient(idx)}
                        title="Remove ingredient from BOM"
                        className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom row: Remap action & Quantity Stepper */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => setRemappingIndex(remappingIndex === idx ? null : idx)}
                      title="Remap this ingredient to an existing stockroom item"
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium cursor-pointer py-0.5 px-1 rounded hover:bg-muted"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{remappingIndex === idx ? 'Close Map' : 'Map SKU'}</span>
                    </button>

                    {/* Quantity Stepper */}
                    <div className="flex items-center border border-border/80 rounded-xl bg-muted/30 overflow-hidden h-7">
                      <button
                        type="button"
                        onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity - (ing.unit === 'pc' ? 1 : 10))}
                        className="w-7 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold cursor-pointer active:scale-95 transition-all"
                      >
                        -
                      </button>
                      <span className="px-2 font-mono font-bold text-primary text-xs min-w-[56px] text-center">
                        {ing.quantity} {ing.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity + (ing.unit === 'pc' ? 1 : 10))}
                        className="w-7 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold cursor-pointer active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* SKU Remapping Selector */}
                  {remappingIndex === idx && (
                    <div className="pt-2 pb-1 border-t border-border/60 flex items-center gap-2 animate-in fade-in duration-150">
                      <span className="text-[10px] text-muted-foreground font-semibold shrink-0">Map:</span>
                      <Select
                        value={ing.matchedIngredientId || undefined}
                        onValueChange={(val) => {
                          if (val) handleRemapIngredient(idx, val)
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground shadow-2xs">
                          <SelectValue placeholder="Select stockroom SKU..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[260px]">
                          {ingredients.map((stock) => (
                            <SelectItem key={stock.id} value={stock.id} className="text-xs">
                              {stock.name} ({stock.currentStock} {stock.unit} @ ₹{stock.costPerUnit}/{stock.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => setRemappingIndex(null)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded hover:bg-muted cursor-pointer shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* + Add Extra Ingredient Dynamic Section */}
            {!isAddingExtraIng ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddingExtraIng(true)
                  setExtraSelectedIngId(ingredients[0]?.id || '__CUSTOM__')
                }}
                className="w-full h-8 text-xs font-semibold border-dashed border-primary/40 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 cursor-pointer rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Extra Ingredient</span>
              </Button>
            ) : (
              <div className="p-3 rounded-xl bg-background border border-primary/30 space-y-2.5 shadow-sm animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Add Ingredient to Recipe</span>
                  <span className="text-[10px] text-muted-foreground">Select from inventory or enter custom</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Source</Label>
                    <Select value={extraSelectedIngId} onValueChange={setExtraSelectedIngId}>
                      <SelectTrigger className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground shadow-2xs">
                        <SelectValue placeholder="Choose source..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        <SelectItem value="__CUSTOM__" className="text-xs font-semibold">
                          ✍️ Custom New Item
                        </SelectItem>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="text-[10px] text-muted-foreground uppercase font-mono">Stockroom Items</SelectLabel>
                          {ingredients.map((item) => (
                            <SelectItem key={item.id} value={item.id} className="text-xs">
                              {item.name} ({item.currentStock} {item.unit})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {extraSelectedIngId === '__CUSTOM__' && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground">Ingredient Name</Label>
                      <Input
                        placeholder="e.g. Saffron / Kasuri Methi"
                        value={extraCustomName}
                        onChange={(e) => setExtraCustomName(e.target.value)}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Portion Qty</Label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={extraQty}
                      onChange={(e) => setExtraQty(e.target.value)}
                      className="h-8 text-xs rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Unit</Label>
                    <Select value={extraUnit} onValueChange={(val: 'g' | 'ml' | 'pc') => setExtraUnit(val)}>
                      <SelectTrigger className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-mono font-semibold shadow-2xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g" className="text-xs font-mono">g (grams)</SelectItem>
                        <SelectItem value="ml" className="text-xs font-mono">ml (liquid)</SelectItem>
                        <SelectItem value="pc" className="text-xs font-mono">pc (pieces)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Est. Cost/Unit (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.25"
                      value={extraCost}
                      onChange={(e) => setExtraCost(e.target.value)}
                      className="h-8 text-xs rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingExtraIng(false)}
                    className="h-7 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCommitExtraIngredient}
                    className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Add to Recipe
                  </Button>
                </div>
              </div>
            )}

            {/* Footer Information */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60 font-mono">
              <span>
                Assigned Station: {customStations.find((c) => c.id === newItemStation)?.label || formatStationName(newItemStation)}
              </span>
              <span>Packaging: ₹{newItemPkgCost}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-card">
          <form onSubmit={handleCreateMenuItem} className="flex flex-col flex-1 overflow-hidden min-h-0">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-border/70 flex items-center justify-between shrink-0 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Add Kitchen Menu Item
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Auto-map stockroom ingredients, portion BOM recipes, and station routing
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 fill-primary" />
                  <span>Smart Recipe AI Active</span>
                </span>
              </div>
            </div>

            {/* Scrollable 2-Column Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {modalFormContent(false)}
            </div>

            {/* Sticky Dialog Footer */}
            <div className="px-6 py-3.5 bg-muted/40 border-t border-border flex items-center justify-between shrink-0">
              <div className="text-xs">
                <span className="text-muted-foreground">Est. Total COGS: </span>
                <span className="font-bold font-mono text-foreground">₹{totalCogs.toFixed(1)} / portion</span>
                <span className="text-muted-foreground ml-3">Gross Margin: </span>
                <span className={cn(
                  "font-bold font-mono",
                  grossMarginPct >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                )}>
                  {grossMarginPct.toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 px-5 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
                >
                  Create & Sync Item
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl p-5 pb-8 border-t border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl safe-area-pb">
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />

        <form onSubmit={handleCreateMenuItem} className="space-y-4">
          <SheetHeader className="p-0 pb-3 border-b border-border/70 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                <SheetTitle className="text-base font-bold tracking-tight text-foreground">
                  Add Menu Item
                </SheetTitle>
              </div>

              <button
                type="button"
                disabled={!newItemName.trim() || isGeneratingAI}
                onClick={() => handleGenerateAIBOM()}
                className="h-7 px-2.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-bold flex items-center gap-1 active:scale-[0.96] transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary fill-primary" />
                <span>{isGeneratingAI ? 'Estimating...' : 'Smart Recipe AI'}</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Portion BOM recipes, station routing, and aggregator sync
            </p>
          </SheetHeader>

          <div className="space-y-3.5 pt-1 text-xs">
            {modalFormContent(true)}
          </div>

          <SheetFooter className="p-0 pt-3">
            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-sm font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              Create & Sync Dish to Menu
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

