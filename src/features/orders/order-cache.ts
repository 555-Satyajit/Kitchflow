export const orderTags = {
  all: 'orders',
  kitchen: (kitchenId: string) => `orders:${kitchenId}`,
  feed: (kitchenId: string) => `orders:${kitchenId}:feed`,
  detail: (orderId: string) => `orders:detail:${orderId}`,
};
