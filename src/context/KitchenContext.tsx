'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { 
  INITIAL_BRANDS, 
  INITIAL_INGREDIENTS, 
  INITIAL_MENU_ITEMS, 
  INITIAL_ORDERS,
  INITIAL_STOCK_LEDGER,
  INITIAL_PURCHASE_ORDERS
} from '@/lib/mockData'
import { 
  Brand, 
  Channel,
  Ingredient, 
  MenuItem, 
  Order, 
  OrderStatus, 
  PackingChecklist,
  StockReasonCode,
  StockLedgerEntry,
  PurchaseOrder,
  PurchaseOrderItem,
  InventoryCategory,
  UserRole,
  KitchenLanguage,
  PaymentMethod,
  PaymentStatus
} from '@/types'
import { 
  CommissionSettings, 
  DEFAULT_COMMISSION_SETTINGS, 
  calculateOrderFinancials 
} from '@/lib/finance'
import { useRealtimeReconnection } from '@/hooks/useRealtimeReconnection'
import { getNavCountsAction, NavCountsResult } from '@/features/orders/order-actions'

interface KitchenContextType {
  orders: Order[]
  isOrdersLoaded: boolean
  navCounts: NavCountsResult | null
  refreshNavCounts: () => Promise<void>
  ingredients: Ingredient[]
  menuItems: MenuItem[]
  brands: Brand[]
  stockLedger: StockLedgerEntry[]
  purchaseOrders: PurchaseOrder[]
  isPausedAll: boolean
  pausedPlatforms: { swiggy: boolean; zomato: boolean }
  commissionSettings: CommissionSettings
  userRole: UserRole
  language: KitchenLanguage
  inspectingOrder: Order | null
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>
  setIsOrdersLoaded: (loaded: boolean) => void
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>
  setStockLedger: React.Dispatch<React.SetStateAction<StockLedgerEntry[]>>
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>
  setBrands: React.Dispatch<React.SetStateAction<Brand[]>>
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>
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
  handleCreateManualOrder: (params: {
    brandId: string
    channel: Channel
    customerName: string
    customerPhone?: string
    customerAddress?: string
    paymentMethod?: PaymentMethod
    paymentStatus?: PaymentStatus
    items: { menuItemId: string; quantity: number }[]
    skipServerPersist?: boolean
  }) => Order
  handleAddBrand: (brand: Omit<Brand, 'id'>) => void
  handleAddMenuItem: (newItem: Omit<MenuItem, 'id'>) => void
  handleAddIngredient: (newIng: Omit<Ingredient, 'id'>) => void
  handleCreatePurchaseOrder: (params: {
    supplierName: string
    category?: InventoryCategory
    horizon: 'MANUAL' | 'LOW_STOCK' | 'WEEKLY' | 'MONTHLY'
    items: { ingredientId: string; ingredientName: string; quantity: number; unit: string; costPerUnit: number }[]
    totalEstimatedCost: number
    note?: string
  }) => PurchaseOrder
  handleReceivePurchaseOrder: (
    poId: string,
    reconciledQuantities?: { [ingredientId: string]: number },
    discrepancyNote?: string
  ) => void
  handleUpdateMenuItemPrice: (menuItemId: string, newSellingPrice: number, newPackagingCost?: number) => void
  handleUpdateIngredientCost: (ingredientId: string, newCostPerUnit: number) => void
}

