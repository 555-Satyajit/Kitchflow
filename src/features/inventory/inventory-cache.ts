export const inventoryTags = {
  all: 'inventory',
  kitchen: (kitchenId: string) => `inventory:${kitchenId}`,
  ingredients: (kitchenId: string) => `inventory:${kitchenId}:ingredients`,
  menuItems: (kitchenId: string) => `inventory:${kitchenId}:menu-items`,
  stockLedger: (kitchenId: string) => `inventory:${kitchenId}:ledger`,
  purchaseOrders: (kitchenId: string) => `inventory:${kitchenId}:purchase-orders`,
};
