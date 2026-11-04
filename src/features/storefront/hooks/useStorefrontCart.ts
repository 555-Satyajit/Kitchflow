'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { StorefrontCartItem, StorefrontOrderMode } from '../types'

interface StorefrontCartState {
  brandId: string | null
  mode: StorefrontOrderMode
  tableNumber: string
  items: StorefrontCartItem[]
  setBrandId: (id: string) => void
  setMode: (mode: StorefrontOrderMode) => void
  setTableNumber: (table: string) => void
  addItem: (item: StorefrontCartItem) => void
  updateQuantity: (id: string, delta: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  getTotalCount: () => number
  getTotalAmount: () => number
}

export const useStorefrontCart = create<StorefrontCartState>()(
  persist(
    (set, get) => ({
      brandId: null,
      mode: 'DINE_IN',
      tableNumber: '',
      items: [],

      setBrandId: (id) => {
        // If brand changes, clear cart to avoid mixing menus
        if (get().brandId && get().brandId !== id) {
          set({ brandId: id, items: [] })
        } else {
          set({ brandId: id })
        }
      },

      setMode: (mode) => set({ mode }),
      setTableNumber: (tableNumber) => set({ tableNumber }),

      addItem: (newItem) => {
        const { items } = get()
        const existingIndex = items.findIndex((i) => i.id === newItem.id)

        if (existingIndex > -1) {
          const updated = [...items]
          updated[existingIndex].quantity += newItem.quantity
          set({ items: updated })
        } else {
          set({ items: [...items, newItem] })
        }
      },

      updateQuantity: (id, delta) => {
        const { items } = get()
        const updated = items
          .map((item) => {
            if (item.id === id) {
              const newQty = item.quantity + delta
              return newQty > 0 ? { ...item, quantity: newQty } : null
            }
            return item
          })
          .filter(Boolean) as StorefrontCartItem[]

        set({ items: updated })
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) })
      },

      clearCart: () => set({ items: [] }),

      getTotalCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getTotalAmount: () => {
        return get().items.reduce(
          (sum, item) => sum + item.totalPrice * item.quantity,
          0
        )
      },
    }),
    {
      name: 'kitchenos_customer_cart',
    }
  )
)
