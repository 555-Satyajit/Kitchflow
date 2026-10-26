# KitchenOS: 1,000+ Concurrent Users High-Scale Architecture Plan

This document details the complete end-to-end engineering blueprint to scale **KitchenOS** to support **thousands of concurrent restaurants, kitchen staff, and aggregators** with sub-100ms response times, zero connection exhaustion, and zero database race conditions.

---

## 1. System Scaling Bottlenecks & Architectural Solutions

When scaling a multi-brand cloud kitchen SaaS to thousands of active users, applications typically crash at five points:

| Bottleneck at 1,000+ Users | Why It Fails | KitchenOS Scaled Solution |
| :--- | :--- | :--- |
| **1. Database Connection Exhaustion** | 1,000 Next.js serverless functions attempting to open individual PostgreSQL connections will overwhelm PostgreSQL's `max_connections` (Postgres connections cost 2–3MB RAM each). | **PgBouncer Connection Pooling (Transaction Mode)** via Supabase port `6543`. Limits active database connections to ~15 while serving thousands of concurrent requests. |
| **2. KDS Realtime Thunder-Herd** | 1,000 line cooks listening to global order updates causes Supabase Realtime WebSocket saturation and massive payload fan-out. | **Tenant & Kitchen Scoped Channels (`kitchen:{id}:orders`)**. Each physical facility only receives events for its specific kitchen. |
| **3. High Concurrency Stock Race Conditions** | Two fast orders deducting chicken at the same millisecond cause deadlocks or double-consumption without locks. | **`SELECT ... FOR UPDATE` & Atomic RPC Ledger Functions**. Stock adjustments and recipe deductions execute atomically in a single Postgres transaction. |
| **4. Slow RLS Policy Evaluation** | Un-cached RLS policies evaluate `auth.uid()` per table row. At 1M+ rows across 1,000 users, queries take seconds. | **Subquery Caching `(select auth.uid())` + B-Tree Foreign Key Indexing** on all tenant-isolated tables. |
| **5. Client-Side Layout Shift (CLS)** | Loading states jumping on poor kitchen Wi-Fi/cellular networks degrades kitchen speed. | **`next-beats` Sibling Skeletons** matching exact DOM heights with synchronous composition surfaces. |

---

## 2. High-Throughput System Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients["1,000+ Concurrent Kitchen Users"]
        K1["Line Cooks (KDS Displays)"]
        K2["Counter Staff (POS Terminals)"]
        K3["Managers & Owners (Analytics)"]
        K4["Aggregator Webhooks (Swiggy/Zomato)"]
    end

    subgraph Edge["Vercel Edge / Next.js 16 (Turbopack)"]
        EdgeMiddleware["Edge Auth Middleware (@supabase/ssr)"]
        EdgeCache["Cache Components ('use cache' + tag)"]
        ServerActions["Server Actions (Atomic Writes)"]
        RSC["Async Server Components (Parallel Streams)"]
    end

    subgraph Pooling["Supabase Connection Infrastructure"]
        PgBouncer["PgBouncer (Transaction Pooler :6543)"]
        RealtimeCluster["Supabase Realtime Cluster (WebSockets)"]
    end

    subgraph Database["PostgreSQL (Enterprise Engine)"]
        RLS["Fast Cached RLS Policies: (select auth.uid())"]
        FKIndexes["B-Tree Foreign Key Indexes"]
        AtomicRPC["Atomic RPC: deduct_order_ingredients()"]
        PartitionedTables["orders & stock_ledger (Time Range Partitioned)"]
    end

    Clients --> EdgeMiddleware
    EdgeMiddleware --> RSC & ServerActions
    RSC & ServerActions --> PgBouncer
    PgBouncer --> RLS --> Database
    Database --> AtomicRPC & PartitionedTables
    Database -.-> RealtimeCluster -.-> K1
