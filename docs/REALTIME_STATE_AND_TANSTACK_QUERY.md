# Realtime Architecture: TanStack Query + Supabase Broadcast & Replication

## 1. Executive Summary & Why This Architecture Exists

In a commercial multi-brand cloud kitchen running simultaneous tablet displays (Cook KDS, Dispatch & Bag Packing, Live Manager Queue, Top Navigation, and Mobile Bottom Bar), maintaining **consistent state across devices** is a classic distributed systems challenge:
- **Station Cooks**: Viewing Cook Station KDS (`/kds`) on Android tablets.
- **Dispatch Station**: Viewing Packing Checklist & Ready Orders (`/packing`).
- **Store Managers**: Viewing Live Order Queue (`/orders`) on laptops or POS counters.

### The Real-World Problems We Solved
1. **Client State vs. Server State Confusion**: Storing order tickets in raw React `useState` created state copies in every browser. Actions performed in Browser A left Browser B displaying stale tickets until F5 (hard refresh).
2. **Ghost Badges & Desynchronization**: Relying only on PostgreSQL replication (`postgres_changes`) caused noticeable delays (1–3 seconds) because PostgreSQL writes to disk/WAL before firing events.
3. **Multi-Browser & Tenant Isolation Mismatch**: When split-screening two browsers (or using incognito), one browser had `kitchflow_active_kitchen_id` in localStorage while the other was in `'all'` or `'default'`. Broadcasting to a single tenant channel resulted in the other window never receiving the packet.
4. **Initial Page Load Lag**: The navbar badges were waiting for client-side JavaScript hydration and `mounted === true`, causing tabs to show without count badges for 1–2 seconds.

---

## 2. The 3-Tier Zero-Lag Architecture

Our production architecture combines **SSR Pre-fetching + In-Memory Realtime Broadcast + Background Database Verification**:

```
 [ Action Triggered: Cook marks ticket READY or Dispatch marks DISPATCHED ]
                                     |
       +-----------------------------+-----------------------------+
       |                                                           |
       v                                                           v
 [ 1. Local Device ]                                       [ 2. Peer Devices ]
 Optimistic Mutation                                       In-Memory Realtime Broadcast
 - TanStack Query cache updates instantly                  - Tiny JSON packet (< 120 bytes)
 - Badges increment / decrement (0 ms)                     - Broadcasts to facility & global rooms
 - Perceived UI latency: ZERO                              - All connected tablets update in < 10 ms
                                                                   |
                                                                   v
                                                  [ 3. PostgreSQL Database ]
                                                  Prisma Server Action Execution
                                                  - Updates database with indexed query
                                                  - WAL Replication triggers background invalidation
                                                  - Guarantees 100% eventual consistency & zero drift
```

### Key Performance Benefits:
- **Instant Touch Response ($0\text{ ms}$)**: Cooks and dispatch operators never see spinners or freezing screens.
- **Zero Disk Load on Broadcast**: Inter-station communication travels through RAM via Supabase's Elixir/Phoenix cluster without hitting PostgreSQL disk.
- **B-Tree Indexed Reads**: Count aggregations use the `(kitchen_id, status)` composite index in PostgreSQL, executing in $<2\text{ ms}$ even on 1,000,000+ rows.

---

## 3. Core File Implementations & Responsibilities

### 1. Global Query Provider
**File**: `src/providers/query-provider.tsx`
- Sets `staleTime: 5000` (5-second freshness window).
- Sets `refetchOnWindowFocus: true` so kitchen tablets automatically reconcile state when unlocked or woken up from sleep.

### 2. Universal Navigation Counter Hook
**File**: `src/hooks/useNavCounts.ts`
- **Queries**: `getNavCountsAction(effectiveKitchenId)`
- **Tenant-Isolated Broadcast Bus**:
  Listens to tenant-scoped `kitchen-${kid}-counters` (or `kitchen-all-counters` when viewing all branches) with device loopback protection via `getDeviceUuid()` so the sending terminal's local optimistic mutation is not duplicated.
- **Events Handled**:
  - `nav_counter_delta`: Inter-station optimistic deltas (`ORDER_PUNCHED`, `KDS_START_COOKING`, `KDS_COMPLETE`, `DISPATCH_COMPLETE`).
    *Note*: `KDS_COMPLETE` only decrements `kdsCount`. It does **not** increment `packingCount` because Dispatch already tracks orders in both `PREPARING` and `READY`.
  - `order_status_changed`, `order_dispatched`, `new_order_placed`.
  - `postgres_changes`: Background PostgreSQL replication fallback with 1,000ms stale-time invalidation.

