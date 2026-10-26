export const kdsTags = {
  all: 'kds',
  kitchen: (kitchenId: string) => `kds:${kitchenId}`,
  orders: (kitchenId: string) => `kds:${kitchenId}:orders`,
  station: (kitchenId: string, station: string) => `kds:${kitchenId}:station:${station}`,
};
