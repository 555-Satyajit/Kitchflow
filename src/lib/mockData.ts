import { Brand, Ingredient, MenuItem, Order, StockLedgerEntry } from "@/types";
import { calculateOrderFinancials } from "./finance";

export const INITIAL_BRANDS: Brand[] = [
  { id: 'b1', name: 'Biryani Central', tagline: 'Dum Pukht Specialists', color: '#f97316', active: true },
  { id: 'b2', name: 'Burger Box', tagline: 'Smash & Crispy Gourmet', color: '#eab308', active: true },
  { id: 'b3', name: 'Wrap Nation', tagline: 'Rolled Fresh Daily', color: '#10b981', active: true },
];

export const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 'i1', name: 'Basmati Rice', unit: 'g', currentStock: 7900, minThreshold: 2000, costPerUnit: 0.12 },
  { id: 'i2', name: 'Chicken Breast / Curry Cut', unit: 'g', currentStock: 3760, minThreshold: 1500, costPerUnit: 0.28 },
  { id: 'i3', name: 'Brioche Burger Bun', unit: 'pc', currentStock: 28, minThreshold: 10, costPerUnit: 18.00 },
  { id: 'i4', name: 'Crispy Chicken Patty', unit: 'pc', currentStock: 18, minThreshold: 8, costPerUnit: 42.00 },
  { id: 'i5', name: 'Tortilla Flatbread', unit: 'pc', currentStock: 35, minThreshold: 12, costPerUnit: 9.50 },
  { id: 'i6', name: 'Spicy Secret Mayo', unit: 'ml', currentStock: 1200, minThreshold: 300, costPerUnit: 0.15 },
  { id: 'i7', name: 'Biryani Gravy Base', unit: 'ml', currentStock: 3260, minThreshold: 1000, costPerUnit: 0.18 },
  { id: 'i8', name: 'Mint Masala Chaas / Beverage', unit: 'ml', currentStock: 4500, minThreshold: 1000, costPerUnit: 0.08 },
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm1',
    brandId: 'b1',
    name: 'Hyderabadi Chicken Dum Biryani (Boneless)',
    description: 'Aromatic layered long-grain rice with slow-cooked marinated chicken.',
    station: 'DUM_BIRYANI',
    secondaryStations: ['ASSEMBLY', 'PACKING'],
    sellingPrice: 389,
    packagingCost: 22,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    recipe: [
      { ingredientId: 'i1', ingredientName: 'Basmati Rice', quantity: 300, unit: 'g' }, // 300g * 0.12 = 36.00
      { ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 220, unit: 'g' }, // 220g * 0.28 = 61.60
      { ingredientId: 'i7', ingredientName: 'Biryani Gravy Base', quantity: 120, unit: 'ml' }, // 120ml * 0.18 = 21.60
      // Total 1x Biryani BOM = 36.00 + 61.60 + 21.60 = 119.20. For 2x Biryani BOM = 238.40.
    ]
  },
  {
    id: 'm2',
    brandId: 'b2',
    name: 'OG Nashville Hot Crunch Burger',
    description: 'Crispy fried chicken patty, brioche bun, Nashville oil & spicy secret mayo.',
    station: 'FRY',
    secondaryStations: ['GRILL', 'ASSEMBLY'],
    sellingPrice: 299,
    packagingCost: 18,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    recipe: [
      { ingredientId: 'i3', ingredientName: 'Brioche Burger Bun', quantity: 1, unit: 'pc' }, // 18.00
      { ingredientId: 'i4', ingredientName: 'Crispy Chicken Patty', quantity: 1, unit: 'pc' }, // 42.00
      { ingredientId: 'i6', ingredientName: 'Spicy Secret Mayo', quantity: 30, unit: 'ml' }, // 30ml * 0.15 = 4.50
      // Total 1x Burger BOM = 18.00 + 42.00 + 4.50 = 64.50.
    ]
  },
  {
    id: 'm3',
    brandId: 'b3',
    name: 'Smoky Tandoori Chicken Wrap',
    description: 'Grilled tandoori chicken chunks tossed with crisp onions & minted mayo.',
    station: 'GRILL',
    secondaryStations: ['ASSEMBLY'],
    sellingPrice: 249,
    packagingCost: 15,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    recipe: [
      { ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }, // 9.50
      { ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 140, unit: 'g' }, // 140 * 0.28 = 39.20
      { ingredientId: 'i6', ingredientName: 'Spicy Secret Mayo', quantity: 25, unit: 'ml' }, // 25 * 0.15 = 3.75
      // Total Wrap BOM = 52.45
    ]
  },
  {
    id: 'm4',
    brandId: 'b1',
    name: 'Chilled Spiced Buttermilk (Chaas)',
    description: 'Cold refreshing buttermilk with roasted cumin and fresh coriander.',
    station: 'BEVERAGE',
    sellingPrice: 79,
    packagingCost: 8,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    recipe: [
      { ingredientId: 'i8', ingredientName: 'Mint Masala Chaas / Beverage', quantity: 300, unit: 'ml' },
    ]
  }
];

