'use client'

import React, { useState, useEffect } from 'react'
import { Brand, Ingredient, MenuItem, Station, StockReasonCode, StockLedgerEntry, PurchaseOrder, InventoryCategory, StorageZone } from '@/types'
import { formatCurrency, formatStationName } from '@/lib/utils'
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
  Edit2,
  Store,
  ShoppingCart,
  Download,
  FileSpreadsheet,
  LayoutList,
  LayoutGrid,
  Search,
  Minus,
  Check,
  ChevronsUpDown
} from 'lucide-react'
import { estimateRecipeBOM, AIBOMSuggestion } from '@/lib/aiBOMEstimator'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { PurchaseOrderModal } from '@/components/inventory/PurchaseOrderModal'
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
  purchaseOrders?: PurchaseOrder[]
  userRole?: string
  onAdjustStockWithReason: (ingredientId: string, delta: number, reason: StockReasonCode, note?: string) => void
  onTogglePlatformStatus: (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => void
  onAddMenuItem: (newItem: Omit<MenuItem, 'id'>) => void
  onAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
  onUpdateMenuItemPrice?: (menuItemId: string, newSellingPrice: number, newPackagingCost?: number) => void
  onUpdateIngredientCost?: (ingredientId: string, newCostPerUnit: number) => void
  onCreatePurchaseOrder?: any
  onReceivePurchaseOrder?: any
}

