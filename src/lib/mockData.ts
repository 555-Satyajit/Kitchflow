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
  },
  {
    id: 'm5',
    brandId: 'b1',
    name: 'Mutton Dum Biryani (Kolkata Style)',
    description: 'Tender baby goat pieces slow-cooked with spiced potatoes and golden egg.',
    station: 'DUM_BIRYANI',
    sellingPrice: 489,
    packagingCost: 24,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i1', ingredientName: 'Basmati Rice', quantity: 320, unit: 'g' }]
  },
  {
    id: 'm6',
    brandId: 'b1',
    name: 'Paneer Makhani Biryani',
    description: 'Charred cottage cheese cubes layered in rich butter-tomato dum gravy.',
    station: 'DUM_BIRYANI',
    sellingPrice: 329,
    packagingCost: 20,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i1', ingredientName: 'Basmati Rice', quantity: 280, unit: 'g' }]
  },
  {
    id: 'm7',
    brandId: 'b1',
    name: 'Chicken 65 Hyderabadi Fry',
    description: 'Crispy deep-fried boneless chicken tossed with curry leaves and green chillies.',
    station: 'FRY',
    sellingPrice: 269,
    packagingCost: 14,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 180, unit: 'g' }]
  },
  {
    id: 'm8',
    brandId: 'b1',
    name: 'Guntur Spicy Chicken Wings',
    description: 'Fiery Andhra-style fried wings coated with roasted red chilli glaze.',
    station: 'FRY',
    sellingPrice: 289,
    packagingCost: 15,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 200, unit: 'g' }]
  },
  {
    id: 'm9',
    brandId: 'b1',
    name: 'Tandoori Murgh (Half)',
    description: 'Traditional clay-oven roasted chicken marinated in Kashmiri degi mirch.',
    station: 'GRILL',
    sellingPrice: 349,
    packagingCost: 18,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 350, unit: 'g' }]
  },
  {
    id: 'm10',
    brandId: 'b1',
    name: 'Malai Chicken Tikka (6 Pcs)',
    description: 'Melt-in-mouth chicken chunks steeped in fresh cream and green cardamom.',
    station: 'GRILL',
    sellingPrice: 319,
    packagingCost: 16,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 220, unit: 'g' }]
  },
  {
    id: 'm11',
    brandId: 'b1',
    name: 'Mirchi Ka Salan (Side Bowl)',
    description: 'Peanut, sesame, and tamarind curry traditionally paired with dum biryani.',
    station: 'DUM_BIRYANI',
    sellingPrice: 69,
    packagingCost: 8,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i7', ingredientName: 'Biryani Gravy Base', quantity: 150, unit: 'ml' }]
  },
  {
    id: 'm12',
    brandId: 'b1',
    name: 'Burani Garlic Raita',
    description: 'Thick whipped hung curd seasoned with roasted crushed garlic and black rock salt.',
    station: 'BEVERAGE',
    sellingPrice: 59,
    packagingCost: 6,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i8', ingredientName: 'Mint Masala Chaas / Beverage', quantity: 120, unit: 'ml' }]
  },
  {
    id: 'm13',
    brandId: 'b1',
    name: 'Shahi Gulab Jamun (2 Pcs)',
    description: 'Warm khoya dumplings soaked in saffron and rose water sugar syrup.',
    station: 'DESSERT',
    sellingPrice: 89,
    packagingCost: 8,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm14',
    brandId: 'b1',
    name: 'Royal Kesari Phirni',
    description: 'Slow-cooked ground rice pudding flavored with saffron strands in clay pot.',
    station: 'DESSERT',
    sellingPrice: 119,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm15',
    brandId: 'b1',
    name: 'Masala Lemon Soda',
    description: 'Freshly squeezed lime with toasted cumin, mint, and effervescent soda.',
    station: 'BEVERAGE',
    sellingPrice: 89,
    packagingCost: 8,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i8', ingredientName: 'Mint Masala Chaas / Beverage', quantity: 250, unit: 'ml' }]
  },

  // Brand 2: Burger Box (m16 - m26)
  {
    id: 'm16',
    brandId: 'b2',
    name: 'Double Smash Cheddar Burger',
    description: 'Twin smashed patties with melted Wisconsin cheddar and caramelized onions.',
    station: 'GRILL',
    sellingPrice: 349,
    packagingCost: 20,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i3', ingredientName: 'Brioche Burger Bun', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm17',
    brandId: 'b2',
    name: 'Truffle Mushroom Swiss Burger',
    description: 'Pan-seared button mushrooms with Swiss cheese and truffle garlic emulsion.',
    station: 'GRILL',
    sellingPrice: 369,
    packagingCost: 20,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i3', ingredientName: 'Brioche Burger Bun', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm18',
    brandId: 'b2',
    name: 'Crispy Peri-Peri Chicken Burger',
    description: 'Crumbed chicken breast dusted in spicy peri-peri dust with coleslaw.',
    station: 'FRY',
    sellingPrice: 279,
    packagingCost: 18,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i4', ingredientName: 'Crispy Chicken Patty', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm19',
    brandId: 'b2',
    name: 'Spicy Paneer Tikka Burger',
    description: 'Tandoori-spiced char-grilled cottage cheese slab with mint ranch.',
    station: 'GRILL',
    sellingPrice: 259,
    packagingCost: 16,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i3', ingredientName: 'Brioche Burger Bun', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm20',
    brandId: 'b2',
    name: 'Loaded Cheese Fries',
    description: 'Golden skin-on french fries drenched in hot cheddar sauce and jalapenos.',
    station: 'FRY',
    sellingPrice: 189,
    packagingCost: 12,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm21',
    brandId: 'b2',
    name: 'Peri-Peri Crinkle Fries',
    description: 'Deep-fried crinkle cut potatoes tossed with signature African peri-peri shake.',
    station: 'FRY',
    sellingPrice: 149,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm22',
    brandId: 'b2',
    name: 'Crispy Onion Rings (8 Pcs)',
    description: 'Beer-battered jumbo sweet onion rings served with smoky chipotle dip.',
    station: 'FRY',
    sellingPrice: 169,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm23',
    brandId: 'b2',
    name: 'Classic Salted French Fries',
    description: 'Golden crisp salted fries with Heinz ketchup.',
    station: 'FRY',
    sellingPrice: 129,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm24',
    brandId: 'b2',
    name: 'Thick Belgian Chocolate Shake',
    description: 'Made with imported Belgian cocoa, vanilla ice cream, and whipped cream.',
    station: 'BEVERAGE',
    sellingPrice: 199,
    packagingCost: 15,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm25',
    brandId: 'b2',
    name: 'Oreo Cream Cookie Shake',
    description: 'Crushed Oreo cookies blended with chilled milk and chocolate fudge.',
    station: 'BEVERAGE',
    sellingPrice: 199,
    packagingCost: 15,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm26',
    brandId: 'b2',
    name: 'Chilled Cold Coffee',
    description: 'Classic brewed espresso blended with sweetened milk and ice cream.',
    station: 'BEVERAGE',
    sellingPrice: 149,
    packagingCost: 12,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },

  // Brand 3: Wrap Nation (m27 - m36)
  {
    id: 'm27',
    brandId: 'b3',
    name: 'Butter Chicken Kathi Roll',
    description: 'Succulent chicken tikka folded with makhani gravy inside a flaky paratha.',
    station: 'GRILL',
    sellingPrice: 269,
    packagingCost: 15,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm28',
    brandId: 'b3',
    name: 'Spicy Chettinad Chicken Wrap',
    description: 'Southern black-pepper spiced chicken with sliced red onions and curry leaf oil.',
    station: 'WOK',
    sellingPrice: 259,
    packagingCost: 15,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm29',
    brandId: 'b3',
    name: 'Paneer Bhurji & Cheese Wrap',
    description: 'Scrambled spiced cottage cheese, diced bell peppers, and melted mozzarella.',
    station: 'WOK',
    sellingPrice: 239,
    packagingCost: 14,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm30',
    brandId: 'b3',
    name: 'Falafel Hummus Tahini Wrap',
    description: 'Crispy ground chickpea patties with garlic tahini, pickled gherkins, and lettuce.',
    station: 'FRY',
    sellingPrice: 229,
    packagingCost: 14,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm31',
    brandId: 'b3',
    name: 'Double Egg Masala Roll',
    description: 'Two country eggs beaten with onions, green chillies, and chaat masala.',
    station: 'GRILL',
    sellingPrice: 159,
    packagingCost: 12,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }]
  },
  {
    id: 'm32',
    brandId: 'b3',
    name: 'Crispy Chicken Strips (4 Pcs)',
    description: 'Tender chicken breast goujons with sweet chilli mustard dip.',
    station: 'FRY',
    sellingPrice: 199,
    packagingCost: 12,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 160, unit: 'g' }]
  },
  {
    id: 'm33',
    brandId: 'b3',
    name: 'Jalapeno Cheese Poppers (6 Pcs)',
    description: 'Bite-sized crumbed balls stuffed with sharp cheese and pickled jalapenos.',
    station: 'FRY',
    sellingPrice: 179,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm34',
    brandId: 'b3',
    name: 'Iced Lemon Mint Tea',
    description: 'Brewed Darjeeling tea infused with crushed fresh mint and lemon juice.',
    station: 'BEVERAGE',
    sellingPrice: 99,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm35',
    brandId: 'b3',
    name: 'Peach Passion Fruit Cooler',
    description: 'Fizzy sparkling peach pulp cooler with basil seeds.',
    station: 'BEVERAGE',
    sellingPrice: 119,
    packagingCost: 10,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: []
  },
  {
    id: 'm36',
    brandId: 'b3',
    name: 'Nutella Banana Sweet Roll',
    description: 'Flaky warm toasted wrap spread generously with hazelnut Nutella and fresh bananas.',
    station: 'DESSERT',
    sellingPrice: 169,
    packagingCost: 12,
    isAvailable: true,
    swiggyOnline: true,
    zomatoOnline: true,
    lastSyncedAt: new Date().toISOString(),
    recipe: [{ ingredientId: 'i5', ingredientName: 'Tortilla Flatbread', quantity: 1, unit: 'pc' }]
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

export const INITIAL_PURCHASE_ORDERS = [
  {
    id: 'po-101',
    poNumber: 'PO-101',
    supplierName: 'Metro Cash & Carry / Wholesale Mandi',
    horizon: 'LOW_STOCK' as const,
    status: 'PENDING_DELIVERY' as const,
    items: [
      { ingredientId: 'i3', ingredientName: 'Brioche Burger Bun', quantity: 20, unit: 'pc', costPerUnit: 18.00 },
      { ingredientId: 'i4', ingredientName: 'Crispy Chicken Patty', quantity: 15, unit: 'pc', costPerUnit: 42.00 },
    ],
    totalEstimatedCost: 990,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    note: 'Urgent restocking for evening dinner rush'
  },
  {
    id: 'po-100',
    poNumber: 'PO-100',
    supplierName: 'City Fresh Poultry & Grains',
    horizon: 'WEEKLY' as const,
    status: 'RECEIVED' as const,
    items: [
      { ingredientId: 'i1', ingredientName: 'Basmati Rice', quantity: 10000, unit: 'g', costPerUnit: 0.12 },
      { ingredientId: 'i2', ingredientName: 'Chicken Breast / Curry Cut', quantity: 5000, unit: 'g', costPerUnit: 0.28 },
    ],
    totalEstimatedCost: 2600,
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    note: 'Morning supply batch'
  }
];
