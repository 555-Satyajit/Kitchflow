'use client'

import React, { useState, useEffect } from 'react'
import { Brand, Ingredient, MenuItem, Station, StockReasonCode, StockLedgerEntry } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { 
  Boxes, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Utensils, 
  PackagePlus, 
  BookOpen, 
  History, 
  RefreshCw,
  Layers,
  Sparkles,
  Wand2,
  ChefHat,
  Mic,
  MicOff,
  Trash2,
  Edit2
} from 'lucide-react'
import { estimateRecipeBOM, AIBOMSuggestion } from '@/lib/aiBOMEstimator'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface InventoryViewProps {
  ingredients: Ingredient[]
  menuItems: MenuItem[]
  brands: Brand[]
  stockLedger: StockLedgerEntry[]
  userRole?: string
  onAdjustStockWithReason: (ingredientId: string, delta: number, reason: StockReasonCode, note?: string) => void
  onTogglePlatformStatus: (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => void
  onAddMenuItem: (newItem: Omit<MenuItem, 'id'>) => void
  onAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
}

export function InventoryView({
  ingredients,
  menuItems,
  brands,
  stockLedger,
  userRole = 'OWNER',
  onAdjustStockWithReason,
  onTogglePlatformStatus,
  onAddMenuItem,
  onAddIngredient,
}: InventoryViewProps) {
  const lowStockItems = ingredients.filter((i) => i.currentStock <= i.minThreshold)
  const [activeTab, setActiveTab] = useState<'STOCK' | 'MENU' | 'LEDGER'>('STOCK')

  // Stock Adjustment Dialog State
  const [adjustingIng, setAdjustingIng] = useState<Ingredient | null>(null)
  const [adjustDelta, setAdjustDelta] = useState<string>('-10')
  const [adjustReason, setAdjustReason] = useState<StockReasonCode>('WASTAGE_SPOILAGE')
  const [adjustNote, setAdjustNote] = useState<string>('')

  // Dialog State: Add Menu Item
  const [isMenuItemDialogOpen, setIsMenuItemDialogOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemBrandId, setNewItemBrandId] = useState(brands[0]?.id || '')
  const [newItemStation, setNewItemStation] = useState<Station>('ASSEMBLY')
  const [newItemPrice, setNewItemPrice] = useState('249')
  const [newItemPkgCost, setNewItemPkgCost] = useState('15')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<AIBOMSuggestion | null>(null)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // Responsive detection: Mobile Sheet vs Desktop Dialog
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // AI Instant Generator Function
  const handleGenerateAIBOM = (targetName?: string) => {
    const nameToAnalyze = targetName || newItemName
    if (!nameToAnalyze.trim()) return

    setIsGeneratingAI(true)
    setTimeout(() => {
      const suggestion = estimateRecipeBOM(nameToAnalyze)
      setAiSuggestion(suggestion)
      setNewItemStation(suggestion.station)
      setNewItemPrice(suggestion.suggestedPrice.toString())
      setNewItemPkgCost(suggestion.packagingCost.toString())
      setNewItemDescription(suggestion.description)
      setIsGeneratingAI(false)
    }, 400) // Brief animation for snappy AI feel
  }

  // Voice Recognition for Aunt & Mother (Web Speech API)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)

  const handleToggleVoice = () => {
    // Check Web Speech API availability in browser
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
      recognition.lang = 'en-IN' // Supports Indian English & Hinglish dish names (e.g., Paneer, Biryani, Corn)
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setSpeechError(null)
      }

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0][0].transcript
        if (spokenText) {
          // Capitalize first letter of words
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

  // Recipe Customizer Functions for Family Cooks
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

  const handleAddRecipeIngredient = () => {
    if (!aiSuggestion) return
    setAiSuggestion({
      ...aiSuggestion,
      recipe: [
        ...aiSuggestion.recipe,
        {
          ingredientName: 'Extra Cheese / Butter',
          quantity: 20,
          unit: 'g',
          estimatedCostPerUnit: 0.5,
          category: 'OTHER',
        },
      ],
    })
  }

  // Dialog State: Add Raw Ingredient
  const [isIngDialogOpen, setIsIngDialogOpen] = useState(false)
  const [newIngName, setNewIngName] = useState('')
  const [newIngUnit, setNewIngUnit] = useState<'g' | 'ml' | 'pc' | 'kg' | 'l'>('g')
  const [newIngStock, setNewIngStock] = useState('1000')
  const [newIngThreshold, setNewIngThreshold] = useState('300')
  const [newIngCost, setNewIngCost] = useState('0.25')

  const handleCreateMenuItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    // If AI suggestion exists, link its ingredients and register any missing raw SKUs in stockroom
    const recipeItems = (aiSuggestion?.recipe || []).map((r, idx) => {
      const existingIng = ingredients.find(
        (i) => i.name.toLowerCase() === r.ingredientName.toLowerCase()
      )
      const ingId = existingIng?.id || `i-ai-${Date.now()}-${idx}`
      
      // Auto-create in inventory stockroom if it doesn't exist yet
      if (!existingIng) {
        onAddIngredient({
          name: r.ingredientName,
          unit: r.unit,
          currentStock: r.unit === 'pc' ? 50 : 2500,
          minThreshold: r.unit === 'pc' ? 10 : 500,
          costPerUnit: r.estimatedCostPerUnit,
        })
      }

      return {
        ingredientId: ingId,
        ingredientName: r.ingredientName,
        quantity: r.quantity,
        unit: r.unit,
      }
    })

    onAddMenuItem({
      brandId: newItemBrandId || brands[0]?.id || 'b1',
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
    setIsMenuItemDialogOpen(false)
  }

  const handleCreateIngredient = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIngName.trim()) return

    onAddIngredient({
      name: newIngName.trim(),
      unit: newIngUnit,
      currentStock: parseFloat(newIngStock) || 500,
      minThreshold: parseFloat(newIngThreshold) || 100,
      costPerUnit: parseFloat(newIngCost) || 0.1,
    })

    setNewIngName('')
    setIsIngDialogOpen(false)
  }

  const handleCommitAdjustment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingIng) return

    const deltaNum = parseFloat(adjustDelta)
    if (isNaN(deltaNum) || deltaNum === 0) return

    onAdjustStockWithReason(adjustingIng.id, deltaNum, adjustReason, adjustNote.trim() || undefined)
    setAdjustingIng(null)
    setAdjustNote('')
  }

  // Quick preset buttons tailored to unit
  const getUnitPresets = (unit: string) => {
    if (unit === 'pc') {
      return [
        { label: '-1 pc', delta: -1, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '-5 pc', delta: -5, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '+10 pc', delta: 10, reason: 'PURCHASE_INFLOW' as StockReasonCode },
        { label: '+50 pc', delta: 50, reason: 'PURCHASE_INFLOW' as StockReasonCode },
      ]
    }
    if (unit === 'g') {
      return [
        { label: '-100g', delta: -100, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '-500g', delta: -500, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
        { label: '+1kg', delta: 1000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
        { label: '+5kg', delta: 5000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
      ]
    }
    // ml or others
    return [
      { label: '-100ml', delta: -100, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
      { label: '-500ml', delta: -500, reason: 'WASTAGE_SPOILAGE' as StockReasonCode },
      { label: '+1L', delta: 1000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
      { label: '+5L', delta: 5000, reason: 'PURCHASE_INFLOW' as StockReasonCode },
    ]
  }

  return (
    <div className="space-y-6">
      {/* Title Header & Action Modals */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Inventory & Recipe Auto-86
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unit-accurate stock adjustments, audit trail ledger, and per-platform Swiggy / Zomato sync
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">

          {/* Add Ingredient Dialog */}
          <Dialog open={isIngDialogOpen} onOpenChange={setIsIngDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 font-medium">
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Raw SKU</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateIngredient}>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold">Add Raw Ingredient SKU</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="ing-name">Ingredient Name</Label>
                    <Input
                      id="ing-name"
                      placeholder="e.g. Paneer Cubes / Tandoori Mayo"
                      value={newIngName}
                      onChange={(e) => setNewIngName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ing-unit">Unit</Label>
                      <select
                        id="ing-unit"
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value as 'g' | 'ml' | 'pc' | 'kg' | 'l')}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                      >
                        <option value="g" className="bg-background text-foreground">g (grams)</option>
                        <option value="ml" className="bg-background text-foreground">ml (milliliters)</option>
                        <option value="pc" className="bg-background text-foreground">pc (pieces)</option>
                        <option value="kg" className="bg-background text-foreground">kg (kilograms)</option>
                        <option value="l" className="bg-background text-foreground">l (liters)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ing-cost">Cost / Unit (₹)</Label>
                      <Input
                        id="ing-cost"
                        type="number"
                        step="0.01"
                        placeholder="0.25"
                        value={newIngCost}
                        onChange={(e) => setNewIngCost(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ing-stock">Current Stock</Label>
                      <Input
                        id="ing-stock"
                        type="number"
                        placeholder="1000"
                        value={newIngStock}
                        onChange={(e) => setNewIngStock(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ing-thresh">Min 86 Threshold</Label>
                      <Input
                        id="ing-thresh"
                        type="number"
                        placeholder="300"
                        value={newIngThreshold}
                        onChange={(e) => setNewIngThreshold(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" size="sm" className="text-xs h-8">
                    Save Ingredient
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Single Trigger Button */}
          <Button
            size="sm"
            onClick={() => setIsMenuItemDialogOpen(true)}
            className="text-xs h-8 gap-1.5 font-medium shadow-xs cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>+ Menu Item</span>
          </Button>

          {/* Responsive Menu Item Modal: Dialog on Desktop, Sheet on Mobile */}
          {!isMobile ? (
            <Dialog open={isMenuItemDialogOpen} onOpenChange={setIsMenuItemDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateMenuItem}>
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">Add Kitchen Menu Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-4 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="menu-name">Dish Name</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!newItemName.trim() || isGeneratingAI}
                          onClick={() => handleGenerateAIBOM()}
                          className="h-6 text-[10px] px-2 text-primary font-bold gap-1 cursor-pointer hover:bg-primary/10"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 animate-spin" />
                          <span>{isGeneratingAI ? 'AI Estimating...' : 'AI Generate BOM'}</span>
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="menu-name"
                            placeholder="e.g. Corn Cheese Grilled Sandwich / Corn Salt & Pepper"
                            value={newItemName}
                            onChange={(e) => {
                              setNewItemName(e.target.value)
                              if (aiSuggestion) setAiSuggestion(null)
                            }}
                            required
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={handleToggleVoice}
                            title={isListening ? 'Listening... click to stop' : 'Click and speak dish name (Hinglish/English)'}
                            className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all cursor-pointer",
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
                          variant="secondary"
                          disabled={!newItemName.trim() || isGeneratingAI}
                          onClick={() => handleGenerateAIBOM()}
                          className="h-9 px-3 shrink-0 gap-1 font-semibold text-xs border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary"
                          title="AI predicts portions, hero ingredients, station, and packaging cost"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">AI Auto-BOM</span>
                        </Button>
                      </div>

                      {isListening && (
                        <p className="text-[11px] text-red-500 font-semibold animate-pulse flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          Listening... Bolie dish ka naam (e.g., &quot;Corn Cheese Grilled Sandwich&quot;)
                        </p>
                      )}

                      {speechError && (
                        <p className="text-[10px] text-amber-600 font-medium">{speechError}</p>
                      )}

                      {/* Quick Demo Sample Pills for the Family Kitchen */}
                      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">Family Cafe Presets:</span>
                        {[
                          'Corn Cheese Grilled Sandwich',
                          'Corn Salt & Pepper',
                          'Paneer Club Sandwich',
                          'Crispy Peri Peri Fries',
                          'Homestyle Chicken Biryani'
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setNewItemName(preset)
                              handleGenerateAIBOM(preset)
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border border-border/80 cursor-pointer font-medium"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI Generated BOM Preview Card & Interactive Recipe Customizer */}
                    {aiSuggestion && (
                      <div className="p-3 rounded-lg border-2 border-primary/40 bg-primary/5 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span className="flex items-center gap-1.5 text-primary">
                            <ChefHat className="w-4 h-4" />
                            <span>AI Commercial Recipe Breakdown</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            Tap + / - to fine-tune
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase block font-mono">
                            Hero Ingredients (BOM):
                          </span>
                          <div className="space-y-1.5">
                            {aiSuggestion.recipe.map((ing, idx) => (
                              <div
                                key={`${ing.ingredientName}-${idx}`}
                                className="flex items-center justify-between p-1.5 rounded bg-background border border-border/60 text-xs"
                              >
                                <span className="font-medium text-foreground truncate max-w-[140px]">
                                  {ing.ingredientName}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                  {/* Quantity Stepper */}
                                  <div className="flex items-center border border-border rounded bg-muted/30 overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity - (ing.unit === 'pc' ? 1 : 10))}
                                      className="px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold"
                                    >
                                      -
                                    </button>
                                    <span className="px-2 font-mono font-bold text-primary text-xs min-w-[50px] text-center">
                                      {ing.quantity} {ing.unit}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity + (ing.unit === 'pc' ? 1 : 10))}
                                      className="px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold"
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* Delete Ingredient */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRecipeIngredient(idx)}
                                    title="Remove ingredient"
                                    className="text-muted-foreground hover:text-destructive p-1 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={handleAddRecipeIngredient}
                              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Extra Ingredient</span>
                            </button>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {aiSuggestion.recipe.length} tracked SKUs
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60 font-mono">
                          <span>Station: {aiSuggestion.station}</span>
                          <span>Suggested Pkg: ₹{aiSuggestion.packagingCost}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="menu-brand">Brand</Label>
                        <select
                          id="menu-brand"
                          value={newItemBrandId}
                          onChange={(e) => setNewItemBrandId(e.target.value)}
                          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                        >
                          {brands.map((b) => (
                            <option key={b.id} value={b.id} className="bg-background text-foreground">
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="menu-station">Cook Station</Label>
                        <select
                          id="menu-station"
                          value={newItemStation}
                          onChange={(e) => setNewItemStation(e.target.value as Station)}
                          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs font-mono"
                        >
                          <option value="ASSEMBLY" className="bg-background text-foreground">ASSEMBLY (Cold & Plating)</option>
                          <option value="TANDOOR" className="bg-background text-foreground">TANDOOR (Clay Oven & Breads)</option>
                          <option value="DUM_BIRYANI" className="bg-background text-foreground">DUM_BIRYANI (Dum Pots)</option>
                          <option value="GRILL" className="bg-background text-foreground">GRILL (Tawa & Burgers)</option>
                          <option value="FRY" className="bg-background text-foreground">FRY (Deep Fryers)</option>
                          <option value="WOK" className="bg-background text-foreground">WOK (Chinese & Asian Stir-Fry)</option>
                          <option value="PIZZA" className="bg-background text-foreground">PIZZA (Deck Oven)</option>
                          <option value="BEVERAGE" className="bg-background text-foreground">BEVERAGE (Shakes, Drinks, Chai)</option>
                          <option value="DESSERT" className="bg-background text-foreground">DESSERT (Sweets & Bakery)</option>
                          <option value="PACKING" className="bg-background text-foreground">PACKING (Dispatch Counter)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="menu-price">Selling Price (₹)</Label>
                        <Input
                          id="menu-price"
                          type="number"
                          placeholder="299"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="menu-pkg">Packaging Cost (₹)</Label>
                        <Input
                          id="menu-pkg"
                          type="number"
                          placeholder="18"
                          value={newItemPkgCost}
                          onChange={(e) => setNewItemPkgCost(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="menu-desc">Item Description</Label>
                      <Input
                        id="menu-desc"
                        placeholder="Ingredients and prep notes for cooks"
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" size="sm" className="text-xs h-8">
                      Create & Sync Item
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Sheet open={isMenuItemDialogOpen} onOpenChange={setIsMenuItemDialogOpen}>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 safe-area-pb">
                <form onSubmit={handleCreateMenuItem} className="space-y-3">
                  <SheetHeader className="p-0 pb-2 border-b border-border text-left">
                    <SheetTitle className="text-base font-bold flex items-center justify-between">
                      <span>Add Kitchen Menu Item</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!newItemName.trim() || isGeneratingAI}
                        onClick={() => handleGenerateAIBOM()}
                        className="h-6 text-[11px] px-2 text-primary font-bold gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>AI Suggest</span>
                      </Button>
                    </SheetTitle>
                  </SheetHeader>

                  <div className="space-y-3 pt-2 text-xs">
                    <div className="space-y-1.5">
                      <Label htmlFor="mobile-menu-name">Dish Name</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="mobile-menu-name"
                            placeholder="e.g. Corn Cheese Grilled Sandwich"
                            value={newItemName}
                            onChange={(e) => {
                              setNewItemName(e.target.value)
                              if (aiSuggestion) setAiSuggestion(null)
                            }}
                            required
                            className="h-10 text-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={handleToggleVoice}
                            title={isListening ? 'Listening...' : 'Voice input'}
                            className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all cursor-pointer",
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
                          variant="secondary"
                          disabled={!newItemName.trim() || isGeneratingAI}
                          onClick={() => handleGenerateAIBOM()}
                          className="h-10 px-3 shrink-0 font-bold text-xs border border-primary/30 text-primary"
                        >
                          <Wand2 className="w-4 h-4" />
                          <span>AI BOM</span>
                        </Button>
                      </div>

                      {isListening && (
                        <p className="text-[11px] text-red-500 font-semibold animate-pulse flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          Listening... Bolie dish ka naam (e.g., &quot;Corn Cheese Grilled Sandwich&quot;)
                        </p>
                      )}

                      {/* Quick Presets on Mobile */}
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar py-1">
                        {[
                          'Corn Cheese Grilled Sandwich',
                          'Corn Salt & Pepper',
                          'Paneer Club Sandwich',
                          'Crispy Peri Peri Fries'
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setNewItemName(preset)
                              handleGenerateAIBOM(preset)
                            }}
                            className="text-[10px] whitespace-nowrap px-2 py-1 rounded-md bg-muted text-foreground border border-border shrink-0"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI Generated BOM Preview Card & Interactive Recipe Customizer */}
                    {aiSuggestion && (
                      <div className="p-3 rounded-lg border-2 border-primary/40 bg-primary/5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span className="flex items-center gap-1.5 text-primary">
                            <ChefHat className="w-4 h-4" />
                            <span>AI Commercial Recipe Breakdown</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            Tap + / - to fine-tune
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {aiSuggestion.recipe.map((ing, idx) => (
                            <div
                              key={`${ing.ingredientName}-${idx}`}
                              className="flex items-center justify-between p-2 rounded bg-background border border-border/60 text-xs"
                            >
                              <span className="font-medium text-foreground truncate max-w-[130px]">
                                {ing.ingredientName}
                              </span>

                              <div className="flex items-center gap-2">
                                {/* Quantity Stepper */}
                                <div className="flex items-center border border-border rounded bg-muted/30 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity - (ing.unit === 'pc' ? 1 : 10))}
                                    className="px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 font-mono font-bold text-primary text-xs min-w-[50px] text-center">
                                    {ing.quantity} {ing.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity + (ing.unit === 'pc' ? 1 : 10))}
                                    className="px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Delete Ingredient */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipeIngredient(idx)}
                                  title="Remove ingredient"
                                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={handleAddRecipeIngredient}
                              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Extra Ingredient</span>
                            </button>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {aiSuggestion.recipe.length} tracked SKUs
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-brand">Brand</Label>
                        <select
                          id="mobile-brand"
                          value={newItemBrandId}
                          onChange={(e) => setNewItemBrandId(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-xs"
                        >
                          {brands.map((b) => (
                            <option key={b.id} value={b.id} className="bg-background text-foreground">
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-station">Station</Label>
                        <select
                          id="mobile-station"
                          value={newItemStation}
                          onChange={(e) => setNewItemStation(e.target.value as Station)}
                          className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-xs font-mono"
                        >
                          <option value="GRILL">GRILL (Tawa/Burgers)</option>
                          <option value="FRY">FRY (Fryers)</option>
                          <option value="ASSEMBLY">ASSEMBLY (Cold)</option>
                          <option value="TANDOOR">TANDOOR (Breads)</option>
                          <option value="DUM_BIRYANI">DUM_BIRYANI</option>
                          <option value="WOK">WOK (Chinese)</option>
                          <option value="BEVERAGE">BEVERAGE</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-price">Selling Price (₹)</Label>
                        <Input
                          id="mobile-price"
                          type="number"
                          placeholder="149"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          required
                          className="h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-pkg">Packaging (₹)</Label>
                        <Input
                          id="mobile-pkg"
                          type="number"
                          placeholder="12"
                          value={newItemPkgCost}
                          onChange={(e) => setNewItemPkgCost(e.target.value)}
                          required
                          className="h-10 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <SheetFooter className="p-0 pt-3">
                    <Button type="submit" size="lg" className="w-full h-11 text-sm font-bold">
                      Create & Sync Dish to Menu
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Tabs Selector: Raw SKUs vs Menu Items vs Stock Ledger */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <Button
          variant={activeTab === 'STOCK' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('STOCK')}
          className="text-xs h-8 px-3 font-medium gap-1.5"
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Raw Ingredients Stockroom</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none font-mono">
            {ingredients.length}
          </Badge>
        </Button>

        <Button
          variant={activeTab === 'MENU' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('MENU')}
          className="text-xs h-8 px-3 font-medium gap-1.5"
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Menu Items & Channel Sync</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none font-mono">
            {menuItems.length}
          </Badge>
        </Button>

        <Button
          variant={activeTab === 'LEDGER' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('LEDGER')}
          className="text-xs h-8 px-3 font-medium gap-1.5"
        >
          <History className="w-3.5 h-3.5" />
          <span>Stock Audit Ledger</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1 leading-none font-mono">
            {stockLedger.length}
          </Badge>
        </Button>
      </div>

      {/* Tab 1: Raw Ingredients */}
      {activeTab === 'STOCK' && (
        <div className="space-y-4">
          {/* Low Stock Warning Alert Banner */}
          {lowStockItems.length > 0 && (
            <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-red-500/60 bg-red-50/80 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs shadow-xs">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 animate-bounce" />
                <div>
                  <span className="font-extrabold text-sm block">
                    {lowStockItems.length} {lowStockItems.length === 1 ? 'SKU' : 'SKUs'} Below Safe Minimum Threshold
                  </span>
                  <span className="font-medium text-xs opacity-90">
                    Items requiring immediate replenishment have been prioritized at the top of the stockroom.
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-md bg-red-600 text-white shrink-0">
                Action Needed
              </span>
            </div>
          )}

          {/* Sorted Ingredient Cards (Zero & Low items first) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[...ingredients]
              .sort((a, b) => {
                const aUrgency = a.currentStock <= 0 ? 0 : a.currentStock <= a.minThreshold ? 1 : 2
                const bUrgency = b.currentStock <= 0 ? 0 : b.currentStock <= b.minThreshold ? 1 : 2
                return aUrgency - bUrgency
              })
              .map((ing) => {
                const isZero = ing.currentStock <= 0
                const isLow = ing.currentStock <= ing.minThreshold
                const minVal = Math.max(1, ing.minThreshold)
                const pctOfMin = Math.round((ing.currentStock / minVal) * 100)
                const barWidth = Math.min(100, pctOfMin)
                const presets = getUnitPresets(ing.unit)

                return (
                  <Card
                    key={ing.id}
                    className={cn(
                      "p-4 flex flex-col justify-between shadow-2xs border transition-all rounded-xl",
                      isZero
                        ? "border-red-500/80 bg-red-500/5 dark:bg-red-950/20"
                        : isLow
                        ? "border-amber-500/80 bg-amber-500/5 dark:bg-amber-950/20"
                        : "border-border/80 bg-card hover:border-primary/40 hover:shadow-xs"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground leading-tight truncate">
                              {ing.name}
                            </h4>
                            {isZero && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0">
                                Depleted (86)
                              </span>
                            )}
                            {!isZero && isLow && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-amber-950 shrink-0">
                                Low Stock
                              </span>
                            )}
                          </div>
                          {userRole === 'OWNER' ? (
                            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                              Cost: <span className="font-mono font-semibold text-foreground">{formatCurrency(ing.costPerUnit)}</span> / {ing.unit}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                              Stock SKU • {ing.unit}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-1 font-mono">
                            <span
                              className={cn(
                                "text-xl font-extrabold tracking-tight",
                                isZero
                                  ? "text-red-600"
                                  : isLow
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-foreground"
                              )}
                            >
                              {ing.currentStock}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">
                              / min {ing.minThreshold} {ing.unit}
                            </span>
                          </div>
                          <p className={cn(
                            "text-[11px] font-bold font-mono",
                            isZero ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600"
                          )}>
                            {pctOfMin}% {isLow ? 'OF MIN BUFFER' : 'SAFE'}
                          </p>
                        </div>
                      </div>

                      {/* Stock Level Visual Progress Bar Against Minimum Threshold */}
                      <div className="space-y-1">
                        <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden border border-border/50">
                          <div
                            className={cn(
                              "h-full transition-all duration-300 rounded-full",
                              isZero
                                ? "bg-red-600 w-full"
                                : isLow
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.max(4, barWidth)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Unit-Aware Presets & Reason Modal Trigger */}
                    <div className="pt-3 border-t border-border/60 space-y-2 mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="font-semibold uppercase tracking-wider text-[9px]">Quick {ing.unit} Adjust:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustingIng(ing)
                            setAdjustDelta('-1')
                            setAdjustReason('WASTAGE_SPOILAGE')
                          }}
                          className="text-primary hover:underline cursor-pointer font-bold"
                        >
                          Custom + Reason Code
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {presets.map((p) => (
                          <Button
                            key={p.label}
                            size="sm"
                            variant={p.delta < 0 ? "outline" : "secondary"}
                            onClick={() => onAdjustStockWithReason(ing.id, p.delta, p.reason)}
                            className={cn(
                              "text-xs h-8 px-1 font-mono font-semibold transition-transform active:scale-95",
                              p.delta < 0 ? "text-destructive hover:bg-destructive/10 border-destructive/20" : "hover:bg-muted text-foreground"
                            )}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Menu Items & Per-Platform Swiggy / Zomato Controls */}
      {activeTab === 'MENU' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Independent Aggregator Menu Status (Swiggy & Zomato)
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Auto-86: Triggers if stock &lt; 1 portion BOM or &lt; min threshold
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsMenuItemDialogOpen(true)
                setNewItemName('Corn Cheese Grilled Sandwich')
                handleGenerateAIBOM('Corn Cheese Grilled Sandwich')
              }}
              className="text-xs h-8 gap-1.5 font-bold border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>✨ AI Smart Recipe Wizard</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {menuItems.map((item) => {
              const brand = brands.find((b) => b.id === item.brandId)

              return (
                <Card
                  key={item.id}
                  className={cn(
                    "p-4 flex flex-col justify-between shadow-2xs border transition-all",
                    !item.isAvailable ? "opacity-60 bg-muted/30 border-dashed" : "border-border"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0 rounded bg-muted text-muted-foreground">
                            {brand?.name}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            Station: {item.station}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground leading-tight mt-1">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-foreground font-mono">
                          {formatCurrency(item.sellingPrice)}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Pkg: {formatCurrency(item.packagingCost)}
                        </p>
                      </div>
                    </div>

                    {/* Recipe Ingredients */}
                    <div className="bg-muted/40 p-2 rounded border border-border/40 text-[11px] space-y-1">
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase block font-mono">
                        Recipe BOM Ingredients:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {item.recipe.length === 0 ? (
                          <span className="text-muted-foreground italic text-[10px]">No linked ingredients</span>
                        ) : (
                          item.recipe.map((r) => (
                            <Badge
                              key={r.ingredientId}
                              variant="outline"
                              className="text-[9px] px-1 py-0 font-normal font-mono"
                            >
                              {r.ingredientName} ({r.quantity}{r.unit})
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Independent Swiggy & Zomato Status Buttons with Last Sync */}
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Platform Status:</span>
                      <span>Synced: ~3m ago</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Swiggy Button */}
                      <Button
                        size="sm"
                        variant={item.swiggyOnline ? "default" : "outline"}
                        onClick={() => onTogglePlatformStatus(item.id, 'SWIGGY')}
                        className={cn(
                          "text-xs h-8 font-medium justify-between px-2.5",
                          !item.swiggyOnline && "text-muted-foreground border-destructive/50"
                        )}
                      >
                        <span className="font-bold">Swiggy</span>
                        <span className="text-[10px] font-mono">
                          {item.swiggyOnline ? "ONLINE" : "OFFLINE"}
                        </span>
                      </Button>

                      {/* Zomato Button */}
                      <Button
                        size="sm"
                        variant={item.zomatoOnline ? "default" : "outline"}
                        onClick={() => onTogglePlatformStatus(item.id, 'ZOMATO')}
                        className={cn(
                          "text-xs h-8 font-medium justify-between px-2.5",
                          !item.zomatoOnline && "text-muted-foreground border-destructive/50"
                        )}
                      >
                        <span className="font-bold">Zomato</span>
                        <span className="text-[10px] font-mono">
                          {item.zomatoOnline ? "ONLINE" : "OFFLINE"}
                        </span>
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Stock Audit Ledger */}
      {activeTab === 'LEDGER' && (
        <Card className="p-5 border-border shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Inventory Stock Ledger & Variance Audit Trail
              </h3>
              <p className="text-xs text-muted-foreground">
                Every deduction, recipe consumption, wastage, and supplier purchase recorded with timestamps
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {stockLedger.length} Ledger Events
            </Badge>
          </div>

          {/* Responsive Table Wrapper */}
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-2 sm:px-0">
              <table className="min-w-[620px] w-full text-left text-xs divide-y divide-border">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-mono uppercase text-[10px]">
                    <th scope="col" className="py-2.5 px-3 w-[100px]">Time</th>
                    <th scope="col" className="py-2.5 px-3 w-[160px]">Ingredient</th>
                    <th scope="col" className="py-2.5 px-3 w-[150px]">Reason Code</th>
                    <th scope="col" className="py-2.5 px-3 w-[100px]">Change</th>
                    <th scope="col" className="py-2.5 px-3 w-[90px]">Stock</th>
                    <th scope="col" className="py-2.5 px-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {stockLedger.map((entry, idx) => (
                    <tr key={entry.id ? `${entry.id}-${idx}` : `ledger-${idx}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                        {entry.ingredientName}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={
                            entry.reason === 'WASTAGE_SPOILAGE'
                              ? 'destructive'
                              : entry.reason === 'PURCHASE_INFLOW'
                              ? 'default'
                              : 'outline'
                          }
                          className="text-[9px] uppercase px-1.5 py-0 font-medium font-sans whitespace-nowrap"
                        >
                          {entry.reason.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        <span className={entry.delta < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta} {entry.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-bold whitespace-nowrap">
                        {entry.newStock} {entry.unit}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-sans text-xs min-w-[140px]">
                        {entry.note || 'Manual line adjustment'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Stock Adjustment with Reason Code Modal */}
      <Dialog open={Boolean(adjustingIng)} onOpenChange={(open) => !open && setAdjustingIng(null)}>
        <DialogContent className="sm:max-w-md">
          {adjustingIng && (
            <form onSubmit={handleCommitAdjustment}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  Record Stock Adjustment: {adjustingIng.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex justify-between">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-bold font-mono text-foreground">
                    {adjustingIng.currentStock} {adjustingIng.unit}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-delta">
                    Adjustment Quantity ({adjustingIng.unit}) - Use negative for reduction
                  </Label>
                  <Input
                    id="adj-delta"
                    type="number"
                    step="any"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-reason">Mandatory Audit Reason Code</Label>
                  <select
                    id="adj-reason"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value as StockReasonCode)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                  >
                    <option value="WASTAGE_SPOILAGE" className="bg-background text-foreground">
                      Wastage / Spoilage / Burnt Food
                    </option>
                    <option value="AUDIT_CORRECTION" className="bg-background text-foreground">
                      Physical Inventory Audit Correction
                    </option>
                    <option value="PURCHASE_INFLOW" className="bg-background text-foreground">
                      Supplier Purchase / Stock Inflow
                    </option>
                    <option value="RECIPE_AUTO_CONSUMPTION" className="bg-background text-foreground">
                      Manual Kitchen Prep Consumption
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-note">Note / Staff Remark (Optional)</Label>
                  <Input
                    id="adj-note"
                    placeholder="e.g. Expired batch or supplier delivery box #204"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setAdjustingIng(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Record in Ledger
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
