'use client'

import React, { createContext, useContext, useState } from 'react'
import { 
  INITIAL_BRANDS, 
  INITIAL_INGREDIENTS, 
  INITIAL_MENU_ITEMS, 
  INITIAL_ORDERS,
  INITIAL_STOCK_LEDGER 
} from '@/lib/mockData'
import { 
  Brand, 
  Ingredient, 
  MenuItem, 
  Order, 
  OrderStatus, 
  PackingChecklist,
  StockReasonCode,
  StockLedgerEntry,
  UserRole,
  KitchenLanguage
} from '@/types'
import { 
  CommissionSettings, 
  DEFAULT_COMMISSION_SETTINGS, 
  calculateOrderFinancials 
} from '@/lib/finance'

interface KitchenContextType {
  orders: Order[]
  ingredients: Ingredient[]
  menuItems: MenuItem[]
  brands: Brand[]
  stockLedger: StockLedgerEntry[]
  isPausedAll: boolean
  pausedPlatforms: { swiggy: boolean; zomato: boolean }
  commissionSettings: CommissionSettings
  userRole: UserRole
  language: KitchenLanguage
  inspectingOrder: Order | null
  setInspectingOrder: (order: Order | null) => void
  setUserRole: (role: UserRole) => void
  setLanguage: (lang: KitchenLanguage) => void
  updateCommissionSettings: (newSettings: Partial<CommissionSettings>) => void
  handleUpdateStatus: (orderId: string, newStatus: OrderStatus) => void
  handleToggleStationItem: (orderId: string, itemId: string) => void
  handleMarkOrderReady: (orderId: string) => void
  handleToggleChecklistItem: (orderId: string, key: keyof PackingChecklist) => void
  handleCompletePacking: (orderId: string) => void
  handleAdjustStockWithReason: (ingredientId: string, delta: number, reason: StockReasonCode, note?: string) => void
  handleTogglePlatformStatus: (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => void
  handleToggleEmergencyPause: (target: 'ALL' | 'SWIGGY' | 'ZOMATO') => void
  handleSimulateNewOrder: () => void
  handleAddMenuItem: (newItem: Omit<MenuItem, 'id'>) => void
  handleAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
}

const KitchenContext = createContext<KitchenContextType | null>(null)

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)
  const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS)
  const [brands] = useState<Brand[]>(INITIAL_BRANDS)
  const [stockLedger, setStockLedger] = useState<StockLedgerEntry[]>(INITIAL_STOCK_LEDGER)
  const [isPausedAll, setIsPausedAll] = useState(false)
  const [pausedPlatforms, setPausedPlatforms] = useState({ swiggy: false, zomato: false })
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS)
  const [userRole, setUserRole] = useState<UserRole>('OWNER')
  const [language, setLanguage] = useState<KitchenLanguage>('EN')
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null)

  const updateCommissionSettings = (newSettings: Partial<CommissionSettings>) => {
    setCommissionSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      // Recalculate all orders with the new settings to maintain 100% mathematical consistency
      setOrders((prevOrders) =>
        prevOrders.map((ord) => {
          const recalculated = calculateOrderFinancials({
            itemSubtotal: ord.financials.grossAmount,
            packagingFeeCollected: ord.financials.packagingFeeCollected,
            customerDiscount: ord.financials.discount,
            commissionRate: ord.financials.commissionRate,
            ingredientCost: ord.financials.ingredientCost,
            packagingMaterialCost: ord.financials.packagingCost,
            settings: updated,
          })
          return {
            ...ord,
            financials: recalculated.financials,
          }
        })
      )
      return updated
    })
  }

  // Auto-deduct inventory when order is accepted/preparing
  const deductIngredientsForOrder = (order: Order) => {
    const consumptionMap: Record<string, { quantity: number; unit: string; ingredientName: string }> = {}

    order.items.forEach((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId || m.name === item.name)
      if (menuItem && menuItem.recipe) {
        menuItem.recipe.forEach((r) => {
          const totalQty = r.quantity * item.quantity
          if (consumptionMap[r.ingredientId]) {
            consumptionMap[r.ingredientId].quantity += totalQty
          } else {
            consumptionMap[r.ingredientId] = {
              quantity: totalQty,
              unit: r.unit,
              ingredientName: r.ingredientName,
            }
          }
        })
      }
    })

    if (Object.keys(consumptionMap).length === 0) return

    // Apply deductions to stock and record in ledger
    setIngredients((prev) => {
      const updated = prev.map((ing) => {
        if (!consumptionMap[ing.id]) return ing
        const consumed = consumptionMap[ing.id].quantity
        const newStock = Math.max(0, ing.currentStock - consumed)
        return { ...ing, currentStock: newStock }
      })

      // Auto-86 Rule: Take dish offline if any ingredient in its recipe cannot fulfill even 1 portion,
      // or if the ingredient stock drops below its safe minimum threshold set by manager.
      setMenuItems((mPrev) =>
        mPrev.map((dish) => {
          const cannotMakePortion = dish.recipe.some((r) => {
            const ing = updated.find((i) => i.id === r.ingredientId)
            if (!ing) return true
            // Disallow if current stock is below 1 portion's required BOM quantity
            // or if current stock is below configured minimum safe threshold
            return ing.currentStock < r.quantity || ing.currentStock < ing.minThreshold
          })

          if (cannotMakePortion && dish.isAvailable) {
            return {
              ...dish,
              isAvailable: false,
              swiggyOnline: false,
              zomatoOnline: false,
              lastSyncedAt: new Date().toISOString(),
            }
          }
          return dish
        })
      )

      return updated
    })

    // Add ledger entries for auto-deduction
    const newLedgerEntries: StockLedgerEntry[] = Object.entries(consumptionMap).map(([ingId, info]) => {
      const currentIng = ingredients.find((i) => i.id === ingId)
      const prevStock = currentIng ? currentIng.currentStock : 0
      const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 9)
      return {
        id: `led-auto-${Date.now()}-${ingId}-${uniqueSuffix}`,
        ingredientId: ingId,
        ingredientName: info.ingredientName,
        previousStock: prevStock,
        delta: -info.quantity,
        newStock: Math.max(0, prevStock - info.quantity),
        unit: info.unit,
        reason: 'RECIPE_AUTO_CONSUMPTION',
        note: `Auto-deducted on prep start (${order.orderNumber})`,
        timestamp: new Date().toISOString(),
      }
    })

    setStockLedger((prev) => [...newLedgerEntries, ...prev])
  }

  const handleUpdateStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        
        // If transitioning to PREPARING, trigger end-to-end BOM inventory auto-deduction
        if (newStatus === 'PREPARING' && o.status !== 'PREPARING') {
          setTimeout(() => deductIngredientsForOrder(o), 0)
        }

        return { 
          ...o, 
          status: newStatus,
          acknowledgedAt: o.acknowledgedAt || (newStatus === 'ACCEPTED' ? new Date().toISOString() : undefined)
        }
      })
    )
  }

  const handleToggleStationItem = (orderId: string, itemId: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        const updatedItems = o.items.map((it) =>
          it.id === itemId ? { ...it, stationDone: !it.stationDone } : it
        )
        return { ...o, items: updatedItems }
      })
    )
  }

  const handleMarkOrderReady = (orderId: string) => {
    handleUpdateStatus(orderId, 'READY')
  }

  const handleToggleChecklistItem = (orderId: string, key: keyof PackingChecklist) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        return {
          ...o,
          checklist: {
            ...o.checklist,
            [key]: !o.checklist[key],
          },
        }
      })
    )
  }

  const handleCompletePacking = (orderId: string) => {
    handleUpdateStatus(orderId, 'READY')
  }

  const handleAdjustStockWithReason = (
    ingredientId: string, 
    delta: number, 
    reason: StockReasonCode, 
    note?: string
  ) => {
    setIngredients((prev) => {
      const target = prev.find((i) => i.id === ingredientId)
      if (!target) return prev

      const prevStock = target.currentStock
      const newStock = Math.max(0, prevStock + delta)

      // Add to Ledger with unique ID
      const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 9)
      const entry: StockLedgerEntry = {
        id: `led-${Date.now()}-${uniqueSuffix}`,
        ingredientId,
        ingredientName: target.name,
        previousStock: prevStock,
        delta,
        newStock,
        unit: target.unit,
        reason,
        note,
        timestamp: new Date().toISOString(),
      }
      setStockLedger((lPrev) => [entry, ...lPrev])

      const updated = prev.map((ing) => (ing.id === ingredientId ? { ...ing, currentStock: newStock } : ing))

      // Check auto-86 & auto-restock for dependent menu items across all brands
      setMenuItems((mPrev) =>
        mPrev.map((dish) => {
          const cannotMakePortion = dish.recipe.some((r) => {
            const ing = updated.find((i) => i.id === r.ingredientId)
            if (!ing) return true
            return ing.currentStock < r.quantity || ing.currentStock < ing.minThreshold
          })
          const wasOfflineFromStock = !dish.isAvailable
          // If all recipe ingredients are now sufficiently in stock, bring the dish back online
          const shouldRestore = wasOfflineFromStock && !cannotMakePortion
          return {
            ...dish,
            isAvailable: !cannotMakePortion,
            swiggyOnline: cannotMakePortion ? false : shouldRestore ? true : dish.swiggyOnline,
            zomatoOnline: cannotMakePortion ? false : shouldRestore ? true : dish.zomatoOnline,
            lastSyncedAt: new Date().toISOString(),
          }
        })
      )

      return updated
    })
  }

  const handleTogglePlatformStatus = (itemId: string, platform: 'SWIGGY' | 'ZOMATO') => {
    setMenuItems((prev) =>
      prev.map((dish) => {
        if (dish.id !== itemId) return dish
        const updated = {
          ...dish,
          swiggyOnline: platform === 'SWIGGY' ? !dish.swiggyOnline : dish.swiggyOnline,
          zomatoOnline: platform === 'ZOMATO' ? !dish.zomatoOnline : dish.zomatoOnline,
          lastSyncedAt: new Date().toISOString(),
        }
        updated.isAvailable = updated.swiggyOnline || updated.zomatoOnline
        return updated
      })
    )
  }

  const handleToggleEmergencyPause = (target: 'ALL' | 'SWIGGY' | 'ZOMATO') => {
    if (target === 'ALL') {
      const nextVal = !isPausedAll
      setIsPausedAll(nextVal)
      setPausedPlatforms({ swiggy: nextVal, zomato: nextVal })
    } else if (target === 'SWIGGY') {
      setPausedPlatforms((prev) => {
        const nextSwiggy = !prev.swiggy
        return { ...prev, swiggy: nextSwiggy }
      })
    } else if (target === 'ZOMATO') {
      setPausedPlatforms((prev) => {
        const nextZomato = !prev.zomato
        return { ...prev, zomato: nextZomato }
      })
    }
  }

  const handleSimulateNewOrder = () => {
    const randomChannel = Math.random() > 0.5 ? 'SWIGGY' : 'ZOMATO'
    
    // Choose between wrap or burger or biryani
    const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)] || menuItems[0]
    const qty = 2
    const itemSubtotal = randomItem.sellingPrice * qty
    const pkgFee = randomItem.packagingCost * qty
    const discount = 50
    const commRate = randomChannel === 'SWIGGY' ? 0.22 : 0.24
    
    // Calculate BOM cost from recipe
    let bomCost = 0
    randomItem.recipe.forEach((r) => {
      const ing = ingredients.find((i) => i.id === r.ingredientId)
      if (ing) {
        bomCost += r.quantity * qty * ing.costPerUnit
      }
    })
    if (bomCost === 0) bomCost = 85.0

    const fin = calculateOrderFinancials({
      itemSubtotal,
      packagingFeeCollected: pkgFee,
      customerDiscount: discount,
      commissionRate: commRate,
      ingredientCost: bomCost,
      packagingMaterialCost: pkgFee,
      settings: commissionSettings,
    }).financials

    const newOrd: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `#${randomChannel === 'SWIGGY' ? 'SW' : 'ZM'}-${Math.floor(1000 + Math.random() * 9000)}`,
      channel: randomChannel,
      brandId: randomItem.brandId,
      brandName: brands.find((b) => b.id === randomItem.brandId)?.name || 'Kitchen Brand',
      customerName: ['Kabir Mehta', 'Tanvi Deshmukh', 'Vikram Seth', 'Ananya Roy'][Math.floor(Math.random() * 4)],
      status: 'RECEIVED',
      targetPrepMinutes: 14,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: `oi-${Date.now()}`,
          menuItemId: randomItem.id,
          name: randomItem.name,
          station: randomItem.station,
          secondaryStations: randomItem.secondaryStations,
          quantity: qty,
          price: randomItem.sellingPrice,
          stationDone: false,
        }
      ],
      checklist: {
        cutlery: false,
        saucesDips: false,
        napkins: false,
        tamperSeal: false,
        beverageSeparated: false,
      },
      financials: fin,
    }

    setOrders((prev) => [newOrd, ...prev])
  }

  const handleAddMenuItem = (newItem: Omit<MenuItem, 'id'>) => {
    const itemWithId: MenuItem = {
      ...newItem,
      id: `m-${Date.now()}`,
    }
    setMenuItems((prev) => [itemWithId, ...prev])
  }

  const handleAddIngredient = (newIng: Omit<Ingredient, 'id'>) => {
    const ingWithId: Ingredient = {
      ...newIng,
      id: `i-${Date.now()}`,
    }
    setIngredients((prev) => [ingWithId, ...prev])
  }

  return (
    <KitchenContext.Provider
      value={{
        orders,
        ingredients,
        menuItems,
        brands,
        stockLedger,
        isPausedAll,
        pausedPlatforms,
        commissionSettings,
        userRole,
        language,
        inspectingOrder,
        setInspectingOrder,
        setUserRole,
        setLanguage,
        updateCommissionSettings,
        handleUpdateStatus,
        handleToggleStationItem,
        handleMarkOrderReady,
        handleToggleChecklistItem,
        handleCompletePacking,
        handleAdjustStockWithReason,
        handleTogglePlatformStatus,
        handleToggleEmergencyPause,
        handleSimulateNewOrder,
        handleAddMenuItem,
        handleAddIngredient,
      }}
    >
      {children}
    </KitchenContext.Provider>
  )
}

export function useKitchen() {
  const context = useContext(KitchenContext)
  if (!context) {
    throw new Error('useKitchen must be used within a KitchenProvider')
  }
  return context
}
