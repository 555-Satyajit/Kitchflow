# Single Source of Truth & High-Throughput Pipeline Architecture

## 1. Executive Summary & Core Paradigm

In commercial cloud kitchen networks and high-throughput F&B chains (such as Petpooja, UrbanPiper, Rebel Foods), high peak concurrency (lunch/dinner rushes) makes conventional request-response architectures inadequate:
- Multi-second database transactions freeze POS bill punch stations.
- Polling loops cause screen flickering, race conditions, and out-of-sync station counts (e.g., ticket count jumping $1 \to 0 \to 1$).
- Offline station drops cause lost orders and bill discrepancies.

KitchenOS addresses these challenges through a **Single Source of Truth (SSOT), Local-First Two-Phase Pipeline**:

```
[ POS Station / Aggregator Ingest ]
                 │
                 ▼
  Phase 1: Local-First Ingest (0ms)
    ├─ Immediate Local Order Token Generation (Offline-Safe IDB/LocalStore)
    ├─ Optimistic Memory Store (`useKitchenPipelineStore`)
    └─ Append to Local Outbox (`kitchenos_edge_store.outbox_orders`)
                 │
                 ▼
  Phase 2: Background Edge Ingestion & Persistence
    ├─ PostgreSQL Write (Prisma Transaction)
    ├─ Decoupled Asynchronous Inventory BOM Recipe Deduction
    └─ Realtime Multi-Channel Event Broadcast (Supabase Realtime)
                 │
        ┌────────┴────────┐
        ▼                 ▼
   [ KDS Kitchen ]   [ Dispatch / Packing ]
    (0ms Bump)        (Instant Audio & Ticket View)
```

---

## 2. Core Pillars of the Architecture

### Pillar A: Unified Pipeline Store (`useKitchenPipelineStore`)
- **Location**: [`src/stores/useKitchenPipelineStore.ts`](file:///c:/projects/Kitchenos/src/stores/useKitchenPipelineStore.ts)
- **Problem Solved**: Independent polling states across `/pos`, `/orders`, `/kds`, and `/packing` caused inconsistent ticket counts and layout shifts.
- **Implementation**:
  - Centralized **Zustand** store with an $O(1)$ dictionary lookup (`Map<string, Order>`).
  - Single atomic state transition for:
    - Order Placement (`NEW`)
    - Kitchen Bump (`PREPARING` $\to$ `READY`)
    - Dispatch Handover (`COMPLETED` / `DISPATCHED`)
  - **Undo / Recall Buffer (25s)**: Eliminates kitchen staff panic when an item is accidentally bumped off the screen.
  - **Deduplicated Audio Orchestration**: Centralized Web Audio synthesis that sounds chimes without double-firing on multiple tabs.

### Pillar B: Local-First Offline Edge Store (0ms Token Punch)
- **Location**: [`src/lib/offline-edge-store.ts`](file:///c:/projects/Kitchenos/src/lib/offline-edge-store.ts)
- **Problem Solved**: When internet connection drops or high network latency occurs, counter cashiers cannot afford to wait 5-30 seconds for a bill token.
- **Implementation**:
  - Browser-native **IndexedDB** (`kitchenos_edge_store`) with stores:
    1. `active_tickets`: Local cache of current kitchen orders.
    2. `daily_token_counter`: Sequential daily token generator (`getNextLocalTokenNumber`) that resets daily per outlet.
    3. `outbox_orders`: Local outbox for queued orders created offline or during network spikes.
  - Seamless auto-sync hook [`useOutboxSync.ts`](file:///c:/projects/Kitchenos/src/hooks/useOutboxSync.ts): Flushes pending outbox orders to PostgreSQL as soon as network connectivity is restored.

### Pillar C: Decoupled Hot Punch vs. Background Inventory Ledger
- **Location**: [`src/features/orders/order-actions.ts`](file:///c:/projects/Kitchenos/src/features/orders/order-actions.ts)
- **Problem Solved**: Calculating recipe Bill of Materials (BOM), checking stock thresholds, and inserting append-only stock ledger entries for 10+ items during checkout added up to 33 seconds of blocking latency.
- **Implementation**:
  - **Fast Lane (Hot Path)**: Order record and customer details persist immediately in <80ms; POS cashier receives immediate receipt confirmation and audio ding.
  - **Slow Lane (Asynchronous BOM Worker)**: Ingredient deduction, auto-86 threshold evaluation, and `StockLedgerEntry` creation execute in a non-blocking background queue off the critical punch path.

### Pillar D: Multi-Outlet Brand Scoping & Next.js Router Cache Revalidation
- **Location**:
  - [`src/components/inventory/modals/AddMenuItemModal.tsx`](file:///c:/projects/Kitchenos/src/components/inventory/modals/AddMenuItemModal.tsx)
  - [`src/features/inventory/inventory-actions.ts`](file:///c:/projects/Kitchenos/src/features/inventory/inventory-actions.ts)
  - [`src/features/inventory/components/inventory-section-client.tsx`](file:///c:/projects/Kitchenos/src/features/inventory/components/inventory-section-client.tsx)
- **Problem Solved**: Items added in multi-brand/multi-outlet cloud hubs disappeared after page refresh because the UI selected a brand belonging to a different kitchen hub, and Next.js route caches failed to revalidate.
- **Implementation**:
  - Modal inputs strictly validate `newItemBrandId` against the active outlet's verified brands.
  - Server actions invoke `revalidatePath('/inventory')` and `revalidatePath('/pos')` alongside tag invalidation.
  - Client state immediately updates temporary `m-${Date.now()}` client IDs with true PostgreSQL UUIDs returned from the server.

---

## 3. Data Flow & Lifecycle Matrix

| Event | Initiator | Immediate Local Action | Background / Server Action | Destination Surfaces |
| :--- | :--- | :--- | :--- | :--- |
| **Punch Order** | POS / Aggregator | 0ms local token + outbox write + sound ding | `createManualOrderAction` + async BOM deduction | KDS Kitchen, Dispatch View |
| **Bump Ticket** | KDS Station | 0ms status change + 25s Recall buffer entry | `updateOrderStatusAction('READY')` | Dispatch Packing, Live Queue |
| **Recall Ticket**| KDS Station | Instant restoration to screen from memory buffer | Reverts status in DB to `PREPARING` | KDS Station |
| **Dispatch Order**| Packing Window | Instant green checkmark & print modal | `updateOrderStatusAction('COMPLETED')` | Live Queue, Analytics |
| **Add Dish** | Inventory Manager | 0ms optimistic list injection | `addMenuItemAction` + router cache purge | Inventory Menu, POS Catalog |

---

## 4. Disaster Recovery & Offline Continuity

1. **Complete Internet Loss**:
   - POS stations continue printing receipts and punching orders using local daily token numbers (`DIR-001`, `DIR-002`, ...).
   - Orders remain safely buffered inside IndexedDB `outbox_orders`.
2. **Network Restoration**:
   - `useOutboxSync` detects network recovery and synchronously drains outbox items to PostgreSQL.
   - Orders are assigned permanent server UUIDs without duplicating ticket counters.
3. **Database Fallback / Station PIN Mode**:
   - Station terminals authenticate via HMAC signed session tokens (`kitchflow_staff_session`), keeping offline station operations isolated from centralized cloud downtime.

