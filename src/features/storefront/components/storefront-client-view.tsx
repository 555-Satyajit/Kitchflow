'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  StorefrontBrand,
  StorefrontDish,
  StorefrontOrderMode,
} from '../types'
import { useStorefrontCart } from '../hooks/useStorefrontCart'
import { ModifierModal } from './modifier-modal'
import { CheckoutModal } from './checkout-modal'
import { formatCurrency } from '@/lib/utils'
import {
  Search,
  Plus,
  Minus,
  ArrowRight,
  Phone,
  ShoppingBag,
  Sparkles,
  MapPin,
  X,
  MessageCircle,
  Flame,
  Clock,
  Star,
  Coffee,
} from 'lucide-react'

interface StorefrontClientViewProps {
  brand: StorefrontBrand
  dishes: StorefrontDish[]
  initialTable?: string
}

const PROMO_SHOWCASE =
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=85'

const DISH_IMAGE_MAP: Record<string, { img: string; oldPrice?: number; tag?: string; prepTime: string; rating: string }> = {
  d1: {
    img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=85',
    oldPrice: 399,
    tag: 'COMBO DEAL',
    prepTime: '15 min',
    rating: '4.9',
  },
  d2: {
    img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&auto=format&fit=crop&q=85',
    oldPrice: 349,
    tag: 'BEST SELLER',
    prepTime: '12 min',
    rating: '4.8',
  },
  d3: {
    img: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=700&auto=format&fit=crop&q=85',
    oldPrice: 260,
    tag: 'CHEF CHOICE',
    prepTime: '5 min',
    rating: '4.9',
  },
  d4: {
    img: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=700&auto=format&fit=crop&q=85',
    tag: 'SWEET BITE',
    prepTime: '3 min',
    rating: '5.0',
  },
}