```

---

## 3. The 4 Engineering Pillars for 1,000+ Users

### Pillar 1: Connection Pooling & Serverless Resilience
In serverless environments (Next.js on Vercel), each invocation spins up independently. Without pooling, a flash flood of 500 Swiggy orders causes `FATAL: remaining connection slots are reserved for non-replication superuser connections`.

1. **Prisma Connection Pooling**:
   `prisma/schema.prisma` uses Supabase's transaction pooler:
   ```env
   # Transaction pooling on port 6543 for queries & mutations
   DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15"

   # Direct connection on port 5432 ONLY for migrations
   DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```
2. **Singleton Client**:
   [src/lib/prisma.ts](file:///c:/projects/Kitchenos/src/lib/prisma.ts) persists the client across hot-reloads and limits memory footprint.

---

### Pillar 2: High-Concurrency Atomic Stock Deductions (Zero Deadlocks)
When multiple POS and aggregator orders arrive simultaneously, updating ingredient stock in separate statements can cause phantom reads and inventory drift.

We execute deductions via a Postgres stored procedure with row locking:
```sql
CREATE OR REPLACE FUNCTION deduct_order_ingredients(
    p_order_id UUID,
    p_kitchen_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    r RECORD;
    v_new_stock NUMERIC(12, 3);
    v_prev_stock NUMERIC(12, 3);
BEGIN
    -- 1. Loop through required ingredients from BOM recipes
    FOR r IN (
        SELECT 
            ri.ingredient_id,
            i.name AS ingredient_name,
            i.unit,
            i.current_stock,
            (ri.quantity * oi.quantity) AS total_consumed
        FROM public.order_items oi
        JOIN public.recipes ri ON ri.menu_item_id = oi.menu_item_id
        JOIN public.ingredients i ON i.id = ri.ingredient_id
        WHERE oi.order_id = p_order_id
          AND i.kitchen_id = p_kitchen_id
        FOR UPDATE OF i -- Row lock prevents concurrent race conditions
    )
    LOOP
        v_prev_stock := r.current_stock;
        v_new_stock := GREATEST(0.000, v_prev_stock - r.total_consumed);

        -- Update ingredient stock
        UPDATE public.ingredients
        SET current_stock = v_new_stock, updated_at = NOW()
        WHERE id = r.ingredient_id;

        -- Write immutable audit ledger entry
        INSERT INTO public.stock_ledger (
            kitchen_id,
            ingredient_id,
            order_id,
            previous_stock,
            delta,
            balance_after,
            unit,
            reason,
            notes
        ) VALUES (
            p_kitchen_id,
            r.ingredient_id,
            p_order_id,
            v_prev_stock,
            -r.total_consumed,
            v_new_stock,
            r.unit,
            'RECIPE_AUTO_CONSUMPTION',
            'Order ' || p_order_id || ' fulfillment'
        );
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;
```

---

### Pillar 3: Scoped Realtime Channels (No WebSocket Flooding)
Broadcasting all orders globally degrades client performance when hundreds of kitchens are operating simultaneously.

**Correct Scaled Pattern**:
Clients subscribe only to their specific kitchen's room:
```typescript
// features/kds/hooks/use-kds-realtime.ts
'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function useKdsRealtime(kitchenId: string) {
  const router = useRouter();

  useEffect(() => {
    // Isolated channel per physical kitchen
    const channel = supabase
      .channel(`kitchen:${kitchenId}:orders`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `kitchen_id=eq.${kitchenId}`,
        },
        () => {
          // Re-fetches the server component stream seamlessly
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [kitchenId, router]);
}
```

---

### Pillar 4: Table Partitioning for Massive Scale (100k+ Orders/Month)
When `orders` and `stock_ledger` reach millions of rows, sequential scans slow down analytics.

We partition orders by monthly date ranges:
```sql
-- Partition orders table by range of created_at
CREATE TABLE orders_partitioned (
    LIKE orders INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE orders_2026_10 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE orders_2026_11 PARTITION OF orders_partitioned
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
```

---

## 4. Phase-by-Phase Execution Roadmap to Launch 1,000+ Users

```
Phase 1: Database Architecture & Core Domain Refactoring (COMPLETED)
   ├── Synced 10 Cooking Stations, PO Reconciliation, and QA Checklists
   ├── Refactored Inventory, KDS, Orders, Margins & Packing into Feature-Sliced RSC
   └── Validated compilation with Next.js Turbopack (0 errors, 14 routes)

Phase 2: High-Scale Supabase Auth & Multi-Tenant Middleware (NEXT)
   ├── Install @supabase/ssr
   ├── Configure src/lib/supabase/server.ts and client.ts
   └── Add Next.js Edge Middleware for organization & kitchen tenant routing

Phase 3: Connection Pooler & Realtime WebSocket Subscriptions
   ├── Wire PgBouncer connection strings (:6543)
   ├── Add useKdsRealtime hook with kitchen_id scoped channels
   └── Verify real-time order ticket popping on KDS screens

Phase 4: Stripe Billing & Subscription Entitlements
   ├── Multi-tier plan gating (Free 1 kitchen vs Pro Unlimited brands)
   ├── Stripe Customer Portal & Checkout Server Actions
   └── Webhook processor with idempotency verification

Phase 5: Load Testing & Performance Hardening
   ├── Run k6 / Artillery benchmark simulating 1,000 concurrent orders/min
   └── Verify sub-100ms response times and zero deadlocks
```