const KitchenContext = createContext<KitchenContextType | null>(null)

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isOrdersLoaded, setIsOrdersLoaded] = useState(false)
  const [navCounts, setNavCounts] = useState<NavCountsResult | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [stockLedger, setStockLedger] = useState<StockLedgerEntry[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [isPausedAll, setIsPausedAll] = useState(false)
  const [pausedPlatforms, setPausedPlatforms] = useState({ swiggy: false, zomato: false })
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS)
  const [userRole, setUserRole] = useState<UserRole>('OWNER')
  const [language, setLanguage] = useState<KitchenLanguage>('EN')
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null)

  // 1. Authoritative Nav Counts Sync
  const refreshNavCounts = useCallback(async () => {
    try {
      const res = await getNavCountsAction()
      if (res.ok && res.data) {
        setNavCounts(res.data)
        setIsOrdersLoaded(true)
      }
    } catch (err) {
      console.warn('Global recovery nav-counts re-sync failed:', err)
    }
  }, [])

  // 2. 4-Axis Global Network & Screen Wake Recovery Hook
  useRealtimeReconnection({
    channelName: 'kitchen-global-nav',
    onReconnect: refreshNavCounts,
    heartbeatIntervalMs: 25000,
  })

  // 3. Initial sync on mount
  useEffect(() => {
    refreshNavCounts()
  }, [refreshNavCounts])

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
    // 1. Optimistic UI update
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

    // 2. Persist to live Supabase PostgreSQL database
    import('@/features/orders/order-actions')
      .then(({ updateOrderStatusAction }) => {
        updateOrderStatusAction({ orderId, status: newStatus, kitchenId: 'kitch-koramangala-01' }).catch((err) => {
          console.warn('Background Supabase status update note:', err?.message || err)
        })
      })
      .catch((err) => console.warn('Could not load order-actions:', err))
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
    handleUpdateStatus(orderId, 'DISPATCHED')
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

  const handleCreateManualOrder = ({
    brandId,
    channel,
    customerName,
    customerPhone,
    customerAddress,
    paymentMethod = 'CASH',
    paymentStatus = 'PAID',
    items,
    skipServerPersist = false,
  }: {
    brandId: string
    channel: Channel
    customerName: string
    customerPhone?: string
    customerAddress?: string
    paymentMethod?: PaymentMethod
    paymentStatus?: PaymentStatus
    items: { menuItemId: string; quantity: number }[]
    skipServerPersist?: boolean
  }): Order => {
    const brand = brands.find((b) => b.id === brandId) || brands[0]
    let itemSubtotal = 0
    let packagingMaterialCost = 0
    let ingredientCost = 0

    const orderItems = items.map((it, idx) => {
      const menuItem = menuItems.find((m) => m.id === it.menuItemId)
      const price = menuItem ? menuItem.sellingPrice : 150
      const pkg = menuItem ? menuItem.packagingCost : 15
      itemSubtotal += price * it.quantity
      packagingMaterialCost += pkg * it.quantity

      if (menuItem && menuItem.recipe) {
        menuItem.recipe.forEach((r) => {
          const ing = ingredients.find((i) => i.id === r.ingredientId)
          if (ing) {
            ingredientCost += r.quantity * it.quantity * ing.costPerUnit
          }
        })
      }

      return {
        id: `oi-m-${Date.now()}-${idx}`,
        menuItemId: it.menuItemId,
        name: menuItem?.name || 'Special Dish',
        station: menuItem?.station || 'ASSEMBLY',
        secondaryStations: menuItem?.secondaryStations,
        quantity: it.quantity,
        price,
        stationDone: false,
      }
    })

    const commRate = channel === 'DIRECT' || channel === 'WALK_IN' ? 0.0 : channel === 'SWIGGY' ? 0.22 : 0.24
    const fin = calculateOrderFinancials({
      itemSubtotal,
      packagingFeeCollected: channel === 'WALK_IN' ? 0 : packagingMaterialCost,
      customerDiscount: 0,
      commissionRate: commRate,
      ingredientCost,
      packagingMaterialCost,
      settings: commissionSettings,
    }).financials

    const prefix = channel === 'WALK_IN' ? 'POS' : channel === 'DIRECT' ? 'DIR' : 'ORD'
    const newOrd: Order = {
      id: `ord-man-${Date.now()}`,
      orderNumber: `#${prefix}-${Math.floor(100 + Math.random() * 900)}`,
      channel,
      brandId: brand.id,
      brandName: brand.name,
      customerName: customerName.trim() || (channel === 'WALK_IN' ? 'Counter Walk-in' : 'Direct Customer'),
      customerPhone: customerPhone?.trim() || undefined,
      customerAddress: customerAddress?.trim() || undefined,
      status: 'PREPARING', // Auto-cook: routes straight to cook line as active cooking
      paymentMethod,
      paymentStatus,
      targetPrepMinutes: 12,
      createdAt: new Date().toISOString(),
      acknowledgedAt: new Date().toISOString(),
      items: orderItems,
      checklist: {
        cutlery: false,
        saucesDips: false,
        napkins: false,
        tamperSeal: false,
        beverageSeparated: false,
      },
      financials: fin,
    }

    setOrders((prev) => {
      const updated = [newOrd, ...prev]
      try {
        localStorage.setItem(`kitchflow_order_${newOrd.id}`, JSON.stringify(newOrd))
      } catch (e) {
        console.error('Failed saving order to localStorage', e)
      }
      return updated
    })

    // Persist to Postgres database via Server Action (unless caller handles persistence directly)
    if (!skipServerPersist) {
      import('@/features/orders/order-actions')
        .then(({ createManualOrderAction }) => {
        createManualOrderAction({
          brandId: brand.id,
          channel,
          customerName: customerName.trim() || (channel === 'WALK_IN' ? 'Counter Walk-in' : 'Direct Customer'),
          customerPhone: customerPhone?.trim() || undefined,
          customerAddress: customerAddress?.trim() || undefined,
          paymentMethod,
          paymentStatus,
          items,
        }).then((res) => {
          if (res.ok && res.data) {
            // Update order with database ID and Order Number
            setOrders((prev) =>
              prev.map((o) => (o.id === newOrd.id ? { ...o, id: res.data!.orderId, orderNumber: res.data!.orderNumber } : o))
            )
          }
        }).catch((err) => console.warn('Could not persist POS order to Postgres:', err))
      })
      .catch((err) => console.warn('Could not load order-actions:', err))
    }

    return newOrd
  }

  const handleAddBrand = (brand: Omit<Brand, 'id'>) => {
    const newBrand: Brand = {
      ...brand,
      id: `b-${Date.now()}`,
    }
    setBrands((prev) => [...prev, newBrand])
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

  const handleCreatePurchaseOrder = (params: {
    supplierName: string
    category?: InventoryCategory
    horizon: 'MANUAL' | 'LOW_STOCK' | 'WEEKLY' | 'MONTHLY'
    items: { ingredientId: string; ingredientName: string; quantity: number; unit: string; costPerUnit: number }[]
    totalEstimatedCost: number
    note?: string
  }): PurchaseOrder => {
    const poNumber = `PO-${Math.floor(100 + Math.random() * 900)}`
    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber,
      supplierName: params.supplierName || 'Wholesale Mandi & Vendor',
      category: params.category,
      horizon: params.horizon,
      status: 'PENDING_DELIVERY',
      items: params.items,
      totalEstimatedCost: params.totalEstimatedCost,
      createdAt: new Date().toISOString(),
      note: params.note,
    }

    setPurchaseOrders((prev) => [newPO, ...prev])
    return newPO
  }

  const handleReceivePurchaseOrder = (
    poId: string, 
    reconciledQuantities?: { [ingredientId: string]: number },
    discrepancyNote?: string
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id !== poId) return po

        let hasDiscrepancy = false
        let actualTotalCost = 0

        const updatedItems = po.items.map((item) => {
          const actualQty = reconciledQuantities && reconciledQuantities[item.ingredientId] !== undefined
            ? Math.max(0, reconciledQuantities[item.ingredientId])
            : item.quantity

          if (actualQty !== item.quantity) {
            hasDiscrepancy = true
          }

          actualTotalCost += actualQty * item.costPerUnit

          // Stock only what actually arrived
          if (actualQty > 0) {
            handleAdjustStockWithReason(
              item.ingredientId,
              actualQty,
              'PURCHASE_INFLOW',
              `Received delivery for ${po.poNumber} (${po.supplierName}) - ${actualQty}/${item.quantity} ${item.unit} received`
            )
          }

          return {
            ...item,
            receivedQuantity: actualQty,
          }
        })

        return {
          ...po,
          items: updatedItems,
          actualCost: actualTotalCost,
          status: hasDiscrepancy ? ('PARTIALLY_RECEIVED' as const) : ('RECEIVED' as const),
          receivedAt: new Date().toISOString(),
          discrepancyNote: discrepancyNote?.trim() || (hasDiscrepancy ? 'Quantity adjusted upon intake' : undefined),
        }
      })
    )
  }

  const handleUpdateMenuItemPrice = (menuItemId: string, newSellingPrice: number, newPackagingCost?: number) => {
    setMenuItems((prev) =>
      prev.map((item) =>
        item.id === menuItemId
          ? {
              ...item,
              sellingPrice: Math.max(0, newSellingPrice),
              packagingCost: newPackagingCost !== undefined ? Math.max(0, newPackagingCost) : item.packagingCost,
            }
          : item
      )
    )
  }

  const handleUpdateIngredientCost = (ingredientId: string, newCostPerUnit: number) => {
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === ingredientId
          ? { ...ing, costPerUnit: Math.max(0, newCostPerUnit) }
          : ing
      )
    )
  }

  return (
    <KitchenContext.Provider
      value={{
        orders,
        isOrdersLoaded,
        navCounts,
        refreshNavCounts,
        ingredients,
        menuItems,
        brands,
        stockLedger,
        purchaseOrders,
        isPausedAll,
        pausedPlatforms,
        commissionSettings,
        userRole,
        language,
        inspectingOrder,
        setOrders,
        setIsOrdersLoaded,
        setIngredients,
        setStockLedger,
        setPurchaseOrders,
        setBrands,
        setMenuItems,
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
        handleCreateManualOrder,
        handleAddBrand,
        handleAddMenuItem,
        handleAddIngredient,
        handleCreatePurchaseOrder,
        handleReceivePurchaseOrder,
        handleUpdateMenuItemPrice,
        handleUpdateIngredientCost,
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
