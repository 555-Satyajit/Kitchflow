'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { useStorefrontCart } from '../hooks/useStorefrontCart'
import { StorefrontBrand, StorefrontDish } from '../types'
import { formatCurrency } from '@/lib/utils'
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  X,
  Search,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react'

interface CheckoutModalProps {
  brand: StorefrontBrand
  allDishes?: StorefrontDish[]
  isOpen: boolean
  onClose: () => void
  onSuccess: (orderId: string) => void
}

const POPULAR_ADDONS: { id: string; name: string; price: number; oldPrice?: number; tag: string; img: string }[] = [
  {
    id: 'addon-1',
    name: 'Artisan Garlic Dip & Crust Fries',
    price: 149,
    oldPrice: 189,
    tag: 'DEAL',
    img: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'addon-2',
    name: 'Chilled Nitro Cold Brew Can',
    price: 180,
    oldPrice: 220,
    tag: 'BEST SELLER',
    img: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'addon-3',
    name: 'Crispy Melted Cheese Poppers',
    price: 160,
    tag: 'HOT',
    img: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&auto=format&fit=crop&q=80',
  },
]

export function CheckoutModal({
  brand,
  allDishes = [],
  isOpen,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const {
    items,
    mode,
    tableNumber,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    getTotalAmount,
    getTotalCount,
  } = useStorefrontCart()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const totalAmount = getTotalAmount()
  const totalCount = getTotalCount()

  // Estimated delivery / prep timestamp
  const now = new Date()
  now.setMinutes(now.getMinutes() + (mode === 'DINE_IN' ? 15 : 35))
  const estTimeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleCheckout = () => {
    setError('')
    if (!customerName.trim()) {
      setError('Please enter your name.')
      return
    }

    if (mode === 'DELIVERY' && (!customerPhone.trim() || !deliveryAddress.trim())) {
      setError('Phone and address are required for delivery.')
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      const mockOrderId = `ORD-${Date.now().toString().slice(-4)}`
      clearCart()
      setIsSubmitting(false)
      onSuccess(mockOrderId)
    }, 600)
  }

  const handleQuickAddAddon = (addon: typeof POPULAR_ADDONS[0]) => {
    addItem({
      id: `${addon.id}-${Date.now()}`,
      dishId: addon.id,
      name: addon.name,
      unitPrice: addon.price,
      totalPrice: addon.price,
      quantity: 1,
      selectedModifiers: [],
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="sm:max-w-md w-full max-h-[92vh] p-0 flex flex-col rounded-[2.5rem] overflow-hidden bg-white/75 dark:bg-stone-900/75 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]">
        {/* 1. Frosted Liquid Glass Crimson Header */}
        <div className="bg-[#B91C1C]/90 backdrop-blur-2xl text-white px-5 py-4 flex items-center justify-between border-b border-white/20 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-sm uppercase tracking-wider drop-shadow-xs">
              YOUR CART
            </span>
            <span className="bg-white/25 backdrop-blur-md text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border border-white/30 shadow-2xs">
              {totalCount} {totalCount === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all active:scale-95"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* 2. Scrollable Body with Frosted Glass Panels */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Cart Item Cards (Translucent Frosted Glass Cards with Inner Border Glow) */}
          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-3xl bg-white/60 dark:bg-stone-800/60 backdrop-blur-xl border border-white/80 dark:border-white/10 flex items-center justify-between gap-3 shadow-sm hover:bg-white/80 transition-all"
              >
                {/* Thumbnail Preview */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-100 relative shrink-0 shadow-inner border border-white/50">
                  <Image
                    src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&auto=format&fit=crop&q=80"
                    alt={item.name}
                    fill
                    sizes="60px"
                    className="object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {item.name}
                  </h4>
                  {item.selectedModifiers.length > 0 && (
                    <p className="text-[10px] text-stone-500 truncate">
                      {item.selectedModifiers.map((m: { optionName: string }) => m.optionName).join(', ')}
                    </p>
                  )}
                  <p className="text-xs font-mono font-black text-[#B91C1C]">
                    {formatCurrency(item.totalPrice * item.quantity)}
                  </p>
                </div>

                {/* Stepper with Red '+' and Red Trash Icon */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-stone-400 hover:text-[#B91C1C] p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md border border-white/80 rounded-full px-2 py-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-4 h-4 flex items-center justify-center font-bold text-xs text-stone-600 hover:text-stone-900"
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    <span className="text-xs font-mono font-black w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-4 h-4 rounded-full bg-[#B91C1C] text-white flex items-center justify-center font-bold text-xs shadow-xs"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dotted "+ Add more items" Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-stone-300/80 bg-white/40 backdrop-blur-md text-stone-700 font-bold text-xs hover:border-[#B91C1C]/40 hover:bg-white/70 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add more items</span>
          </button>

          {/* "POPULAR WITH YOUR ORDER" Frosted Glass Strip */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-stone-800">
                <Search className="w-3.5 h-3.5 text-[#B91C1C]" />
                <span className="text-xs font-black uppercase tracking-wider">
                  POPULAR WITH YOUR ORDER
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#B91C1C]">Pair & Save</span>
            </div>

            {/* Horizontal Add-on Cards with Glass Insets */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {POPULAR_ADDONS.map((addon) => (
                <div
                  key={addon.id}
                  className="w-36 shrink-0 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 p-2.5 shadow-2xs space-y-2 flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-amber-50">
                    <Image
                      src={addon.img}
                      alt={addon.name}
                      fill
                      sizes="150px"
                      className="object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 bg-[#B91C1C]/90 backdrop-blur-md text-white font-black text-[8px] px-1.5 py-0.5 rounded-md border border-white/20">
                      {addon.tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickAddAddon(addon)}
                      className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[#B91C1C] text-white flex items-center justify-center shadow-md active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-bold text-stone-900 line-clamp-1">
                      {addon.name}
                    </h5>
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="text-[11px] font-black text-[#B91C1C] font-mono">
                        {formatCurrency(addon.price)}
                      </span>
                      {addon.oldPrice && (
                        <span className="text-[9px] text-stone-400 line-through font-mono">
                          {formatCurrency(addon.oldPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Name & Table Details */}
          <div className="space-y-3 pt-3 border-t border-stone-200/60">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 block">
                Your Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20 focus:border-[#B91C1C] transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 block">
                Phone Number <span className="text-stone-400 font-normal">(Optional for order tracking)</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B91C1C]/20 focus:border-[#B91C1C] transition-all font-mono"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* 3. Translucent Frosted Glass Bottom Checkout Dock */}
        <div className="p-4 border-t border-white/40 bg-white/60 dark:bg-stone-900/60 backdrop-blur-2xl space-y-3">
          {/* Subtotal Row */}
          <div className="flex items-center justify-between text-xs font-bold text-stone-600 px-1">
            <span>Total</span>
            <span className="font-mono text-stone-900 font-extrabold text-sm">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {/* Grand Total Solid Crimson Button with Glass Glow */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || items.length === 0}
            className="w-full bg-[#B91C1C] hover:bg-[#991B1B] text-white h-13 rounded-2xl shadow-xl shadow-red-700/25 border border-white/20 flex items-center justify-between px-5 font-black transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="text-left">
              <span className="text-[10px] text-rose-200 font-bold block uppercase tracking-wider">
                Grand Total
              </span>
              <span className="font-mono text-base font-extrabold tracking-tight">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <span>CHECKOUT</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </button>

          {/* Delivery / Prep SLA Clock Note */}
          <div className="text-center text-[10px] text-stone-500 leading-normal">
            Your order will be ready in approximately{' '}
            <span className="font-bold text-stone-700">
              {mode === 'DINE_IN' ? '15 minutes' : '35 minutes'}
            </span>{' '}
            at <span className="bg-rose-500/10 border border-rose-500/20 text-[#B91C1C] font-bold px-1.5 py-0.5 rounded-md font-mono">{estTimeFormatted}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