export function InventoryView({
  ingredients,
  menuItems,
  brands,
  stockLedger,
  purchaseOrders = [],
  userRole = 'OWNER',
  onAdjustStockWithReason,
  onTogglePlatformStatus,
  onAddMenuItem,
  onAddIngredient,
  onUpdateMenuItemPrice,
  onUpdateIngredientCost,
  onCreatePurchaseOrder,
  onReceivePurchaseOrder,
}: InventoryViewProps) {
  const lowStockItems = ingredients.filter((i) => i.currentStock <= i.minThreshold)
  const [activeTab, setActiveTab] = useState<'STOCK' | 'MENU' | 'LEDGER'>('STOCK')
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL')
  const [selectedStockStatusFilter, setSelectedStockStatusFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL')
  const [stockViewMode, setStockViewMode] = useState<'TABLE' | 'CARDS'>('TABLE')
  const [ingredientSearch, setIngredientSearch] = useState<string>('')
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false)

  // Stock Adjustment Dialog State
  const [adjustingIng, setAdjustingIng] = useState<Ingredient | null>(null)
  const [adjustDelta, setAdjustDelta] = useState<string>('-10')
  const [adjustReason, setAdjustReason] = useState<StockReasonCode>('WASTAGE_SPOILAGE')
  const [adjustNote, setAdjustNote] = useState<string>('')

  // Edit Ingredient Cost Dialog State
  const [editingCostIng, setEditingCostIng] = useState<Ingredient | null>(null)
  const [newCostInput, setNewCostInput] = useState<string>('')

  // Edit Dish Selling Price Dialog State
  const [editingPriceDish, setEditingPriceDish] = useState<MenuItem | null>(null)
  const [newSellingPriceInput, setNewSellingPriceInput] = useState<string>('')
  const [newPkgCostInput, setNewPkgCostInput] = useState<string>('')

  // Dialog State: Add Menu Item
  const [isMenuItemDialogOpen, setIsMenuItemDialogOpen] = useState(false)
  const [newItemName, setNewItemName] = useState('')
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
      if (suggestion.station !== 'ASSEMBLY') {
        setShowMultiStations(true)
      }
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
  const [newIngBrandId, setNewIngBrandId] = useState<string>('SHARED')
  const [newIngCategory, setNewIngCategory] = useState<InventoryCategory>('DRY_STAPLES')
  const [newIngSupplier, setNewIngSupplier] = useState<string>('')
  const [newIngStorageZone, setNewIngStorageZone] = useState<StorageZone>('DRY_STORE')
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
          brandId: newItemBrandId,
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
      {/* Title Header & Action Modals (Apple HIG Header & Action Cluster) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Inventory & Recipes
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
              Auto-86 Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Stockroom tracking, ingredient BOM recipes, and Swiggy & Zomato sync
          </p>
        </div>

        {/* Action Button Cluster */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto overflow-x-auto no-scrollbar">
          {/* Primary Action: Order Stock */}
          <Button
            size="sm"
            onClick={() => setIsPurchaseOrderOpen(true)}
            className="flex-1 sm:flex-initial h-9 px-3.5 rounded-xl gap-1.5 font-bold shadow-xs bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all text-primary-foreground cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Order Stock</span>
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-mono leading-none rounded-full shadow-2xs">
                {lowStockItems.length}
              </Badge>
            )}
          </Button>

          {/* Secondary Action: Add Raw Ingredient SKU */}
          <Dialog open={isIngDialogOpen} onOpenChange={setIsIngDialogOpen}>
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
                    onClick={() => setIsIngDialogOpen(false)}
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

          {/* Secondary Action: Add Menu Item / Dish */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsMenuItemDialogOpen(true)}
            className="flex-1 sm:flex-initial text-xs h-9 px-3 rounded-xl gap-1.5 font-semibold border-border/80 bg-background/80 hover:bg-muted text-foreground active:scale-[0.98] transition-all shadow-2xs cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5 text-muted-foreground" />
            <span>+ Dish</span>
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
                          <span>
                            Station: {customStations.find((c) => c.id === newItemStation)?.label || formatStationName(newItemStation)}
                          </span>
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
                        <div className="flex items-center justify-between">
                          <Label htmlFor="menu-station">Cook Station</Label>
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
                              Reset to Main Kitchen
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowMultiStations(!showMultiStations)}
                              className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              {showMultiStations ? 'Hide Specialized' : '+ Specific Station'}
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
                              className="w-full h-9 justify-between text-xs font-normal border-border/80 bg-background hover:bg-muted/40 cursor-pointer"
                            >
                              <span className="truncate font-semibold">
                                {newItemStation === 'ASSEMBLY'
                                  ? 'Main Kitchen (Default)'
                                  : customStations.find((c) => c.id === newItemStation)?.label ||
                                  formatStationName(newItemStation)}
                              </span>
                              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
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
                                    <span> Main Kitchen (Default)</span>
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

                                {stationSearchQuery.trim() &&
                                  !['Main Kitchen', ...customStations.map((c) => c.label)].some(
                                    (l) => l.toLowerCase() === stationSearchQuery.trim().toLowerCase()
                                  ) && (
                                    <>
                                      <CommandSeparator />
                                      <CommandGroup>
                                        <CommandItem
                                          value={`add-${stationSearchQuery.trim()}`}
                                          onSelect={() => {
                                            const clean = stationSearchQuery.trim()
                                            const id = clean.toUpperCase().replace(/\s+/g, '_') as Station
                                            if (!customStations.some((c) => c.id === id)) {
                                              setCustomStations((prev) => [...prev, { id, label: clean }])
                                            }
                                            setNewItemStation(id)
                                            setStationSearchQuery('')
                                            setIsStationPopoverOpen(false)
                                          }}
                                          className="text-xs cursor-pointer text-primary font-bold gap-1.5"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Add new station: &quot;{stationSearchQuery.trim()}&quot;</span>
                                        </CommandItem>
                                      </CommandGroup>
                                    </>
                                  )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
              <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl p-5 pb-8 border-t border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl safe-area-pb">
                {/* Apple Sheet Drag Indicator Grabber */}
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

                      {/* AI Suggest Pill */}
                      <button
                        type="button"
                        disabled={!newItemName.trim() || isGeneratingAI}
                        onClick={() => handleGenerateAIBOM()}
                        className="h-7 px-2.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-bold flex items-center gap-1 active:scale-[0.96] transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary fill-primary" />
                        <span>{isGeneratingAI ? 'Estimating...' : 'AI Suggest'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                      Portion BOM recipes, station routing, and aggregator sync
                    </p>
                  </SheetHeader>

                  <div className="space-y-3.5 pt-1 text-xs">
                    {/* Dish Name & Voice Dictation */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mobile-menu-name" className="text-xs font-semibold">
                        Dish Name
                      </Label>
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
                            className="h-11 text-xs sm:text-sm pr-10 rounded-xl bg-background border-border/80"
                          />
                          <button
                            type="button"
                            onClick={handleToggleVoice}
                            title={isListening ? 'Listening...' : 'Voice input'}
                            className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all cursor-pointer",
                              isListening
                                ? "bg-destructive text-destructive-foreground animate-pulse shadow-md"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            {isListening ? <Mic className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                          </button>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!newItemName.trim() || isGeneratingAI}
                          onClick={() => handleGenerateAIBOM()}
                          className="h-11 px-3.5 shrink-0 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>AI BOM</span>
                        </Button>
                      </div>

                      {isListening && (
                        <p className="text-[11px] text-destructive font-semibold animate-pulse flex items-center gap-1.5 pt-0.5">
                          <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
                          Listening... Bolie dish ka naam (e.g., &quot;Corn Cheese Grilled Sandwich&quot;)
                        </p>
                      )}

                      {/* Quick Presets on Mobile */}
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar py-0.5">
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
                            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/70 shrink-0 font-medium active:scale-[0.97] transition-all cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI Generated BOM Preview Card & Interactive Recipe Customizer (Apple Inset Card) */}
                    {aiSuggestion && (
                      <div className="p-3.5 rounded-2xl border border-primary/30 bg-primary/5 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span className="flex items-center gap-1.5 text-primary">
                            <ChefHat className="w-4 h-4" />
                            <span>AI Commercial Recipe Breakdown</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Tap + / - to fine-tune
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {aiSuggestion.recipe.map((ing, idx) => (
                            <div
                              key={`${ing.ingredientName}-${idx}`}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/70 text-xs shadow-2xs"
                            >
                              <span className="font-semibold text-foreground truncate max-w-[130px]">
                                {ing.ingredientName}
                              </span>

                              <div className="flex items-center gap-2">
                                {/* Quantity Stepper */}
                                <div className="flex items-center border border-border/80 rounded-xl bg-muted/40 overflow-hidden h-8 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity - (ing.unit === 'pc' ? 1 : 10))}
                                    className="w-7 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold active:scale-[0.9] transition-all cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 font-mono font-bold text-primary text-xs min-w-[50px] text-center">
                                    {ing.quantity} {ing.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateIngredientQuantity(idx, ing.quantity + (ing.unit === 'pc' ? 1 : 10))}
                                    className="w-7 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-bold active:scale-[0.9] transition-all cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Delete Ingredient */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipeIngredient(idx)}
                                  title="Remove ingredient"
                                  className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.9] transition-all cursor-pointer"
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
                              className="text-xs text-primary hover:underline font-bold flex items-center gap-1 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Extra Ingredient</span>
                            </button>
                            <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                              {aiSuggestion.recipe.length} tracked SKUs
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Brand & Station Pickers */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-brand" className="text-xs font-semibold">
                          Brand
                        </Label>
                        <select
                          id="mobile-brand"
                          value={newItemBrandId}
                          onChange={(e) => setNewItemBrandId(e.target.value)}
                          className="w-full h-11 rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {brands.map((b) => (
                            <option key={b.id} value={b.id} className="bg-background text-foreground">
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="mobile-station" className="text-xs font-semibold">
                            Station
                          </Label>
                          {newItemStation !== 'ASSEMBLY' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setNewItemStation('ASSEMBLY')
                                setShowMultiStations(false)
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-semibold cursor-pointer"
                            >
                              Reset
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowMultiStations(!showMultiStations)}
                              className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              {showMultiStations ? 'Hide' : '+ Split Station'}
                            </button>
                          )}
                        </div>

                        <Popover open={isStationPopoverOpen} onOpenChange={setIsStationPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="mobile-station"
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={isStationPopoverOpen}
                              className="w-full h-11 justify-between text-xs font-normal border-border/80 bg-background hover:bg-muted/40 rounded-xl cursor-pointer"
                            >
                              <span className="truncate font-semibold">
                                {newItemStation === 'ASSEMBLY'
                                  ? 'Main Kitchen (Default)'
                                  : customStations.find((c) => c.id === newItemStation)?.label ||
                                  formatStationName(newItemStation)}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[85vw] max-w-xs p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search or type new station..."
                                value={stationSearchQuery}
                                onValueChange={setStationSearchQuery}
                                className="h-10 text-xs"
                              />
                              <CommandList className="max-h-[220px]">
                                <CommandEmpty className="py-2.5 px-3 text-xs text-muted-foreground">
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
                                    <span> Main Kitchen (Default)</span>
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
                                      { id: 'GRILL', label: 'Grill & Tawa' },
                                      { id: 'FRY', label: 'Fryer' },
                                      { id: 'BEVERAGE', label: 'Beverages' },
                                      { id: 'PIZZA', label: 'Pizza & Baking' },
                                      { id: 'WOK', label: 'Wok' },
                                      { id: 'TANDOOR', label: 'Tandoor' },
                                      { id: 'DUM_BIRYANI', label: 'Dum Biryani' },
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

                                {stationSearchQuery.trim() &&
                                  !['Main Kitchen', ...customStations.map((c) => c.label)].some(
                                    (l) => l.toLowerCase() === stationSearchQuery.trim().toLowerCase()
                                  ) && (
                                    <>
                                      <CommandSeparator />
                                      <CommandGroup>
                                        <CommandItem
                                          value={`add-${stationSearchQuery.trim()}`}
                                          onSelect={() => {
                                            const clean = stationSearchQuery.trim()
                                            const id = clean.toUpperCase().replace(/\s+/g, '_') as Station
                                            if (!customStations.some((c) => c.id === id)) {
                                              setCustomStations((prev) => [...prev, { id, label: clean }])
                                            }
                                            setNewItemStation(id)
                                            setStationSearchQuery('')
                                            setIsStationPopoverOpen(false)
                                          }}
                                          className="text-xs cursor-pointer text-primary font-bold gap-1.5"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Add new station: &quot;{stationSearchQuery.trim()}&quot;</span>
                                        </CommandItem>
                                      </CommandGroup>
                                    </>
                                  )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Price & Packaging Inputs with Embedded Affixes */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-price" className="text-xs font-semibold">
                          Selling Price (₹)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            ₹
                          </span>
                          <Input
                            id="mobile-price"
                            type="number"
                            placeholder="149"
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(e.target.value)}
                            required
                            className="h-11 pl-7 text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mobile-pkg" className="text-xs font-semibold">
                          Packaging (₹)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            ₹
                          </span>
                          <Input
                            id="mobile-pkg"
                            type="number"
                            placeholder="12"
                            value={newItemPkgCost}
                            onChange={(e) => setNewItemPkgCost(e.target.value)}
                            required
                            className="h-11 pl-7 text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Symmetrical Apple Sheet Footer */}
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
          )}
        </div>
      </div>

      {/* Apple HIG Segmented Control: Raw SKUs vs Menu Items vs Stock Ledger */}
      <div className="p-1 bg-muted/70 backdrop-blur-md rounded-2xl border border-border/60 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('STOCK')}
          className={cn(
            "flex-1 min-w-[110px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
            activeTab === 'STOCK'
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Boxes className={cn("w-3.5 h-3.5 shrink-0", activeTab === 'STOCK' ? "text-primary" : "text-muted-foreground")} />
          <span>Stockroom</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5 leading-none font-mono rounded-full border-border/60",
              activeTab === 'STOCK' ? "bg-primary/10 text-primary border-primary/20 font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            {ingredients.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MENU')}
          className={cn(
            "flex-1 min-w-[110px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
            activeTab === 'MENU'
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Utensils className={cn("w-3.5 h-3.5 shrink-0", activeTab === 'MENU' ? "text-primary" : "text-muted-foreground")} />
          <span className="hidden sm:inline">Menu & Sync</span>
          <span className="sm:hidden">Menu</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5 leading-none font-mono rounded-full border-border/60",
              activeTab === 'MENU' ? "bg-primary/10 text-primary border-primary/20 font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            {menuItems.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LEDGER')}
          className={cn(
            "flex-1 min-w-[110px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]",
            activeTab === 'LEDGER'
              ? "bg-background text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <History className={cn("w-3.5 h-3.5 shrink-0", activeTab === 'LEDGER' ? "text-primary" : "text-muted-foreground")} />
          <span className="hidden sm:inline">Audit Ledger</span>
          <span className="sm:hidden">Ledger</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5 leading-none font-mono rounded-full border-border/60",
              activeTab === 'LEDGER' ? "bg-primary/10 text-primary border-primary/20 font-bold" : "bg-muted text-muted-foreground"
            )}
          >
            {stockLedger.length}
          </Badge>
        </button>
      </div>

      {/* Brand-Scoped Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono shrink-0 mr-1 flex items-center gap-1">
          <Store className="w-3.5 h-3.5 text-primary" />
          <span>Brand:</span>
        </span>

        <button
          type="button"
          onClick={() => setSelectedBrandFilter('ALL')}
          className={cn(
            "h-8 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 active:scale-[0.98]",
            selectedBrandFilter === 'ALL'
              ? "bg-foreground text-background border-foreground shadow-2xs font-bold"
              : "bg-muted/50 text-muted-foreground border-border/70 hover:text-foreground"
          )}
        >
          All Brands ({brands.length})
        </button>

        {brands.map((b) => {
          const brandDishesCount = menuItems.filter((m) => m.brandId === b.id).length
          const isSelected = selectedBrandFilter === b.id

          return (
            <button
              type="button"
              key={b.id}
              onClick={() => setSelectedBrandFilter(b.id)}
              className={cn(
                "h-8 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-[0.98]",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                  : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: b.color }} />
              <span>{b.name}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {brandDishesCount}
              </span>
            </button>
          )
        })}
      </div>

      {/* Brand-filtered collections */}
      {(() => {
        // Filter menu items by selected brand
        const displayedMenuItems = selectedBrandFilter === 'ALL'
          ? menuItems
          : menuItems.filter((m) => m.brandId === selectedBrandFilter)

        // Filter raw ingredients used by this brand's recipes
        const brandIngredientIds = new Set<string>()
        displayedMenuItems.forEach((m) => {
          (m.recipe || []).forEach((r) => brandIngredientIds.add(r.ingredientId))
        })

        const displayedIngredients = selectedBrandFilter === 'ALL'
          ? ingredients
          : ingredients.filter((ing) =>
            ing.brandId === selectedBrandFilter ||
            brandIngredientIds.has(ing.id) ||
            displayedMenuItems.some(m => (m.recipe || []).some(r => r.ingredientName.toLowerCase() === ing.name.toLowerCase()))
          )

        // Filter ledger entries for those ingredients
        const displayedIngredientNames = new Set(displayedIngredients.map((i) => i.name.toLowerCase()))
        const displayedStockLedger = selectedBrandFilter === 'ALL'
          ? stockLedger
          : stockLedger.filter((entry) => displayedIngredientNames.has(entry.ingredientName.toLowerCase()))

        const activeBrand = brands.find((b) => b.id === selectedBrandFilter)

        return (
          <>

            {/* Tab 1: Raw Ingredients */}
            {activeTab === 'STOCK' && (() => {
              // Filter by category, stock status, and search query
              const filteredIngredients = displayedIngredients.filter((ing) => {
                // Category filter
                if (selectedCategoryFilter !== 'ALL' && ing.category !== selectedCategoryFilter) {
                  return false
                }
                // Stock status filter
                if (selectedStockStatusFilter === 'LOW' && (ing.currentStock > ing.minThreshold || ing.currentStock <= 0)) {
                  return false
                }
                if (selectedStockStatusFilter === 'OUT' && ing.currentStock > 0) {
                  return false
                }
                // Text search query
                if (!ingredientSearch.trim()) return true
                const q = ingredientSearch.toLowerCase()
                const brandName = brands.find(b => b.id === ing.brandId)?.name.toLowerCase() || ''
                const catName = (ing.category || '').toLowerCase().replace(/_/g, ' ')
                const supplier = (ing.supplierName || '').toLowerCase()
                return ing.name.toLowerCase().includes(q) || brandName.includes(q) || ing.unit.toLowerCase().includes(q) || catName.includes(q) || supplier.includes(q)
              })

              const sortedIngredients = [...filteredIngredients].sort((a, b) => {
                const aUrgency = a.currentStock <= 0 ? 0 : a.currentStock <= a.minThreshold ? 1 : 2
                const bUrgency = b.currentStock <= 0 ? 0 : b.currentStock <= b.minThreshold ? 1 : 2
                return aUrgency - bUrgency
              })

              return (
                <div className="space-y-3.5">
                  {/* Low Stock Warning Alert Banner (Apple HIG Inset Notification) */}
                  {lowStockItems.length > 0 && (
                    <div className="flex items-center justify-between p-3 px-3.5 rounded-2xl border border-destructive/30 bg-destructive/10 text-foreground text-xs shadow-xs">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
                        <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
                        <span className="font-semibold text-xs">
                          {lowStockItems.length} {lowStockItems.length === 1 ? 'item is' : 'items are'} depleted or below safety threshold.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPurchaseOrderOpen(true)}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive text-[11px] font-bold active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                      >
                        <span>Order Now</span>
                        <span aria-hidden="true">&rarr;</span>
                      </button>
                    </div>
                  )}

                  {/* View Mode Switch & Search Filter Bar (Apple HIG Layout) */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                    {/* Search Field & Filters Group */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                      {/* Apple HIG iOS Search Field */}
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80 pointer-events-none" />
                        <Input
                          type="text"
                          placeholder="Search ingredient, category, supplier..."
                          value={ingredientSearch}
                          onChange={(e) => setIngredientSearch(e.target.value)}
                          className="h-10 pl-9 pr-9 text-xs sm:text-sm bg-muted/40 hover:bg-muted/60 focus-visible:bg-background rounded-xl border-border/70 transition-all shadow-2xs"
                        />
                        {ingredientSearch && (
                          <button
                            type="button"
                            onClick={() => setIngredientSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Category Filter Select */}
                      <div className="w-full sm:w-[170px]">
                        <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                          <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-xs font-semibold">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                            <SelectItem value="ALL" className="text-xs font-semibold">All Categories</SelectItem>
                            <SelectItem value="DRY_STAPLES" className="text-xs">Dry Staples & Spices</SelectItem>
                            <SelectItem value="PRODUCE_DAIRY" className="text-xs">Dairy & Fresh Produce</SelectItem>
                            <SelectItem value="MEAT_POULTRY" className="text-xs">Meat & Poultry</SelectItem>
                            <SelectItem value="PACKAGING" className="text-xs">Packaging & Disposables</SelectItem>
                            <SelectItem value="BEVERAGES_RETAIL" className="text-xs">Retail Drinks & Cans</SelectItem>
                            <SelectItem value="CENTRAL_PREP" className="text-xs">Central Base & Prep</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Stock Health Status Filter Select */}
                      <div className="w-full sm:w-[150px]">
                        <Select value={selectedStockStatusFilter} onValueChange={(val) => setSelectedStockStatusFilter(val as 'ALL' | 'LOW' | 'OUT')}>
                          <SelectTrigger className="h-10 rounded-xl border border-border/70 bg-background text-xs font-semibold">
                            <SelectValue placeholder="All Stock Status" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg">
                            <SelectItem value="ALL" className="text-xs font-semibold">All Stock</SelectItem>
                            <SelectItem value="LOW" className="text-xs text-amber-600 dark:text-amber-400 font-medium">Low Stock (&lt; Min)</SelectItem>
                            <SelectItem value="OUT" className="text-xs text-destructive font-medium">Out of Stock (86)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* View Toggle: Table vs Cards (Apple HIG Segmented Switcher) */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {sortedIngredients.length} {sortedIngredients.length === 1 ? 'item' : 'items'}
                      </span>
                      <div className="flex items-center bg-muted/70 p-1 rounded-xl border border-border/60 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setStockViewMode('TABLE')}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]",
                            stockViewMode === 'TABLE'
                              ? "bg-background text-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <LayoutList className={cn("w-3.5 h-3.5", stockViewMode === 'TABLE' ? "text-primary" : "text-muted-foreground")} />
                          <span>Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockViewMode('CARDS')}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]",
                            stockViewMode === 'CARDS'
                              ? "bg-background text-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <LayoutGrid className={cn("w-3.5 h-3.5", stockViewMode === 'CARDS' ? "text-primary" : "text-muted-foreground")} />
                          <span>Cards</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mode 1: Clean Minimal Table View */}
                  {stockViewMode === 'TABLE' && (
                    <div className="rounded-2xl border border-border/80 bg-card/90 overflow-hidden shadow-xs">
                      {/* Mobile scroll hint indicator */}
                      <div className="sm:hidden px-3.5 py-1.5 bg-muted/40 border-b border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>Swipe horizontally to view full stock columns</span>
                        <span className="text-primary font-bold">Scroll &rarr;</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[700px]">
                          <thead className="bg-muted/50 border-b border-border/80 text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                            <tr>
                              <th className="py-3 px-4 whitespace-nowrap">Ingredient Name</th>
                              <th className="py-3 px-3 whitespace-nowrap">Brand</th>
                              <th className="py-3 px-3 whitespace-nowrap">Category</th>
                              <th className="py-3 px-3 whitespace-nowrap">Location</th>
                              <th className="py-3 px-3 whitespace-nowrap">Supplier</th>
                              <th className="py-3 px-3 text-right whitespace-nowrap">In Stock</th>
                              <th className="py-3 px-3 text-right whitespace-nowrap">Min Buffer</th>
                              <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                              {userRole === 'OWNER' && (
                                <th className="py-3 px-3 text-right whitespace-nowrap">Unit Cost</th>
                              )}
                              <th className="py-3 px-4 text-right whitespace-nowrap">Quick Stock Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {sortedIngredients.length === 0 ? (
                              <tr>
                                <td colSpan={userRole === 'OWNER' ? 10 : 9} className="py-12 text-center text-muted-foreground text-xs">
                                  <p className="font-semibold text-foreground">No ingredients found</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">Try adjusting your search query or brand filter.</p>
                                </td>
                              </tr>
                            ) : (
                              sortedIngredients.map((ing) => {
                                const isZero = ing.currentStock <= 0
                                const isLow = ing.currentStock <= ing.minThreshold
                                const brand = brands.find(b => b.id === ing.brandId)

                                return (
                                  <tr
                                    key={ing.id}
                                    className={cn(
                                      "hover:bg-muted/40 transition-colors",
                                      isZero && "bg-destructive/5 hover:bg-destructive/10",
                                      !isZero && isLow && "bg-amber-500/5 hover:bg-amber-500/10"
                                    )}
                                  >
                                    {/* Name and Storage Location */}
                                    <td className="py-3 px-4 whitespace-nowrap">
                                      <div className="space-y-0.5">
                                        <span className="font-bold text-foreground text-xs sm:text-sm">
                                          {ing.name}
                                        </span>
                                        <p className="text-[11px] text-muted-foreground font-mono">
                                          {ing.storageZone
                                            ? ing.storageZone === 'CHILLER'
                                              ? 'Chiller'
                                              : ing.storageZone === 'FREEZER'
                                              ? 'Freezer'
                                              : ing.storageZone === 'DRY_STORE'
                                              ? 'Dry Store'
                                              : ing.storageZone === 'PACKAGING_BAY'
                                              ? 'Packaging Bay'
                                              : ing.storageZone === 'STATION_LINE'
                                              ? 'Station Line'
                                              : String(ing.storageZone).replace(/_/g, ' ')
                                            : 'Dry Store'}
                                        </p>
                                      </div>
                                    </td>

                                    {/* Brand */}
                                    <td className="py-3.5 px-3 whitespace-nowrap">
                                      {brand ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                                          <span
                                            className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                                            style={{ backgroundColor: brand.color }}
                                          />
                                          <span>{brand.name}</span>
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">Shared SKU</span>
                                      )}
                                    </td>

                                    {/* Category */}
                                    <td className="py-3.5 px-3 whitespace-nowrap">
                                      <Badge variant="outline" className="text-[10px] font-mono border-border/80 bg-muted/40 text-muted-foreground rounded-lg px-2 py-0.5">
                                        {ing.category ? ing.category.replace(/_/g, ' ') : 'DRY STAPLES'}
                                      </Badge>
                                    </td>

                                    {/* Storage Zone / Location */}
                                    <td className="py-3.5 px-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                                      {ing.storageZone ? ing.storageZone.replace(/_/g, ' ') : 'DRY STORE'}
                                    </td>

                                    {/* Supplier / Vendor */}
                                    <td className="py-3.5 px-3 whitespace-nowrap text-xs text-foreground font-medium">
                                      {ing.supplierName || <span className="text-muted-foreground">—</span>}
                                    </td>

                                    {/* In Stock */}
                                    <td className="py-3.5 px-3 text-right font-mono font-bold text-xs sm:text-sm whitespace-nowrap">
                                      <span
                                        className={cn(
                                          isZero ? "text-destructive font-extrabold" : isLow ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground"
                                        )}
                                      >
                                        {ing.currentStock}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground font-normal ml-1">
                                        {ing.unit}
                                      </span>
                                    </td>

                                    {/* Min Buffer */}
                                    <td className="py-3.5 px-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                      {ing.minThreshold} {ing.unit}
                                    </td>

                                    {/* Status Badge */}
                                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                      {isZero ? (
                                        <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                                          Out of Stock (86)
                                        </Badge>
                                      ) : isLow ? (
                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                                          Low Stock
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono px-2 py-0.5 rounded-full">
                                          Normal
                                        </Badge>
                                      )}
                                    </td>

                                    {/* Unit Cost (Owner only with Quick Edit) */}
                                    {userRole === 'OWNER' && (
                                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingCostIng(ing)
                                            setNewCostInput(ing.costPerUnit.toString())
                                          }}
                                          className="inline-flex items-center gap-1 font-mono text-xs text-foreground font-semibold hover:text-primary hover:underline cursor-pointer group"
                                          title="Click to adjust unit cost"
                                        >
                                          <span>{formatCurrency(ing.costPerUnit)}</span>
                                          <span className="text-[10px] text-muted-foreground">/{ing.unit}</span>
                                          <Edit2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70 ml-0.5" />
                                        </button>
                                      </td>
                                    )}

                                    {/* Simple Single Action Button */}
                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setAdjustingIng(ing)
                                            setAdjustDelta('-1')
                                            setAdjustReason('WASTAGE_SPOILAGE')
                                          }}
                                          className="h-8 px-3 text-xs font-semibold rounded-xl bg-background hover:bg-muted border-border/80 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                                        >
                                          <span>Adjust Stock</span>
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Apple HIG Stock Cards View */}
                  {stockViewMode === 'CARDS' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {sortedIngredients.map((ing) => {
                        const isZero = ing.currentStock <= 0
                        const isLow = ing.currentStock <= ing.minThreshold
                        const brand = brands.find(b => b.id === ing.brandId)

                        // Stock health percentage (capped at 100%)
                        const stockHealth = ing.minThreshold > 0
                          ? Math.min(100, Math.round((ing.currentStock / (ing.minThreshold * 2)) * 100))
                          : 100

                        return (
                          <Card
                            key={ing.id}
                            className={cn(
                              "p-4 rounded-2xl flex flex-col justify-between border transition-all shadow-2xs",
                              isZero
                                ? "border-destructive/40 bg-destructive/5"
                                : isLow
                                  ? "border-amber-500/40 bg-amber-500/5"
                                  : "border-border/80 bg-card/90 hover:border-primary/40"
                            )}
                          >
                            <div className="space-y-3">
                              {/* Header: Title, Brand, and Status Badge */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-foreground leading-snug">
                                    {ing.name}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                    <span>
                                      {ing.storageZone
                                        ? ing.storageZone === 'CHILLER'
                                          ? 'Chiller'
                                          : ing.storageZone === 'FREEZER'
                                          ? 'Freezer'
                                          : ing.storageZone === 'DRY_STORE'
                                          ? 'Dry Store'
                                          : ing.storageZone === 'PACKAGING_BAY'
                                          ? 'Packaging Bay'
                                          : ing.storageZone === 'STATION_LINE'
                                          ? 'Station Line'
                                          : String(ing.storageZone).replace(/_/g, ' ')
                                        : 'Dry Store'}
                                    </span>
                                    {brand && (
                                      <>
                                        <span>&bull;</span>
                                        <span className="flex items-center gap-1 font-sans font-medium text-foreground">
                                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: brand.color }} />
                                          <span>{brand.name}</span>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {isZero ? (
                                  <Badge className="bg-destructive/15 text-destructive border border-destructive/30 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0">
                                    Out of Stock
                                  </Badge>
                                ) : isLow ? (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0">
                                    Low Stock
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0">
                                    Normal
                                  </Badge>
                                )}
                              </div>

                              {/* Stock Level & Visual Health Bar */}
                              <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2">
                                <div className="flex items-baseline justify-between font-mono">
                                  <span className="text-xs text-muted-foreground font-sans font-medium">Stock Level:</span>
                                  <div className="text-right">
                                    <span
                                      className={cn(
                                        "text-lg font-extrabold tracking-tight",
                                        isZero ? "text-destructive" : isLow ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                                      )}
                                    >
                                      {ing.currentStock}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-1">
                                      {ing.unit}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground/70 ml-1.5 font-sans">
                                      (min {ing.minThreshold})
                                    </span>
                                  </div>
                                </div>

                                {/* Progress Health Meter */}
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      isZero ? "w-0 bg-destructive" : isLow ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${Math.max(4, stockHealth)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Owner Unit Cost Row with 1-Tap Edit Trigger */}
                              {userRole === 'OWNER' && (
                                <div className="flex items-center justify-between text-xs px-0.5">
                                  <span className="text-muted-foreground font-medium">Unit Cost:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCostIng(ing)
                                      setNewCostInput(ing.costPerUnit.toString())
                                    }}
                                    className="inline-flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary transition-colors cursor-pointer group"
                                    title="Click to update cost"
                                  >
                                    <span>{formatCurrency(ing.costPerUnit)}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">/{ing.unit}</span>
                                    <Edit2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70 ml-0.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Action Bar: Quick Stepper Buttons + Adjust Stock */}
                            <div className="pt-3 border-t border-border/60 mt-3 flex items-center gap-2">
                              {/* Quick 1-tap decrement (-1 or -100) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const delta = ing.unit === 'pc' ? -1 : -100
                                  onAdjustStockWithReason(ing.id, delta, 'WASTAGE_SPOILAGE', 'Quick decrement')
                                }}
                                className="h-9 px-2.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted text-xs font-mono font-bold text-destructive active:scale-[0.96] transition-all cursor-pointer shadow-2xs"
                                title={`Quick -${ing.unit === 'pc' ? '1' : '100'} ${ing.unit}`}
                              >
                                -{ing.unit === 'pc' ? '1' : '100'}
                              </button>

                              {/* Quick 1-tap increment (+1 or +100) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const delta = ing.unit === 'pc' ? 1 : 100
                                  onAdjustStockWithReason(ing.id, delta, 'PURCHASE_INFLOW', 'Quick restock')
                                }}
                                className="h-9 px-2.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 active:scale-[0.96] transition-all cursor-pointer shadow-2xs"
                                title={`Quick +${ing.unit === 'pc' ? '1' : '100'} ${ing.unit}`}
                              >
                                +{ing.unit === 'pc' ? '1' : '100'}
                              </button>

                              {/* Detailed Adjust Modal Trigger */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAdjustingIng(ing)
                                  setAdjustDelta('-1')
                                  setAdjustReason('WASTAGE_SPOILAGE')
                                }}
                                className="flex-1 h-9 rounded-xl text-xs font-semibold bg-background hover:bg-muted border-border/80 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                              >
                                Adjust
                              </Button>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

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
                    className="text-xs h-9 px-3.5 rounded-xl gap-1.5 font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 shadow-2xs self-start sm:self-auto cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>✨ AI Smart Recipe Wizard</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {displayedMenuItems.map((item) => {
                    const brand = brands.find((b) => b.id === item.brandId)

                    return (
                      <Card
                        key={item.id}
                        className={cn(
                          "p-4 rounded-2xl flex flex-col justify-between shadow-2xs border transition-all",
                          !item.isAvailable ? "opacity-60 bg-muted/30 border-dashed" : "border-border/80 bg-card/90"
                        )}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand?.color }} />
                                  <span>{brand?.name}</span>
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                  Station: {formatStationName(item.station)}
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
                              {userRole === 'OWNER' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPriceDish(item)
                                    setNewSellingPriceInput(item.sellingPrice.toString())
                                    setNewPkgCostInput(item.packagingCost.toString())
                                  }}
                                  className="text-right group cursor-pointer block hover:opacity-80"
                                  title="Click to edit selling price & packaging fee"
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-sm font-bold text-foreground font-mono group-hover:text-primary transition-colors">
                                      {formatCurrency(item.sellingPrice)}
                                    </span>
                                    <Edit2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70" />
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    Pkg: {formatCurrency(item.packagingCost)}
                                  </p>
                                </button>
                              ) : (
                                <>
                                  <span className="text-sm font-bold text-foreground font-mono">
                                    {formatCurrency(item.sellingPrice)}
                                  </span>
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    Pkg: {formatCurrency(item.packagingCost)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Recipe Ingredients */}
                          <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40 text-[11px] space-y-1">
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
                                    className="text-[9px] px-1.5 py-0.5 font-normal font-mono rounded-md"
                                  >
                                    {r.ingredientName} ({r.quantity}{r.unit})
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Independent Swiggy & Zomato Status Buttons with Last Sync */}
                        <div className="pt-3 border-t border-border/60 space-y-2 mt-2">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>Platform Status:</span>
                            <span>Synced: ~3m ago</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {/* Swiggy Button */}
                            <button
                              type="button"
                              onClick={() => onTogglePlatformStatus(item.id, 'SWIGGY')}
                              className={cn(
                                "h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border active:scale-[0.98]",
                                item.swiggyOnline
                                  ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400 font-bold"
                                  : "bg-muted/40 border-border/60 text-muted-foreground"
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full", item.swiggyOnline ? "bg-orange-500" : "bg-muted-foreground/40")} />
                                <span>Swiggy</span>
                              </div>
                              <span className="text-[10px] font-mono uppercase tracking-wider">
                                {item.swiggyOnline ? "ON" : "OFF"}
                              </span>
                            </button>

                            {/* Zomato Button */}
                            <button
                              type="button"
                              onClick={() => onTogglePlatformStatus(item.id, 'ZOMATO')}
                              className={cn(
                                "h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border active:scale-[0.98]",
                                item.zomatoOnline
                                  ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400 font-bold"
                                  : "bg-muted/40 border-border/60 text-muted-foreground"
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full", item.zomatoOnline ? "bg-red-500" : "bg-muted-foreground/40")} />
                                <span>Zomato</span>
                              </div>
                              <span className="text-[10px] font-mono uppercase tracking-wider">
                                {item.zomatoOnline ? "ON" : "OFF"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: Stock Audit Ledger (Apple HIG Inset Table) */}
            {activeTab === 'LEDGER' && (
              <Card className="p-4 sm:p-5 rounded-2xl border-border/80 bg-card/90 backdrop-blur-md shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                      <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
                        Stock Ledger & Variance Audit Trail
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deductions, recipe prep consumption, spoilage, and supplier purchase history
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (stockLedger.length === 0) return
                        const headers = ['Timestamp', 'Ingredient', 'Reason Code', 'Previous Stock', 'Change Delta', 'New Stock', 'Unit', 'Audit Note']
                        const rows = stockLedger.map((e) => [
                          `"${new Date(e.timestamp).toLocaleString('en-IN')}"`,
                          `"${e.ingredientName.replace(/"/g, '""')}"`,
                          `"${e.reason}"`,
                          e.previousStock,
                          e.delta,
                          e.newStock,
                          `"${e.unit}"`,
                          `"${(e.note || '').replace(/"/g, '""')}"`
                        ])
                        const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
                        const link = document.createElement('a')
                        link.setAttribute('href', encodeURI(csv))
                        link.setAttribute('download', `KitchFlow_Stock_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                      className="h-9 px-3 text-xs font-semibold rounded-xl gap-1.5 border-border/80 bg-background/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Export CSV</span>
                    </Button>
                    <Badge variant="outline" className="font-mono text-[11px] h-9 px-2.5 rounded-xl border-border/80 bg-muted/40">
                      {stockLedger.length} Events
                    </Badge>
                  </div>
                </div>

                {/* Mobile Swipe Guidance Banner */}
                <div className="sm:hidden px-3.5 py-1.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>Swipe horizontally to view full audit columns</span>
                  <span className="text-primary font-bold">Scroll &rarr;</span>
                </div>

                {/* Responsive Table Wrapper */}
                <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/50">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-[640px] w-full text-left text-xs divide-y divide-border/60">
                      <thead className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                        <tr>
                          <th scope="col" className="py-3 px-3.5 w-[100px]">Time</th>
                          <th scope="col" className="py-3 px-3.5 w-[160px]">Ingredient</th>
                          <th scope="col" className="py-3 px-3.5 w-[160px]">Reason Code</th>
                          <th scope="col" className="py-3 px-3 text-right w-[100px]">Change</th>
                          <th scope="col" className="py-3 px-3.5 text-right w-[100px]">Stock</th>
                          <th scope="col" className="py-3 px-3.5">Audit Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 font-mono">
                        {stockLedger.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs font-sans">
                              <p className="font-semibold text-foreground">No ledger events recorded yet</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Adjust stock or fulfill purchase orders to create audit entries.</p>
                            </td>
                          </tr>
                        ) : (
                          stockLedger.map((entry, idx) => {
                            const isDeduction = entry.delta < 0
                            const isPurchase = entry.reason === 'PURCHASE_INFLOW'

                            return (
                              <tr key={entry.id ? `${entry.id}-${idx}` : `ledger-${idx}`} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-3.5 text-muted-foreground text-[11px] whitespace-nowrap">
                                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-3 px-3.5 font-bold text-foreground text-xs whitespace-nowrap">
                                  {entry.ingredientName}
                                </td>
                                <td className="py-3 px-3.5 whitespace-nowrap">
                                  <Badge
                                    className={cn(
                                      "text-[10px] font-medium font-sans uppercase px-2 py-0.5 rounded-full border whitespace-nowrap",
                                      entry.reason === 'WASTAGE_SPOILAGE'
                                        ? "bg-destructive/15 text-destructive border-destructive/30"
                                        : isPurchase
                                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                          : "bg-muted text-muted-foreground border-border/80"
                                    )}
                                  >
                                    {entry.reason.replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                                  <span className={isDeduction ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta} {entry.unit}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-right text-foreground font-bold whitespace-nowrap">
                                  {entry.newStock} {entry.unit}
                                </td>
                                <td className="py-3 px-3.5 text-muted-foreground font-sans text-xs min-w-[140px]">
                                  {entry.note || 'Manual line adjustment'}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}
          </>
        )
      })()}

      {/* Stock Adjustment with Reason Code Modal (Apple HIG Inset Modal) */}
      <Dialog open={Boolean(adjustingIng)} onOpenChange={(open) => !open && setAdjustingIng(null)}>
        <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
          {adjustingIng && (
            <form onSubmit={handleCommitAdjustment} className="space-y-4">
              <DialogHeader className="text-left space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                    Stock Adjustment
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {adjustingIng.name} &bull; Unit: <span className="font-mono font-semibold">{adjustingIng.unit}</span>
                </p>
              </DialogHeader>

              {/* Current Stock Banner */}
              <div className="p-3 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Current Stockroom:</span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {adjustingIng.currentStock} {adjustingIng.unit}
                </span>
              </div>

              {/* Quick Preset Buttons for 1-Tap Mobile Kitchen Use */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                  Quick Delta Presets:
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {getUnitPresets(adjustingIng.unit).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setAdjustDelta(preset.delta.toString())
                        setAdjustReason(preset.reason)
                      }}
                      className={cn(
                        "py-1.5 px-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer text-center active:scale-[0.97]",
                        adjustDelta === preset.delta.toString()
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                          : "bg-background/80 hover:bg-muted text-foreground border-border/70"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjustment Delta Input */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-delta" className="text-xs font-semibold">
                  Adjustment Quantity ({adjustingIng.unit})
                </Label>
                <div className="relative">
                  <Input
                    id="adj-delta"
                    type="number"
                    step="any"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    required
                    className="h-10 text-sm font-mono font-bold bg-background rounded-xl border-border/80"
                    placeholder="e.g. -500 or +1000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                    {adjustingIng.unit}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Use negative values (e.g., -5) for wastage/prep; positive for restocking.
                </p>
              </div>

              {/* Reason Code Dropdown */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-reason" className="text-xs font-semibold">
                  Audit Reason Code
                </Label>
                <select
                  id="adj-reason"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as StockReasonCode)}
                  className="w-full h-10 rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

              {/* Staff Remark */}
              <div className="space-y-1.5">
                <Label htmlFor="adj-note" className="text-xs font-semibold">
                  Staff Remark (Optional)
                </Label>
                <Input
                  id="adj-note"
                  placeholder="e.g. Expired batch or box #204"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="h-10 text-xs bg-background rounded-xl border-border/80"
                />
              </div>

              {/* Apple HIG Action Footer: Cancel + Confirm */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustingIng(null)}
                  className="h-11 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                >
                  Record in Ledger
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase Order & Procurement Indent Modal */}
      <PurchaseOrderModal
        open={isPurchaseOrderOpen}
        onOpenChange={setIsPurchaseOrderOpen}
        ingredients={ingredients}
        brands={brands}
        onSavePurchaseOrder={onCreatePurchaseOrder}
        onFulfillPurchaseOrder={(items) => {
          items.forEach((it) => {
            onAdjustStockWithReason(
              it.ingredientId,
              it.addedStock,
              'PURCHASE_INFLOW',
              'Supplier order received & stocked'
            )
          })
        }}
      />

      {/* Edit Ingredient Unit Cost Modal (Apple HIG Dialog) */}
      <Dialog open={Boolean(editingCostIng)} onOpenChange={(open) => !open && setEditingCostIng(null)}>
        <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
          {editingCostIng && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const cost = parseFloat(newCostInput)
                if (!isNaN(cost) && onUpdateIngredientCost) {
                  onUpdateIngredientCost(editingCostIng.id, cost)
                }
                setEditingCostIng(null)
              }}
              className="space-y-4"
            >
              <DialogHeader className="text-left space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                    Update Ingredient Cost
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {editingCostIng.name} &bull; Unit: <span className="font-mono font-semibold">{editingCostIng.unit}</span>
                </p>
              </DialogHeader>

              <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-xs text-muted-foreground leading-relaxed">
                Update your supplier purchase cost per {editingCostIng.unit}. Changes automatically recalculate recipe BOM food margins across all brands.
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-unit-cost" className="text-xs font-semibold">
                  Cost per {editingCostIng.unit} (₹)
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
                    value={newCostInput}
                    onChange={(e) => setNewCostInput(e.target.value)}
                    required
                    className="h-11 pl-8 text-base font-mono font-bold bg-background rounded-xl border-border/80"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                    /{editingCostIng.unit}
                  </span>
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCostIng(null)}
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
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dish Selling Price & Packaging Cost Modal (Apple HIG Dialog) */}
      <Dialog open={Boolean(editingPriceDish)} onOpenChange={(open) => !open && setEditingPriceDish(null)}>
        <DialogContent className="w-[94vw] max-w-md p-5 sm:p-6 rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
          {editingPriceDish && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const price = parseFloat(newSellingPriceInput)
                const pkg = parseFloat(newPkgCostInput)
                if (!isNaN(price) && onUpdateMenuItemPrice) {
                  onUpdateMenuItemPrice(editingPriceDish.id, price, isNaN(pkg) ? undefined : pkg)
                }
                setEditingPriceDish(null)
              }}
              className="space-y-4"
            >
              <DialogHeader className="text-left space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                    Adjust Selling Price & Packaging
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {editingPriceDish.name}
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
                      value={newSellingPriceInput}
                      onChange={(e) => setNewSellingPriceInput(e.target.value)}
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
                      value={newPkgCostInput}
                      onChange={(e) => setNewPkgCostInput(e.target.value)}
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
                  onClick={() => setEditingPriceDish(null)}
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
