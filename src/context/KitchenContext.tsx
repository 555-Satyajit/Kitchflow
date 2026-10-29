'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDeviceUuid } from '@/lib/utils'
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

export type NavCountDeltaAction = 
  | { type: 'ORDER_PUNCHED'; payload?: any }
  | { type: 'KDS_START_COOKING'; payload?: any }
  | { type: 'KDS_COMPLETE'; payload?: any }
  | { type: 'DISPATCH_COMPLETE'; payload?: any }

interface KitchenContextType {
  orders: Order[]
  isOrdersLoaded: boolean
  navCounts: NavCountsResult | null
  refreshNavCounts: () => Promise<void>
  dispatchOptimisticDelta: (action: NavCountDeltaAction) => void
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
  setNavCounts: React.Dispatch<React.SetStateAction<NavCountsResult | null>>
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

export function KitchenProvider({
  children,
  initialNavCounts,
}: {
  children: React.ReactNode;
  initialNavCounts?: NavCountsResult | null;
}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isOrdersLoaded, setIsOrdersLoaded] = useState(Boolean(initialNavCounts))
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
  
  // 1. Initialize immediately with Server-Streamed / localStorage counts
  const [fallbackCounts, setFallbackCounts] = useState<NavCountsResult | null>(initialNavCounts ?? null)

  // 2. Nav counts come exclusively from fallbackCounts (DB snapshot + optimistic deltas).
  // We do NOT derive from context.orders because only the /orders page has the full list —
  // KDS and Packing pages set partial subsets into orders, causing oscillating badge numbers.
  // All mutations fire dispatchOptimisticDelta which keeps fallbackCounts perfectly in-sync.
  const navCounts = fallbackCounts