### 3. Cook Station Hook
**File**: `src/features/kds/hooks/useKdsOrders.ts`
- **Query Key**: `['kds-orders', kitchenId]`
- **Optimistic Mutations**:
  - `toggleItem`: Toggles individual dish checklist with integer version concurrency gating (`toggleStationItemAction` advances `ACCEPTED` orders to `PREPARING` while cooking, leaving `READY` transition exclusively to the expeditor/cook ready trigger).
  - `markOrderReady`: Instantly removes ticket from KDS, decrements KDS badge count optimistically, and broadcasts `KDS_COMPLETE` before the database query finishes.

### 4. Dispatch & Packing Hook
**File**: `src/features/packing/hooks/usePackingOrders.ts`
- **Query Key**: `['packing-orders', kitchenId]`
- **Optimistic Mutations**:
  - `toggleChecklistItem`: Toggles packing items (cutlery, sauces, tamper seals).
  - `completePacking`: Instantly drops order from dispatch and decrements both Orders and Dispatch badge counts.

### 5. Live Orders Queue Hook
**File**: `src/features/orders/hooks/useLiveOrders.ts`
- **Query Key**: `['live-orders', kitchenId]`
- **Optimistic Mutations**:
  - `updateStatus`: Instantly advances order status (`ACCEPTED`, `PREPARING`, `CANCELLED`).

---

## 4. Multi-Outlet & Tenant Isolation Strategy

To ensure zero cross-kitchen data leakage when operating 100+ cloud kitchen facilities:

| Scope | Channel Name | Purpose |
| :--- | :--- | :--- |
| **Facility-Scoped** | `kitchen-${kitchenId}-counters`<br>`kitchen-${kitchenId}-kds`<br>`kitchen-${kitchenId}-packing` | Isolates high-frequency cook actions so Mumbai tablets never receive Bangalore kitchen events. |
| **Global Multi-Outlet** | `kitchen-all-counters`<br>`kitchen-all-orders` | Used by brand owners and multi-branch managers who view aggregate metrics across all branches. |
| **Database RLS** | PostgreSQL Row-Level Security & Prisma `kitchenId` WHERE clauses | Prevents unauthorized cross-tenant database reads even if a socket payload is intercepted. |

---

## 5. Blueprint: Adding a New Feature with TanStack Query

When introducing a new realtime module in the future (e.g. Table Reservations, Driver Live Tracking, Inventory Alerts):

### Step 1: Create the Server Query & Action
In `src/features/<feature>/<feature>-actions.ts`:
```ts
'use server';
export async function getFeatureDataAction(kitchenId?: string) { ... }
export async function updateFeatureDataAction(params: { ... }) { ... }
```

### Step 2: Create the Dedicated Realtime Hook
In `src/features/<feature>/hooks/useFeature.ts`:
```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export const FEATURE_QUERY_KEY = ['feature-key'] as const;

export function useFeature(kitchenId?: string, initialData?: any) {
  const queryClient = useQueryClient();
  const queryKey = [...FEATURE_QUERY_KEY, kitchenId || 'all'];

  const query = useQuery({
    queryKey,
    queryFn: () => getFeatureDataAction(kitchenId),
    initialData,
    staleTime: 5000,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`kitchen-${kitchenId || 'all'}-feature`)
      .on('broadcast', { event: 'feature_updated' }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: '<feature_table>' }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [kitchenId, queryClient, queryKey]);

  const mutation = useMutation({
    mutationFn: updateFeatureDataAction,
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => ({ ...old, ...newData }));
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { data: query.data, mutate: mutation.mutate };
}
```

### Step 3: Consume in UI Client Component
Always pre-fetch in the Server Component (`page.tsx` or `feature-section.tsx`) and pass down `initialData` to eliminate loading spinners.

---

## 6. Troubleshooting & Common Pitfalls

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"Cannot add postgres_changes callbacks after subscribe()"** | Calling `.channel()` with the same static channel name across two components on the same page. | Add a unique suffix per component instance: `${channelName}-${Math.random().toString(36).substring(2, 9)}`. |
| **"React has detected a change in the order of Hooks"** | Calling `useNavCounts()` or other hooks after an `if (!mounted) return null` early return. | Always place all custom hooks and `useContext` calls at the **very top of the component**, before any conditional returns. |
| **Badge numbers multiplying or drifting during KDS/Dispatch transitions** | Sender received its own broadcast and ran delta updates 2x/3x, or `KDS_COMPLETE` incremented `packingCount` when order was already in `PREPARING`. | Add `senderId === myDeviceUuid` loopback protection, avoid duplicate channel subscriptions, and only decrement `kdsCount` on `KDS_COMPLETE`. |
| **`setQueryData` did not update navbar badges** | Passing scalar key `['nav-counts']` instead of matching nested key `['nav-counts', kitchenId]`. | Use `queryClient.setQueriesData({ queryKey: NAV_COUNTS_QUERY_KEY }, ...)` to update all matching cache variations simultaneously. |
