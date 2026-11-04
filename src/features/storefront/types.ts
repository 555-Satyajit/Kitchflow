export interface StorefrontDish {
  id: string
  name: string
  description: string
  station: string
  sellingPrice: number
  isAvailable: boolean
  category: string
  imageUrl?: string
  dietary?: 'VEG' | 'NON_VEG' | 'VEGAN'
  badge?: string // e.g. "Bestseller", "Chef's Special"
}

export interface StorefrontBrand {
  id: string
  name: string
  tagline: string | null
  color: string
  logoUrl: string | null
  address: string | null
  phone: string | null
  fssaiLic: string | null
  kitchenId: string
  kitchenName?: string
}

export interface StorefrontModifierOption {
  id: string
  name: string
  price: number
}

export interface StorefrontModifierGroup {
  id: string
  name: string
  required: boolean
  multiSelect: boolean
  options: StorefrontModifierOption[]
}

export interface StorefrontCartItem {
  id: string // unique cart item id (dishId + modifier selection key)
  dishId: string
  name: string
  unitPrice: number
  totalPrice: number
  quantity: number
  selectedModifiers: {
    groupId: string
    groupName: string
    optionId: string
    optionName: string
    price: number
  }[]
  specialInstructions?: string
}

export type StorefrontOrderMode = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'

export interface CustomerOrderInput {
  brandId: string
  kitchenId: string
  mode: StorefrontOrderMode
  tableNumber?: string
  customerName: string
  customerPhone: string
  deliveryAddress?: string
  items: {
    menuItemId: string
    quantity: number
    unitPrice: number
    selectedModifiers?: any[]
    specialInstructions?: string
  }[]
  notes?: string
}

