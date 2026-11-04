/**
 * Local-First IndexedDB Kernel (`kitchflow_v2`)
 * Provides crash-resilient transactional write-through for live orders,
 * outbox mutation queuing, and cursor metadata.
 */

import { Order, OrderStatus } from '@/types';

export interface OutboxMutation {
  id: string; // client-generated UUID
  kitchenId: string;
  orderId: string;
  actionType: 'CREATED' | 'STATUS_CHANGED' | 'ITEM_UPDATED' | 'CANCELLED';
  payload: Record<string, any>;
  createdAt: string;
  retryCount: number;
}

export interface SyncMeta {
  kitchenId: string;
  lastSeq: number;
  updatedAt: string;
}

export interface OrderEvent {
  kitchen_id: string;
  seq: number;
  order_id: string;
  type: string;
  payload: any;
  mutation_id: string;
  created_at: string;
}

const DB_NAME = 'kitchflow_v2';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is browser-only'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // 1. Authoritative local orders store
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('idx_status', 'status', { unique: false });
          orderStore.createIndex('idx_kitchenId', 'kitchenId', { unique: false });
          orderStore.createIndex('idx_updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Outbox mutations store
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('idx_orderId', 'orderId', { unique: false });
          outboxStore.createIndex('idx_kitchenId', 'kitchenId', { unique: false });
          outboxStore.createIndex('idx_createdAt', 'createdAt', { unique: false });
        }

        // 3. Cursor metadata store
        if (!db.objectStoreNames.contains('sync_meta')) {
          db.createObjectStore('sync_meta', { keyPath: 'kitchenId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

/**
 * Atomic Single Transaction Write-Through:
 * Updates the order in `orders` and queues the mutation in `outbox` in the exact same transaction.
 * If browser crashes or tab is killed, partial state never occurs.
 */
export async function idbSaveOrderAndQueueMutation(
  order: Order,
  mutation: OutboxMutation
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['orders', 'outbox'], 'readwrite');
    const orderStore = tx.objectStore('orders');
    const outboxStore = tx.objectStore('outbox');

    orderStore.put(order);
    outboxStore.put(mutation);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/**
 * Fetch all local orders in < 10ms for instant cold-start hydration.
 */
export async function idbGetAllOrders(kitchenId?: string): Promise<Order[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readonly');
    const store = tx.objectStore('orders');
    const request = store.getAll();

    request.onsuccess = () => {
      const all: Order[] = request.result || [];
      if (!kitchenId || kitchenId === 'ALL' || kitchenId === 'all') {
        resolve(all);
      } else {
        resolve(all.filter((o) => !o.kitchenId || o.kitchenId === kitchenId));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Bulk save orders into IndexedDB (e.g. from initial server hydration).
 */
export async function idbBulkPutOrders(orders: Order[]): Promise<void> {
  if (orders.length === 0) return;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    for (const order of orders) {
      store.put(order);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Fetch pending outbox mutations ordered by createdAt.
 */
export async function idbGetPendingMutations(kitchenId?: string): Promise<OutboxMutation[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const request = store.getAll();

    request.onsuccess = () => {
      const all: OutboxMutation[] = request.result || [];
      const filtered = !kitchenId || kitchenId === 'ALL' || kitchenId === 'all'
        ? all
        : all.filter((m) => m.kitchenId === kitchenId);
      filtered.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a processed mutation from outbox.
 */
export async function idbRemoveMutation(mutationId: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').delete(mutationId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get the latest pulled sequence cursor for a kitchen.
 */
export async function idbGetLastSeq(kitchenId: string): Promise<number> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_meta', 'readonly');
    const request = tx.objectStore('sync_meta').get(kitchenId);
    request.onsuccess = () => {
      const meta = request.result as SyncMeta | undefined;
      resolve(meta?.lastSeq || 0);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update the cursor sequence for a kitchen.
 */
export async function idbSetLastSeq(kitchenId: string, seq: number): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_meta', 'readwrite');
    tx.objectStore('sync_meta').put({
      kitchenId,
      lastSeq: seq,
      updatedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Applies a batch of server events into IndexedDB and bumps lastSeq in 1 atomic transaction.
 */
export async function idbApplyServerEvents(
  kitchenId: string,
  events: OrderEvent[]
): Promise<void> {
  if (events.length === 0) return;
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['orders', 'sync_meta'], 'readwrite');
    const orderStore = tx.objectStore('orders');
    const metaStore = tx.objectStore('sync_meta');

    let maxSeq = 0;

    for (const evt of events) {
      if (evt.seq > maxSeq) {
        maxSeq = evt.seq;
      }

      if (evt.type === 'CREATED' && evt.payload) {
        const ord = evt.payload;
        if (ord.orderId) {
          orderStore.put({
            id: ord.orderId,
            orderNumber: ord.orderNumber,
            kitchenId: evt.kitchen_id,
            status: ord.status || 'PREPARING',
            version: ord.version || 1,
            items: [],
            financials: { grossAmount: 0 },
            checklist: { cutlery: false, saucesDips: false, napkins: false, tamperSeal: false, beverageSeparated: false },
            createdAt: evt.created_at,
            updatedAt: evt.created_at,
          });
        }
      } else if (evt.type === 'STATUS_CHANGED' && evt.payload?.orderId) {
        const getReq = orderStore.get(evt.payload.orderId);
        getReq.onsuccess = () => {
          const current = getReq.result as Order | undefined;
          if (current) {
            orderStore.put({
              ...current,
              status: evt.payload.status as OrderStatus,
              version: evt.payload.version || (current.version ?? 0) + 1,
              updatedAt: evt.created_at,
            });
          }
        };
      }
    }

    if (maxSeq > 0) {
      metaStore.put({
        kitchenId,
        lastSeq: maxSeq,
        updatedAt: new Date().toISOString(),
      });
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

