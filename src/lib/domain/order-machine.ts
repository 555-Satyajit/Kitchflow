/**
 * Order Domain Finite State Machine (FSM)
 * Shared between client Zustand actions and server apply_mutation logic.
 * Enforces forward-only transitions, terminal statuses, and clean item merging.
 */

import { Order, OrderItem, OrderStatus } from '@/types';

export const STATUS_PROGRESSION: Record<OrderStatus, number> = {
  RECEIVED: 10,
  ACCEPTED: 20,
  PREPARING: 30,
  READY: 40,
  DISPATCHED: 50,
  CANCELLED: 99,
};

/**
 * Validates whether an order can transition from `current` to `next`.
 * Strict Rules:
 * 1. Forward progression only: RECEIVED -> ACCEPTED -> PREPARING -> READY -> DISPATCHED.
 * 2. Terminal states (DISPATCHED, CANCELLED) can NEVER transition to any other status.
 * 3. CANCELLED is only permitted BEFORE DISPATCHED.
 */
export function canTransitionStatus(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true;
  if (current === 'DISPATCHED' || current === 'CANCELLED') return false; // Terminal states
  if (next === 'CANCELLED') return true; // Allowed from any non-terminal state
  return STATUS_PROGRESSION[next] > STATUS_PROGRESSION[current];
}

/**
 * Merges a station item toggle immutably into the order's items array.
 */
export function mergeItemStationDone(
  items: OrderItem[],
  itemId: string,
  stationDone: boolean
): OrderItem[] {
  return items.map((it) => {
    if (it.id === itemId) {
      return {
        ...it,
        stationDone,
        version: (it.version ?? 0) + 1,
      };
    }
    return it;
  });
}

/**
 * Derives badge counts from a list of orders in O(N).
 * Replaces fake delta arithmetic.
 */
export function deriveNavBadges(orders: Order[]) {
  let liveCount = 0;
  let kdsCount = 0;
  let dispatchCount = 0;

  for (let i = 0; i < orders.length; i++) {
    const s = orders[i].status;
    if (s !== 'DISPATCHED' && s !== 'CANCELLED') {
      liveCount++;
    }
    if (s === 'ACCEPTED' || s === 'PREPARING') {
      kdsCount++;
    }
    if (s === 'PREPARING' || s === 'READY') {
      dispatchCount++;
    }
  }

  return {
    ordersCount: liveCount,
    kdsCount,
    packingCount: dispatchCount,
  };
}
