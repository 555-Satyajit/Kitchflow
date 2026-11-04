'use client';

import { create } from 'zustand';
import { Order, OrderStatus } from '@/types';
import {
  idbGetAllOrders,
  idbSaveOrderAndQueueMutation,
  idbBulkPutOrders,
  idbGetPendingMutations,
  OutboxMutation,
  OrderEvent,
} from '@/lib/db/edge-db';
import {
  canTransitionStatus,
  mergeItemStationDone,
  deriveNavBadges,
} from '@/lib/domain/order-machine';
import { playKitchenSound } from '@/lib/sound-engine';

interface NavBadgeCounts {
  ordersCount: number;
  kdsCount: number;
  packingCount: number;
}

interface KitchenStoreState {
  orders: Record<string, Order>;
  activeKitchenId: string;
  isHydrated: boolean;
  pendingOutboxCount: number;
  navCounts: NavBadgeCounts;

  // Lifecycle
  hydrate: (kitchenId?: string) => Promise<void>;
  setBulkOrders: (orders: Order[]) => Promise<void>;
  setActiveKitchenId: (kitchenId: string) => void;

  // Operational Mutations (Atomic Zustand + IDB Write-Through)
  punchOrder: (order: Order) => Promise<void>;
  bumpOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<boolean>;
  toggleStationItem: (orderId: string, itemId: string, done: boolean) => Promise<void>;

  // Sync ingestion
  applyServerEvents: (events: OrderEvent[]) => void;
  updateOutboxCount: () => Promise<void>;
  resetStore: () => void;
}