export function StorefrontClientView({
  brand,
  dishes,
  initialTable = '',
}: StorefrontClientViewProps) {
  const {
    items,
    mode,
    tableNumber,
    setBrandId,
    setMode,
    setTableNumber,
    addItem,
    updateQuantity,
    getTotalCount,
    getTotalAmount,
  } = useStorefrontCart()

  React.useEffect(() => {
    setBrandId(brand.id)
    if (initialTable) {
      setTableNumber(initialTable)
      setMode('DINE_IN')
    }
  }, [brand.id, initialTable, setBrandId, setTableNumber, setMode])

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('ALL')
  const [selectedDishForModal, setSelectedDishForModal] =
    useState<StorefrontDish | null>(null)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [placedOrderSuccessToken, setPlacedOrderSuccessToken] = useState<
    string | null
  >(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    dishes.forEach((d) => set.add(d.category))
    return ['ALL', 'DEALS & COMBOS', ...Array.from(set)]
  }, [dishes])

  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const matchesSearch =
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        activeCategory === 'ALL' ||
        activeCategory === 'DEALS & COMBOS' ||
        dish.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [dishes, searchQuery, activeCategory])

  const totalCount = getTotalCount()
  const totalAmount = getTotalAmount()

  const getItemCartQuantity = (dishId: string) => {
    const cartMatches = items.filter((i) => i.dishId === dishId)
    return cartMatches.reduce((sum, item) => sum + item.quantity, 0)
  }

  const handleAddDish = (dish: StorefrontDish) => {
    if (dish.station === 'BEVERAGE' || dish.station === 'PIZZA') {
      setSelectedDishForModal(dish)
    } else {
      addItem({
        id: `${dish.id}-base`,
        dishId: dish.id,
        name: dish.name,
        unitPrice: dish.sellingPrice,
        totalPrice: dish.sellingPrice,
        quantity: 1,
        selectedModifiers: [],
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F5F3EF] via-[#FAF8F5] to-[#F3EFEA] text-[#1C1917] max-w-md mx-auto relative pb-36 font-sans selection:bg-[#E11D48] selection:text-white">
      {/* 1. Ultra-Frosted Liquid Glass Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/65 backdrop-blur-3xl border-b border-white/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all">
        {/* Top Status & Brand Row */}
        <div className="px-4.5 pt-3.5 pb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Soft Translucent Brand Pill */}
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#BE123C] to-[#FB7185] text-white font-extrabold text-sm flex items-center justify-center shadow-md shadow-rose-900/20 border border-white/40 shrink-0">
              {brand.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-[#1C1917] truncate">
                  {brand.name}
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-stone-500 truncate">
                {mode === 'DINE_IN'
                  ? `Dine-In • Table ${tableNumber || 'Self'}`
                  : 'Fast Takeaway Window'}
              </p>
            </div>
          </div>

          {/* Mode Switcher (Liquid Glass Segmented Capsule) */}
          <div className="flex items-center p-0.5 bg-stone-200/50 backdrop-blur-xl rounded-full text-[11px] font-semibold shrink-0 border border-white/60 shadow-inner">
            <button
              type="button"
              onClick={() => setMode('DINE_IN')}
              className={`px-3 py-1 rounded-full transition-all ${
                mode === 'DINE_IN'
                  ? 'bg-white/95 text-[#1C1917] shadow-sm font-bold backdrop-blur-md'
                  : 'text-stone-500 hover:text-[#1C1917]'
              }`}
            >
              Table {tableNumber || 'Self'}
            </button>
            <button
              type="button"
              onClick={() => setMode('TAKEAWAY')}
              className={`px-3 py-1 rounded-full transition-all ${
                mode === 'TAKEAWAY'
                  ? 'bg-white/95 text-[#1C1917] shadow-sm font-bold backdrop-blur-md'
                  : 'text-stone-500 hover:text-[#1C1917]'
              }`}
            >
              Takeaway
            </button>
          </div>
        </div>

        {/* Minimal Glass Search Inset */}
        <div className="px-4.5 pb-2.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search crispy zingers, artisan pizzas, deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9.5 pr-8 py-2 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/90 text-stone-900 placeholder:text-stone-400 shadow-2xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#BE123C]/20 focus:border-[#BE123C] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-stone-400 hover:text-stone-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Category Strip (Translucent Frosted Glass Pills) */}
        <div className="px-4.5 pb-2.5 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wider ${
                  isSelected
                    ? 'bg-[#1C1917] text-white shadow-sm scale-102'
                    : 'bg-white/60 backdrop-blur-md text-stone-600 border border-white/80 hover:bg-white/90'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            )
          })}
        </div>
      </header>

      {/* 2. Glass Spotlight Feature Card */}
      <div className="px-4.5 pt-3.5 pb-1">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#9F1239]/90 via-[#BE123C]/90 to-[#E11D48]/90 backdrop-blur-2xl text-white p-4.5 shadow-lg border border-white/30 flex items-center justify-between">
          <div className="space-y-1 z-10 max-w-[62%]">
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-200 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              <span>Sizzling Special</span>
            </span>
            <h2 className="text-base font-extrabold uppercase tracking-tight leading-tight text-white drop-shadow-xs">
              Crispy Combos & Hot Artisan Crusts
            </h2>
            <p className="text-[11px] text-rose-100 font-light leading-relaxed">
              Order direct • Freshly prepared upon order.
            </p>
          </div>

          <div className="w-24 h-24 rounded-2xl overflow-hidden relative shadow-md border-2 border-white/30 shrink-0">
            <Image
              src={PROMO_SHOWCASE}
              alt="Promo"
              fill
              sizes="140px"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* 3. Section Title */}
      <div className="px-4.5 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-stone-500">
            {activeCategory === 'ALL' ? 'Popular Recommendations' : activeCategory}
          </h2>
          <p className="text-[11px] text-stone-400">
            Handcrafted fresh upon your ticket
          </p>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white/70 backdrop-blur-md border border-white/80 text-stone-600 shadow-2xs">
          {filteredDishes.length} Items
        </span>
      </div>

      {/* 4. Refined 2-Column Liquid Glass Grid */}
      <main className="px-4.5 grid grid-cols-2 gap-3.5">
        {filteredDishes.length === 0 ? (
          <div className="col-span-2 p-16 text-center text-stone-400 space-y-2">
            <Coffee className="w-8 h-8 mx-auto stroke-1 opacity-40" />
            <p className="text-xs">No matching dishes found.</p>
          </div>
        ) : (
          filteredDishes.map((dish) => {
            const inCartQty = getItemCartQuantity(dish.id)
            const meta = DISH_IMAGE_MAP[dish.id] || DISH_IMAGE_MAP['d1']

            return (
              <div
                key={dish.id}
                className="group relative rounded-3xl bg-white/70 backdrop-blur-xl border border-white/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-lg hover:bg-white/85 transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                {/* Visual Image Canvas with Soft Glass Badges */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  <Image
                    src={meta.img}
                    alt={dish.name}
                    fill
                    sizes="220px"
                    className="object-cover group-hover:scale-106 transition-transform duration-500"
                  />

                  {/* Top Badge: Deal / Best Seller */}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-mono font-extrabold uppercase tracking-wider bg-white/90 backdrop-blur-md text-[#BE123C] shadow-2xs border border-white/60">
                      {meta.tag || 'HOT DEAL'}
                    </span>
                  </div>

                  {/* Rating / Clock Badge */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/55 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[9px] font-mono text-white border border-white/10">
                    <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                    <span>{meta.rating}</span>
                  </div>
                </div>

                {/* Content & Action Row */}
                <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-stone-900 line-clamp-1 leading-snug">
                      {dish.name}
                    </h3>
                    <p className="text-[10px] text-stone-500 line-clamp-1 leading-relaxed">
                      {dish.description}
                    </p>
                  </div>

                  {/* Price & Stepper Row */}
                  <div className="pt-2 border-t border-stone-200/50 flex items-center justify-between gap-1">
                    <div>
                      <span className="text-xs font-mono font-extrabold text-[#BE123C] block leading-none">
                        {formatCurrency(dish.sellingPrice)}
                      </span>
                      {meta.oldPrice && (
                        <span className="text-[10px] text-stone-400 line-through font-mono leading-none">
                          {formatCurrency(meta.oldPrice)}
                        </span>
                      )}
                    </div>

                    {/* Stepper with Glass Glow */}
                    {inCartQty > 0 ? (
                      <div className="flex items-center gap-1.5 bg-[#BE123C] text-white rounded-full px-2 py-1 shadow-sm border border-white/20">
                        <button
                          type="button"
                          onClick={() => {
                            const cartItem = items.find((i) => i.dishId === dish.id)
                            if (cartItem) updateQuantity(cartItem.id, -1)
                          }}
                          className="w-4 h-4 flex items-center justify-center hover:opacity-80 active:scale-90 font-bold text-xs"
                        >
                          <Minus className="w-2.5 h-2.5 stroke-[3]" />
                        </button>
                        <span className="text-xs font-mono font-bold w-3 text-center">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddDish(dish)}
                          className="w-4 h-4 flex items-center justify-center hover:opacity-80 active:scale-90 font-bold text-xs"
                        >
                          <Plus className="w-2.5 h-2.5 stroke-[3]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddDish(dish)}
                        className="w-7 h-7 rounded-full bg-[#BE123C] hover:bg-[#9F1239] text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform font-bold shrink-0 border border-white/20"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </main>

      {/* 5. Liquid Glass Bottom Dock with Cart */}
      {totalCount > 0 && (
        <aside
          aria-label="Order Cart Dock"
          className="fixed bottom-5 inset-x-5 max-w-md mx-auto z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full bg-[#1C1917]/90 hover:bg-[#1C1917] text-white h-13 rounded-full shadow-2xl backdrop-blur-2xl border border-white/20 flex items-center justify-between px-5 font-bold transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-[#BE123C] text-white flex items-center justify-center text-xs font-mono font-bold shadow-xs">
                {totalCount}
              </span>
              <span className="text-xs uppercase tracking-wider font-mono">VIEW CART</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-amber-200">
                {formatCurrency(totalAmount)}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </button>
        </aside>
      )}

      {/* 6. Customization Sheet */}
      <ModifierModal
        dish={selectedDishForModal}
        isOpen={!!selectedDishForModal}
        onClose={() => setSelectedDishForModal(null)}
        onAddToCart={(dish, qty, mods, notes) => {
          addItem({
            id: `${dish.id}-${Date.now()}`,
            dishId: dish.id,
            name: dish.name,
            unitPrice:
              dish.sellingPrice +
              mods.reduce((acc, m) => acc + m.price, 0),
            totalPrice:
              dish.sellingPrice +
              mods.reduce((acc, m) => acc + m.price, 0),
            quantity: qty,
            selectedModifiers: mods,
            specialInstructions: notes,
          })
        }}
      />

      {/* 7. Checkout Sheet */}
      <CheckoutModal
        brand={brand}
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={(token) => {
          setIsCheckoutOpen(false)
          setPlacedOrderSuccessToken(token)
        }}
      />

      {/* 8. Success Live Confirmation */}
      {placedOrderSuccessToken && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="bg-white/85 backdrop-blur-3xl border border-white/80 max-w-xs w-full p-6 rounded-3xl shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-[#BE123C] flex items-center justify-center mx-auto border border-rose-200">
              <ShoppingBag className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Order Received!
            </h3>
            <p className="text-xs text-stone-500">
              Token #{placedOrderSuccessToken} has been sent directly to the kitchen line.
            </p>
            <button
              type="button"
              onClick={() => setPlacedOrderSuccessToken(null)}
              className="w-full py-2.5 rounded-full bg-[#1C1917] text-white font-bold text-xs hover:bg-black transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