  // 3. Optimistic Delta Reducer for Inter-Terminal Actions
  const dispatchOptimisticDelta = useCallback((action: NavCountDeltaAction) => {
    setFallbackCounts((prev) => {
      if (!prev) return prev
      const current = { ...prev }

      switch (action.type) {
        case 'ORDER_PUNCHED':
          current.ordersCount += 1
          current.kdsCount += 1 // Transitions to ACCEPTED / cook queue
          break
        case 'KDS_START_COOKING': // ACCEPTED -> PREPARING
          current.packingCount += 1
          break
        case 'KDS_COMPLETE': // PREPARING -> READY
          current.kdsCount = Math.max(0, current.kdsCount - 1)
          break
        case 'DISPATCH_COMPLETE': // READY -> DISPATCHED
          current.ordersCount = Math.max(0, current.ordersCount - 1)
          current.packingCount = Math.max(0, current.packingCount - 1)
          break
      }

      try {
        localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(current))
      } catch {}
      return current
    })
  }, [])

  // Helper to read active kitchen ID safely in browser
  const getActiveKitchenId = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kitchflow_active_kitchen_id') || 'default'
    }
    return 'default'
  }, [])

  // Ref to track processed delta events to guarantee idempotency across channels
  const processedEventIdsRef = useRef<Set<string>>(new Set())

  // 4. Ingesting Inter-Station Events over Supabase Realtime Broadcast (Tenant-isolated, Zero WAL overhead)
  useEffect(() => {
    const supabase = createClient()
    const kid = getActiveKitchenId()
    const channelName = `kitchen-${kid}-counters`
    const channel = supabase.channel(channelName)

    const handleDelta = (payload: any) => {
      // Avoid loopback echoes from own device
      if (payload?.senderId && payload.senderId === getDeviceUuid()) return

      // Idempotency guard: prevent duplicate delta processing if received across multiple channels
      if (payload?.eventId) {
        if (processedEventIdsRef.current.has(payload.eventId)) return
        processedEventIdsRef.current.add(payload.eventId)
        if (processedEventIdsRef.current.size > 200) {
          const first = processedEventIdsRef.current.values().next().value
          if (first) processedEventIdsRef.current.delete(first)
        }
      }

      if (payload?.action?.type) {
        dispatchOptimisticDelta(payload.action)
      }
    }

    channel
      .on('broadcast', { event: 'nav_counter_delta' }, ({ payload }) => handleDelta(payload))
      .subscribe()

    const globalChannel = kid !== 'all' && kid !== 'default'
      ? supabase.channel('kitchen-all-counters')
          .on('broadcast', { event: 'nav_counter_delta' }, ({ payload }) => handleDelta(payload))
          .subscribe()
      : null

    return () => {
      supabase.removeChannel(channel)
      if (globalChannel) {
        supabase.removeChannel(globalChannel)
      }
    }
  }, [dispatchOptimisticDelta, getActiveKitchenId])

  // 5. Authoritative Nav Counts Sync
  const refreshNavCounts = useCallback(async () => {
    try {
      let activeKitchenId: string | undefined = undefined
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('kitchflow_active_kitchen_id')
        if (stored) activeKitchenId = stored
      }
      const res = await getNavCountsAction(activeKitchenId)
      if (res.ok && res.data) {
        setFallbackCounts(res.data)
        setIsOrdersLoaded(true)
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('kitchflow_nav_counts_cache', JSON.stringify(res.data))
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Global recovery nav-counts re-sync failed:', err)
    }
  }, [])

  // Instantly load cached nav counts if available to achieve instant 0ms badge display
  useEffect(() => {
    const syncFromCache = () => {
      try {
        const cached = localStorage.getItem('kitchflow_nav_counts_cache')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && typeof parsed.ordersCount === 'number') {
            setFallbackCounts(parsed)
            setIsOrdersLoaded(true)
          }
        }
      } catch (e) {}
    }

    syncFromCache()
    window.addEventListener('kitchflow_nav_counts_updated', syncFromCache)
    window.addEventListener('storage', syncFromCache)

    return () => {
      window.removeEventListener('kitchflow_nav_counts_updated', syncFromCache)
      window.removeEventListener('storage', syncFromCache)
    }
  }, [])

  // 6. 4-Axis Global Network & Screen Wake Recovery Hook (Tenant-scoped, event-driven recovery)
  useRealtimeReconnection({
    channelName: `kitchen-${getActiveKitchenId()}-nav`,
    onReconnect: refreshNavCounts,
    heartbeatIntervalMs: 60000, // 60s passive heartbeat to conserve DB resources at scale
  })

  // 7. Initial sync on mount — only if NavBadgesServer didn't already seed counts.
  // NavBadgesClientHydrator calls setNavCounts() in a useEffect (slightly async),
  // so we wait one tick before checking, to avoid a redundant DB round-trip.
  const fallbackCountsRef = useRef(fallbackCounts)
  fallbackCountsRef.current = fallbackCounts

  useEffect(() => {
    const timer = setTimeout(() => {
      // If counts are already populated (from NavBadgesServer RSC or localStorage), skip the call
      if (fallbackCountsRef.current !== null) return
      // Genuinely no counts yet (cold load, unauthenticated) — fetch from DB
      refreshNavCounts()
    }, 100)
    return () => clearTimeout(timer)
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

    // Trigger in-memory optimistic delta & broadcast
    let deltaAction: NavCountDeltaAction | null = null
    if (newStatus === 'PREPARING') {
      deltaAction = { type: 'KDS_START_COOKING' }
    } else if (newStatus === 'READY') {
      deltaAction = { type: 'KDS_COMPLETE' }
    } else if (newStatus === 'DISPATCHED') {
      deltaAction = { type: 'DISPATCH_COMPLETE' }
    }

    if (deltaAction) {
      dispatchOptimisticDelta(deltaAction)
      try {
        const supabase = createClient()
        const kid = getActiveKitchenId()
        supabase.channel(`kitchen-${kid}-counters`).send({
          type: 'broadcast',
          event: 'nav_counter_delta',
          payload: { action: deltaAction, senderId: getDeviceUuid() }
        })
      } catch (e) {}
    }

    // 2. Persist to live Supabase PostgreSQL database
    const activeKid = getActiveKitchenId()
    import('@/features/orders/order-actions')
      .then(({ updateOrderStatusAction }) => {
        updateOrderStatusAction({ orderId, status: newStatus, kitchenId: activeKid !== 'default' ? activeKid : undefined }).catch((err) => {
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

    dispatchOptimisticDelta({ type: 'ORDER_PUNCHED' })
    try {
      const supabase = createClient()
      const kid = getActiveKitchenId()
      supabase.channel(`kitchen-${kid}-counters`).send({
        type: 'broadcast',
        event: 'nav_counter_delta',
        payload: { action: { type: 'ORDER_PUNCHED' }, eventId: `SIM_ORDER_PUNCHED-${newOrd.id}`, senderId: getDeviceUuid() }
      })
    } catch (e) {}
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

    dispatchOptimisticDelta({ type: 'ORDER_PUNCHED' })
    if (newOrd.status === 'PREPARING') {
      dispatchOptimisticDelta({ type: 'KDS_START_COOKING' })
    }
    if (!skipServerPersist) {
      try {
        const supabase = createClient()
        const kid = getActiveKitchenId()
        supabase.channel(`kitchen-${kid}-counters`).send({
          type: 'broadcast',
          event: 'nav_counter_delta',
          payload: { action: { type: 'ORDER_PUNCHED' }, eventId: `ORDER_PUNCHED-${newOrd.id}`, senderId: getDeviceUuid() }
        })
      } catch (e) {}
    }

    // Persist to Postgres database via Server Action (unless caller handles persistence directly)
    if (!skipServerPersist) {
      import('@/features/orders/order-actions')
        .then(({ createManualOrderAction }) => {
        const activeKid = getActiveKitchenId()
        createManualOrderAction({
          kitchenId: activeKid !== 'default' ? activeKid : undefined,
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
    const tempId = `b-${Date.now()}`
    const newBrand: Brand = {
      ...brand,
      id: tempId,
    }
    setBrands((prev) => [...prev, newBrand])

    // Asynchronously persist to PostgreSQL in background
    let activeKid = ''
    try {
      activeKid = localStorage.getItem('kitchflow_active_kitchen_id') || ''
    } catch (e) {}

    import('@/actions/settings')
      .then(({ saveBrandAction, getOrganizationKitchensAction }) => {
        const persist = async () => {
          let targetKitchenId = activeKid
          if (!targetKitchenId) {
            const kRes = await getOrganizationKitchensAction()
            if (kRes.ok && kRes.data) {
              targetKitchenId = kRes.data.activeKitchenId || kRes.data.kitchens[0]?.id || ''
            }
          }
          if (targetKitchenId) {
            const res = await saveBrandAction({
              kitchenId: targetKitchenId,
              name: brand.name,
              tagline: brand.tagline,
              color: brand.color,
            })
            if (res.ok && res.data?.brandId) {
              setBrands((prev) =>
                prev.map((b) => (b.id === tempId ? { ...b, id: res.data!.brandId } : b))
              )
            }
          }
        }
        persist().catch((err) => console.warn('Could not persist brand to PostgreSQL:', err))
      })
      .catch((err) => console.warn('Could not load settings action:', err))
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
        navCounts: navCounts,
        refreshNavCounts,
        dispatchOptimisticDelta,
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
        setNavCounts: setFallbackCounts,
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