export const useKitchenStore = create<KitchenStoreState>((set, get) => ({
  orders: {},
  activeKitchenId: 'all',
  isHydrated: false,
  pendingOutboxCount: 0,
  navCounts: { ordersCount: 0, kdsCount: 0, packingCount: 0 },

  resetStore: () => {
    set({
      orders: {},
      activeKitchenId: 'all',
      isHydrated: false,
      pendingOutboxCount: 0,
      navCounts: { ordersCount: 0, kdsCount: 0, packingCount: 0 },
    });
  },

  hydrate: async (kitchenId?: string) => {
    try {
      const targetKid = kitchenId || get().activeKitchenId || 'all';
      const localOrders = await idbGetAllOrders(targetKid);
      const ordersMap: Record<string, Order> = {};
      for (const o of localOrders) {
        ordersMap[o.id] = o;
      }
      const pending = await idbGetPendingMutations(targetKid);

      set({
        orders: ordersMap,
        navCounts: deriveNavBadges(Object.values(ordersMap)),
        activeKitchenId: targetKid,
        isHydrated: true,
        pendingOutboxCount: pending.length,
      });
    } catch (err) {
      console.warn('[KitchenStore] IndexedDB hydration warning:', err);
      set({ isHydrated: true });
    }
  },

  setBulkOrders: async (serverOrders: Order[]) => {
    const { orders: currentMap } = get();
    const updatedMap = { ...currentMap };

    for (const incoming of serverOrders) {
      const existing = updatedMap[incoming.id];
      // Only accept server order if no local optimistic pending version is newer
      if (!existing || (incoming.version ?? 0) >= (existing.version ?? 0)) {
        updatedMap[incoming.id] = {
          ...existing,
          ...incoming,
        };
      }
    }

    set({
      orders: updatedMap,
      navCounts: deriveNavBadges(Object.values(updatedMap)),
    });
    await idbBulkPutOrders(Object.values(updatedMap));
  },

  setActiveKitchenId: (kitchenId: string) => {
    set({ activeKitchenId: kitchenId });
    get().hydrate(kitchenId);
  },

  punchOrder: async (order: Order) => {
    const { orders, activeKitchenId } = get();
    const orderId = order.id;
    const mutationId = crypto.randomUUID();

    // 1. Instant 0ms memory update
    const updatedOrders = {
      [orderId]: order,
      ...orders,
    };
    set({
      orders: updatedOrders,
      navCounts: deriveNavBadges(Object.values(updatedOrders)),
    });
    playKitchenSound('NEW_ORDER', 0.4);

    // 2. Atomic single IDB transaction (order + outbox)
    const mutation: OutboxMutation = {
      id: mutationId,
      kitchenId: order.kitchenId || activeKitchenId,
      orderId,
      actionType: 'CREATED',
      payload: {
        orderId,
        orderNumber: order.orderNumber,
        brandId: order.brandId,
        channel: order.channel,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        grossAmount: order.financials?.grossAmount || 0,
        netMargin: order.financials?.netMargin || 0,
        items: order.items,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    await idbSaveOrderAndQueueMutation(order, mutation);
    await get().updateOutboxCount();

    // 3. Nudge sync engine
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kitchflow_outbox_nudge'));
    }
  },

  bumpOrderStatus: async (orderId: string, nextStatus: OrderStatus): Promise<boolean> => {
    const { orders, activeKitchenId } = get();
    const target = orders[orderId];
    if (!target) return false;

    // Validate forward progression via Finite State Machine
    if (!canTransitionStatus(target.status, nextStatus)) {
      console.warn(`[FSM] Illegal transition rejected: ${target.status} -> ${nextStatus}`);
      return false;
    }

    const nextVer = (target.version ?? 0) + 1;
    const mutationId = crypto.randomUUID();

    const updatedOrder: Order = {
      ...target,
      status: nextStatus,
      version: nextVer,
      readyAt: nextStatus === 'READY' ? new Date().toISOString() : target.readyAt,
      dispatchedAt: nextStatus === 'DISPATCHED' ? new Date().toISOString() : (target as any).dispatchedAt,
    };

    // 1. 0ms instant UI update
    const nextOrders = {
      ...orders,
      [orderId]: updatedOrder,
    };
    set({
      orders: nextOrders,
      navCounts: deriveNavBadges(Object.values(nextOrders)),
    });

    if (nextStatus === 'READY') {
      playKitchenSound('ORDER_DISPATCH', 0.4);
    } else {
      playKitchenSound('ITEM_COMPLETE', 0.3);
    }

    // 2. Atomic IDB transaction
    const mutation: OutboxMutation = {
      id: mutationId,
      kitchenId: target.kitchenId || activeKitchenId,
      orderId,
      actionType: 'STATUS_CHANGED',
      payload: {
        orderId,
        status: nextStatus,
        version: nextVer,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    await idbSaveOrderAndQueueMutation(updatedOrder, mutation);
    await get().updateOutboxCount();

    // 3. Nudge sync engine
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kitchflow_outbox_nudge'));
    }

    return true;
  },

  toggleStationItem: async (orderId: string, itemId: string, done: boolean) => {
    const { orders, activeKitchenId } = get();
    const target = orders[orderId];
    if (!target) return;

    const nextVer = (target.version ?? 0) + 1;
    const mutationId = crypto.randomUUID();
    const updatedItems = mergeItemStationDone(target.items, itemId, done);

    const updatedOrder: Order = {
      ...target,
      items: updatedItems,
      version: nextVer,
    };

    // 1. 0ms instant UI update
    set({
      orders: {
        ...orders,
        [orderId]: updatedOrder,
      },
    });

    // 2. Atomic IDB transaction
    const mutation: OutboxMutation = {
      id: mutationId,
      kitchenId: target.kitchenId || activeKitchenId,
      orderId,
      actionType: 'ITEM_UPDATED',
      payload: {
        orderId,
        itemId,
        stationDone: done,
        version: nextVer,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    await idbSaveOrderAndQueueMutation(updatedOrder, mutation);
    await get().updateOutboxCount();

    // 3. Nudge sync engine
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kitchflow_outbox_nudge'));
    }
  },

  applyServerEvents: (events: OrderEvent[]) => {
    if (events.length === 0) return;
    const { orders } = get();
    const updated = { ...orders };

    for (const evt of events) {
      if (evt.type === 'STATUS_CHANGED' && evt.payload?.orderId) {
        const existing = updated[evt.payload.orderId];
        if (existing) {
          const nextStatus = evt.payload.status as OrderStatus;
          if (canTransitionStatus(existing.status, nextStatus)) {
            updated[evt.payload.orderId] = {
              ...existing,
              status: nextStatus,
              version: evt.payload.version || (existing.version ?? 0) + 1,
            };
          }
        }
      } else if (evt.type === 'ITEM_UPDATED' && evt.payload?.orderId) {
        const existing = updated[evt.payload.orderId];
        if (existing && evt.payload.itemId) {
          updated[evt.payload.orderId] = {
            ...existing,
            items: mergeItemStationDone(existing.items, evt.payload.itemId, evt.payload.stationDone),
            version: evt.payload.version || (existing.version ?? 0) + 1,
          };
        }
      }
    }

    set({
      orders: updated,
      navCounts: deriveNavBadges(Object.values(updated)),
    });
  },

  updateOutboxCount: async () => {
    try {
      const pending = await idbGetPendingMutations(get().activeKitchenId);
      set({ pendingOutboxCount: pending.length });
    } catch {}
  },
}));

// ==========================================
// PURE STABLE SELECTORS
// ==========================================

export const selectNavCounts = (state: KitchenStoreState) => state.navCounts;

export const selectLiveQueueOrders = (state: KitchenStoreState) => {
  return Object.values(state.orders);
};

export const selectKdsOrders = (state: KitchenStoreState) => {
  return Object.values(state.orders).filter(
    (o) => o.status === 'ACCEPTED' || o.status === 'PREPARING'
  );
};

export const selectPackingOrders = (state: KitchenStoreState) => {
  return Object.values(state.orders).filter(
    (o) => o.status === 'PREPARING' || o.status === 'READY'
  );
};

export const selectDeliveryOrders = (state: KitchenStoreState) => {
  return Object.values(state.orders).filter((o) => o.channel === 'DIRECT');
};

