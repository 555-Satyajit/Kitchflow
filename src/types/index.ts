export type Channel = 'SWIGGY' | 'ZOMATO' | 'DIRECT' | 'WALK_IN';

export type OrderStatus =
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'DISPATCHED'
  | 'CANCELLED';

export type Station = 
  | 'GRILL' 
  | 'FRY' 
  | 'TANDOOR' 
  | 'DUM_BIRYANI' 
  | 'WOK' 
  | 'PIZZA' 
  | 'BEVERAGE' 
  | 'DESSERT' 
  | 'ASSEMBLY' 
  | 'PACKING';

export interface Brand {
  id: string;
  name: string;
  tagline: string;
  color: string;
  logoUrl?: string;
  active: boolean;
}

export type StockReasonCode = 
  | 'WASTAGE_SPOILAGE' 
  | 'AUDIT_CORRECTION' 
  | 'PURCHASE_INFLOW' 
  | 'RECIPE_AUTO_CONSUMPTION';

export interface StockLedgerEntry {
  id: string;
  ingredientId: string;
  ingredientName: string;
  previousStock: number;
  delta: number;
  newStock: number;
  unit: string;
  reason: StockReasonCode;
  note?: string;
  timestamp: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: 'g' | 'ml' | 'pc' | 'kg' | 'l';
  currentStock: number;
  minThreshold: number;
  costPerUnit: number;
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

export interface MenuItem {
  id: string;
  brandId: string;
  name: string;
  description: string;
  station: Station;
  secondaryStations?: Station[];
  sellingPrice: number;
  packagingCost: number;
  isAvailable: boolean;
  swiggyOnline: boolean;
  zomatoOnline: boolean;
  lastSyncedAt?: string;
  recipe: RecipeItem[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  station: Station;
  secondaryStations?: Station[];
  quantity: number;
  price: number;
  stationDone?: boolean;
}

export interface DynamicChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: 'PACKAGING' | 'BEVERAGE' | 'CONDIMENT' | 'SAFETY';
}

export interface PackingChecklist {
  cutlery: boolean;
  saucesDips: boolean;
  napkins: boolean;
  tamperSeal: boolean;
  beverageSeparated: boolean;
}

export interface OrderFinancials {
  grossAmount: number;
  discount: number;
  commissionRate: number; // e.g. 0.22 for 22%
  commissionAmount: number;
  taxes: number;
  packagingFeeCollected: number;
  ingredientCost: number;
  packagingCost: number;
  netMargin: number;
  netMarginPercentage: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  channel: Channel;
  brandId: string;
  brandName: string;
  customerName: string;
  status: OrderStatus;
  items: OrderItem[];
  checklist: PackingChecklist;
  dynamicChecklist?: DynamicChecklistItem[];
  targetPrepMinutes: number;
  createdAt: string; // ISO
  acknowledgedAt?: string;
  readyAt?: string;
  financials: OrderFinancials;
}

export type UserRole = 'OWNER' | 'KITCHEN_MANAGER' | 'LINE_COOK';
export type KitchenLanguage = 'EN' | 'HI';