// Exact calculated order financials with paise precision
const order1Financials = calculateOrderFinancials({
  itemSubtotal: 778, // 2 x 389
  packagingFeeCollected: 30,
  customerDiscount: 75,
  commissionRate: 0.22,
  ingredientCost: 238.40, // 2 x 119.20 (Basmati: 72, Chicken: 123.2, Gravy: 43.2)
  packagingMaterialCost: 44, // 2 x 22
  settings: {
    applyCommissionOn: 'NET_AFTER_DISCOUNT',
    includeGstInDeduction: false,
    includeGstOnCommission: false,
  }
}).financials;

const order2Financials = calculateOrderFinancials({
  itemSubtotal: 299,
  packagingFeeCollected: 20,
  customerDiscount: 30,
  commissionRate: 0.24,
  ingredientCost: 64.50, // Bun (18) + Patty (42) + Mayo (4.5)
  packagingMaterialCost: 18,
  settings: {
    applyCommissionOn: 'NET_AFTER_DISCOUNT',
    includeGstInDeduction: false,
    includeGstOnCommission: false,
  }
}).financials;

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: '#SW-8491',
    channel: 'SWIGGY',
    brandId: 'b1',
    brandName: 'Biryani Central',
    customerName: 'Aarav Sharma',
    status: 'PREPARING',
    targetPrepMinutes: 14,
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(), // 7 mins ago
    acknowledgedAt: new Date(Date.now() - 6.5 * 60 * 1000).toISOString(),
    items: [
      {
        id: 'oi-1',
        menuItemId: 'm1',
        name: 'Hyderabadi Chicken Dum Biryani (Boneless)',
        station: 'DUM_BIRYANI',
        secondaryStations: ['ASSEMBLY', 'PACKING'],
        quantity: 2,
        price: 389,
        stationDone: false,
      }
    ],
    checklist: {
      cutlery: true,
      saucesDips: true,
      napkins: true,
      tamperSeal: false,
      beverageSeparated: false,
    },
    financials: order1Financials,
  },
  {
    id: 'ord-102',
    orderNumber: '#ZM-3022',
    channel: 'ZOMATO',
    brandId: 'b2',
    brandName: 'Burger Box',
    customerName: 'Priya Iyer',
    status: 'ACCEPTED',
    targetPrepMinutes: 12,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 mins ago
    acknowledgedAt: new Date(Date.now() - 1.5 * 60 * 1000).toISOString(),
    items: [
      {
        id: 'oi-2',
        menuItemId: 'm2',
        name: 'OG Nashville Hot Crunch Burger',
        station: 'FRY',
        secondaryStations: ['GRILL', 'ASSEMBLY'],
        quantity: 1,
        price: 299,
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
    financials: order2Financials,
  }
];

export const INITIAL_STOCK_LEDGER: StockLedgerEntry[] = [
  {
    id: 'led-1',
    ingredientId: 'i1',
    ingredientName: 'Basmati Rice',
    previousStock: 8500,
    delta: -600,
    newStock: 7900,
    unit: 'g',
    reason: 'RECIPE_AUTO_CONSUMPTION',
    note: 'Auto-deducted by order #SW-8491 (2x Biryani: 600g)',
    timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 'led-1b',
    ingredientId: 'i2',
    ingredientName: 'Chicken Breast / Curry Cut',
    previousStock: 4200,
    delta: -440,
    newStock: 3760,
    unit: 'g',
    reason: 'RECIPE_AUTO_CONSUMPTION',
    note: 'Auto-deducted by order #SW-8491 (2x Biryani: 440g)',
    timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 'led-1c',
    ingredientId: 'i7',
    ingredientName: 'Biryani Gravy Base',
    previousStock: 3500,
    delta: -240,
    newStock: 3260,
    unit: 'ml',
    reason: 'RECIPE_AUTO_CONSUMPTION',
    note: 'Auto-deducted by order #SW-8491 (2x Biryani: 240ml)',
    timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 'led-2',
    ingredientId: 'i4',
    ingredientName: 'Crispy Chicken Patty',
    previousStock: 20,
    delta: -2,
    newStock: 18,
    unit: 'pc',
    reason: 'WASTAGE_SPOILAGE',
    note: 'Burned during shift rush',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'led-3',
    ingredientId: 'i3',
    ingredientName: 'Brioche Burger Bun',
    previousStock: 10,
    delta: 18,
    newStock: 28,
    unit: 'pc',
    reason: 'PURCHASE_INFLOW',
    note: 'Daily bakery delivery received',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  }
];
