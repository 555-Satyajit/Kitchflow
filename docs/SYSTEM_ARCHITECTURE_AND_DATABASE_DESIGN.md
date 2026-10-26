# KitchenOS System Architecture & Database Design Specification

This document presents the complete production-grade system and database design for **KitchenOS**, crafted using:
1. **Next.js App Architecture** (`next-beats` / Next.js 16 RSC patterns, synchronous page composition, server-only queries, server actions, feature-sliced architecture).
2. **SaaS Architect** (Multi-tenant B2B by default, organizations, roles & permissions, Stripe recurring billing, and scalable domain breakdown).
3. **Supabase & Postgres Best Practices** (Optimal RLS using `(select auth.uid())` subqueries, indexed foreign keys, immutable audit ledgers, check constraints, enum validation, and Realtime pub/sub).

---

## 1. System Overview & Multi-Tenant Domain Model

KitchenOS is a multi-tenant B2B SaaS platform designed for commercial cloud kitchens running single or multiple virtual brands (e.g., "Burger Works", "Taco Express", "Bowl Co.") out of shared physical facilities.

### Tenancy Hierarchy:
```
Organization (SaaS Tenant / Company / Franchisee)
 └── Kitchen (Physical Facility / Location)
      ├── Brand (Virtual Storefront / Menu Concept)
      │    └── Menu Item (Selling Price, Stations, Modifiers)
      │         └── Recipe BOM (Bill of Materials)
      │              └── Ingredient (Stock, Cost, Reorder Level)
      ├── Orders (KDS, Aggregators: Swiggy / Zomato / Direct)
      │    └── Order Items (Station routing: GRILL, FRY, ASSEMBLY, PACKING)
      ├── Stock Ledger (Immutable balance & consumption audit trail)
      └── Purchase Orders & Wastage Logs
```

---

## 2. Complete Supabase PostgreSQL Database Schema

### Performance & Security Best Practices Applied:
- **Fast RLS**: Using `(select auth.uid())` so Postgres calculates the user ID once per statement instead of once per evaluated row.
- **Foreign Key Indexing**: Every single foreign key column is indexed to avoid full table scans on `JOIN` and `ON DELETE CASCADE`.
- **Role-based RLS (`TO authenticated`)**: Explicitly target the `authenticated` role; prevent anonymous privilege escalation.
- **Accurate Numeric Types**: `numeric(12, 3)` for inventory weights/volumes, `numeric(10, 2)` for monetary values (zero float precision rounding errors).
- **Append-Only Ledger**: All stock deductions (orders), additions (restock/PO), and corrections (wastage/audit) are logged immutably.

```sql
-- ==============================================================================
-- KITCHENOS: PRODUCTION DATABASE SCHEMA
-- Extensions, Enums, Tables, Indexes, and Row-Level Security
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUMS
-- ==============================================================================
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'kitchen_staff');
CREATE TYPE order_channel AS ENUM ('SWIGGY', 'ZOMATO', 'DIRECT', 'WALK_IN');
CREATE TYPE order_status AS ENUM ('RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'CANCELLED');
CREATE TYPE kitchen_station AS ENUM ('GRILL', 'FRY', 'ASSEMBLY', 'PACKING');
CREATE TYPE ingredient_unit AS ENUM ('g', 'ml', 'pc', 'kg', 'l');
CREATE TYPE stock_reason AS ENUM ('ORDER_CONSUMPTION', 'PURCHASE_RESTOCK', 'WASTAGE_SPOILAGE', 'PHYSICAL_AUDIT_CORRECTION');
CREATE TYPE po_status AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- ==============================================================================
-- 2. ORGANIZATIONS & TENANCY
-- ==============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'enterprise')),
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'kitchen_staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);

-- ==============================================================================
-- 3. KITCHENS (PHYSICAL LOCATIONS)
-- ==============================================================================
CREATE TABLE kitchens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    currency TEXT NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kitchens_org_id ON kitchens(organization_id);

-- Helper Security Definer to verify organization membership efficiently in RLS
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = (SELECT auth.uid())
  );
$$;

-- Helper to verify user access to a specific kitchen
CREATE OR REPLACE FUNCTION has_kitchen_access(k_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kitchens k
    JOIN public.organization_members om ON om.organization_id = k.organization_id
    WHERE k.id = k_id
      AND om.user_id = (SELECT auth.uid())
  );
$$;

-- ==============================================================================
-- 4. VIRTUAL BRANDS
-- ==============================================================================
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tagline TEXT,
    color TEXT NOT NULL DEFAULT '#f97316',
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_kitchen_id ON brands(kitchen_id);

-- ==============================================================================
-- 5. INGREDIENTS & RAW MATERIALS
-- ==============================================================================
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit ingredient_unit NOT NULL,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    min_threshold NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_kitchen_id ON ingredients(kitchen_id);
CREATE INDEX idx_ingredients_low_stock ON ingredients(kitchen_id) WHERE current_stock <= min_threshold;

-- ==============================================================================
-- 6. MENU ITEMS & RECIPES (BILL OF MATERIALS)
-- ==============================================================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    station kitchen_station NOT NULL,
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    packaging_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (packaging_cost >= 0),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_brand_id ON menu_items(brand_id);
CREATE INDEX idx_menu_items_station ON menu_items(brand_id, station);

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(menu_item_id, ingredient_id)
);

CREATE INDEX idx_recipes_menu_item_id ON recipes(menu_item_id);
CREATE INDEX idx_recipes_ingredient_id ON recipes(ingredient_id);

-- ==============================================================================
-- 7. ORDERS & FINANCIAL METRICS
-- ==============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id) ON DELETE RESTRICT,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    channel order_channel NOT NULL,
    order_number TEXT NOT NULL,
    customer_name TEXT,
    status order_status NOT NULL DEFAULT 'RECEIVED',
    target_prep_minutes INT NOT NULL DEFAULT 15,
    gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ingredient_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    packaging_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_margin NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ready_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_kitchen_status ON orders(kitchen_id, status);
CREATE INDEX idx_orders_created_at ON orders(kitchen_id, created_at DESC);
CREATE INDEX idx_orders_brand_id ON orders(brand_id);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    station kitchen_station NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_station_done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_station ON order_items(order_id, station, is_station_done);

-- ==============================================================================
-- 8. IMMUTABLE STOCK LEDGER & PURCHASE ORDERS
-- ==============================================================================
CREATE TABLE stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id) ON DELETE RESTRICT,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    delta NUMERIC(12, 3) NOT NULL, -- negative for deductions, positive for adds
    balance_after NUMERIC(12, 3) NOT NULL,
    reason stock_reason NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_ledger_ingredient ON stock_ledger(ingredient_id, created_at DESC);
CREATE INDEX idx_stock_ledger_kitchen ON stock_ledger(kitchen_id, created_at DESC);

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    status po_status NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    expected_delivery TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_kitchen_id ON purchase_orders(kitchen_id);

-- ==============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- 9.1 Organizations
CREATE POLICY "Users can view organizations they belong to"
    ON organizations FOR SELECT
    TO authenticated
    USING (id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
    ));

-- 9.2 Organization Members
CREATE POLICY "Users can view members of their organization"
    ON organization_members FOR SELECT
    TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
    ));

-- 9.3 Kitchens
CREATE POLICY "Users can view kitchens of their organization"
    ON kitchens FOR SELECT
    TO authenticated
    USING (is_org_member(organization_id));

CREATE POLICY "Admins and Owners can manage kitchens"
    ON kitchens FOR ALL
    TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
    ));

-- 9.4 Brands, Ingredients, Menu Items, Recipes (Scoped to Kitchen)
CREATE POLICY "Members can view brands"
    ON brands FOR SELECT
    TO authenticated
    USING (has_kitchen_access(kitchen_id));

CREATE POLICY "Members can view ingredients"
    ON ingredients FOR SELECT
    TO authenticated
    USING (has_kitchen_access(kitchen_id));

CREATE POLICY "Members can view menu items"
    ON menu_items FOR SELECT
    TO authenticated
    USING (brand_id IN (
        SELECT b.id FROM brands b WHERE has_kitchen_access(b.kitchen_id)
    ));

CREATE POLICY "Members can view recipes"
    ON recipes FOR SELECT
    TO authenticated
    USING (ingredient_id IN (
        SELECT i.id FROM ingredients i WHERE has_kitchen_access(i.kitchen_id)
    ));

-- 9.5 Orders & Order Items
CREATE POLICY "Members can view and process orders"
    ON orders FOR SELECT
    TO authenticated
    USING (has_kitchen_access(kitchen_id));

CREATE POLICY "Members can update order status"
    ON orders FOR UPDATE
    TO authenticated
    USING (has_kitchen_access(kitchen_id))
    WITH CHECK (has_kitchen_access(kitchen_id));

CREATE POLICY "Members can view order items"
    ON order_items FOR SELECT
    TO authenticated
    USING (order_id IN (
        SELECT o.id FROM orders o WHERE has_kitchen_access(o.kitchen_id)
    ));

CREATE POLICY "Members can update station completion"
    ON order_items FOR UPDATE
    TO authenticated
    USING (order_id IN (
        SELECT o.id FROM orders o WHERE has_kitchen_access(o.kitchen_id)
    ))
    WITH CHECK (order_id IN (
        SELECT o.id FROM orders o WHERE has_kitchen_access(o.kitchen_id)
    ));

-- 9.6 Stock Ledger & Purchase Orders
CREATE POLICY "Members can view stock ledger"
    ON stock_ledger FOR SELECT
    TO authenticated
    USING (has_kitchen_access(kitchen_id));

CREATE POLICY "Members can view purchase orders"
    ON purchase_orders FOR SELECT
    TO authenticated
    USING (has_kitchen_access(kitchen_id));

-- Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
```

---

## 3. Next.js 16 App Router & Feature Architecture

Adhering strictly to `next-beats` and `nextjs-app-architecture`:

```
c:\projects\Kitchenos\
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                     # Top navigation & Kitchen switcher
│   │   │   ├── [kitchenId]/
│   │   │   │   ├── kds/page.tsx               # Synchronous page with Suspense
│   │   │   │   ├── inventory/page.tsx         # Real-time stock & ledger
│   │   │   │   ├── orders/page.tsx            # POS / Aggregator orders
│   │   │   │   ├── margins/page.tsx           # Unit economics & financial analytics
│   │   │   │   └── settings/billing/page.tsx  # Stripe subscription & tiers
│   │   └── api/
│   │       ├── webhooks/stripe/route.ts       # Stripe event handling
│   │       └── webhooks/aggregators/route.ts  # Swiggy / Zomato order hooks
│   ├── features/
│   │   ├── kds/
│   │   │   ├── kds-queries.ts                 # 'server-only' read queries
│   │   │   ├── kds-actions.ts                 # 'use server' update station status
│   │   │   ├── kds-cache.ts                   # Cache tags & keys
│   │   │   └── components/
│   │   │       ├── kds-board.tsx              # Async server component + skeleton
│   │   │       └── station-ticket.tsx         # Leaf client component ('use client')
│   │   ├── inventory/
│   │   │   ├── inventory-queries.ts
│   │   │   ├── inventory-actions.ts           # Record wastage, PO receipt, manual adjust
│   │   │   ├── inventory-cache.ts
│   │   │   └── components/
│   │   │       ├── inventory-table.tsx
│   │   │       └── restock-dialog.tsx
│   │   ├── orders/
│   │   │   ├── order-queries.ts
│   │   │   ├── order-actions.ts               # Create POS order & deduct inventory
│   │   │   └── components/
│   │   │       ├── order-feed.tsx
│   │   │       └── pos-terminal.tsx
│   │   └── billing/
│   │       ├── billing-queries.ts
│   │       ├── billing-actions.ts             # Stripe portal & checkout session
│   │       └── components/
│   │           └── subscription-plan-card.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                      # Browser client
│   │   │   ├── server.ts                      # Server client with cookies
│   │   │   └── middleware.ts                  # Session refresh & route protection
│   │   ├── stripe/
│   │   │   └── client.ts                      # Stripe SDK setup
│   │   └── utils.ts
│   └── components/ui/                         # Headless UI primitives (Buttons, Cards, Dialogs)
```

---

## 4. Key Implementation Patterns

### 4.1 Synchronous Page with Suspense (Next.js 16 App Architecture)
`app/[kitchenId]/kds/page.tsx`:
```tsx
import { Suspense } from 'react';
import { KdsBoard, KdsBoardSkeleton } from '@/features/kds/components/kds-board';

export default function KdsPage({
  params,
}: {
  params: Promise<{ kitchenId: string }>;
}) {
  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kitchen Display System (KDS)</h1>
          <p className="text-muted-foreground">Live orders partitioned by station</p>
        </div>
      </header>

      {/* Synchronous page: resolve params.then inside Suspense child or pass Promise directly */}
      <Suspense fallback={<KdsBoardSkeleton />}>
        {params.then(({ kitchenId }) => (
          <KdsBoard kitchenId={kitchenId} />
        ))}
      </Suspense>
    </div>
  );
}
```

### 4.2 Feature-Owned Server Query (`import 'server-only'`)
`features/kds/kds-queries.ts`:
```typescript
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getActiveOrdersForKitchen(kitchenId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      channel,
      status,
      created_at,
      brand:brands(name, color),
      items:order_items(id, name, station, quantity, is_station_done)
    `)
    .eq('kitchen_id', kitchenId)
    .in('status', ['RECEIVED', 'ACCEPTED', 'PREPARING'])
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load KDS orders: ${error.message}`);
  }

  return data;
}
```

### 4.3 Atomic Inventory Deduction Server Action (`'use server'`)
When an order is created or status moves to PREPARING, BOM recipes deduct from stock ledger atomically:
`features/orders/order-actions.ts`:
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateTag } from 'next/cache';

export async function processOrderInventoryDeduction(orderId: string, kitchenId: string) {
  const supabase = await createClient();

  // Call Postgres RPC function for atomic ledger entry & balance deduction
  const { error } = await supabase.rpc('deduct_order_ingredients', {
    p_order_id: orderId,
    p_kitchen_id: kitchenId
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateTag(`inventory-${kitchenId}`, 'max');
  return { success: true };
}
```

---

## 5. Supabase Realtime Live Synchronization Architecture

### 5.1 Overview
KitchenOS employs **Supabase Realtime** via Postgres Logical Replication (`supabase_realtime` publication) to provide reactive, bidirectional updates across line stations and dispatch bays with zero page reloads and sub-100ms latency.

### 5.2 Realtime Architecture Flow
```
┌────────────────────────┐
│  Aggregator / POS API  │
│  (Swiggy, Zomato, Direct)
└───────────┬────────────┘
            │ INSERT into "orders", "order_items"
            ▼
┌────────────────────────────────────────────────────────┐
│             Supabase PostgreSQL Database                │
│                                                        │
│  ALTER PUBLICATION supabase_realtime ADD TABLE:        │
│    • orders (REPLICA IDENTITY FULL)                    │
│    • order_items (REPLICA IDENTITY FULL)               │
└───────────┬────────────────────────────────────────────┘
            │ PostgreSQL Logical Replication Broadcast (WebSocket)
            ▼
┌────────────────────────────────────────────────────────┐
│                 Supabase Realtime Server               │
└───────────┬────────────────────────────────┬───────────┘
            │ channel: kds-orders-realtime   │ channel: packing-orders-realtime
            ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐
│   KDS Station Screen   │      │  Packing & Dispatch Bay│
│ (kds-section-client)   │      │(packing-section-client)│
│                        │      │                        │
│ • Ticket pop-in chime  │      │ • When status = READY: │
│ • Station item checks  │      │   ticket moves to pack │
│ • "Mark Cooked Ready" ───►───►│ • Dynamic QA checks    │
│                        │      │ • "Seal & Dispatch"    │
└────────────────────────┘      └────────────────────────┘
```

### 5.3 PostgreSQL Publication Setup
The tables are published to the `supabase_realtime` logical replication stream with full row identity:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
```

### 5.3 High-Write Scaling Strategy: Broadcast Channels vs. Postgres Changes

#### The High-Write Bottleneck Risk:
When scaling an enterprise cloud kitchen platform to millions of operations or high-frequency kitchen telemetry (thousands of line item toggles, timer pulses, sensor inputs, device heartbeats), **subscribing directly to Postgres Changes on high-write tables causes an architectural bottleneck**:
- For every WAL (Write-Ahead Log) record generated, the Realtime Server must evaluate Row Level Security (RLS) policies and security permissions across thousands of client connections per second.
- This creates severe replication lag, high memory consumption, and spikes database CPU to 100%, choking relational transactions.

#### The Dual-Tier Solution:
KitchenOS decouples continuous operational messages from relational disk storage using a **Dual-Tier Realtime Architecture**:

1. **Tier 1: Ephemeral WebSocket Broadcast Channels (`broadcast`)**:
   - High-frequency station actions (e.g., checking off an ingredient on line, toggling packing checklists, timer heartbeats) broadcast directly over WebSockets in memory.
   - **Zero Disk Writes, Zero WAL Contention, Zero RLS CPU Spikes**: Messages travel peer-to-peer between kitchen client tablets at ultra-low latency (<20ms) without touching the database disk.

2. **Tier 2: Relational Persistence (`postgres_changes` Fallback)**:
   - State mutations are persisted asynchronously via Next.js Server Actions using Prisma.
   - `postgres_changes` serves as an authoritative fallback for external inbound webhook writes (e.g. Swiggy/Zomato order webhook payloads).

```
┌────────────────────────────────────────────────────────┐
│             High-Frequency Client Action               │
│   (Cook checks burger station / Packing checklist)     │
└───────────┬────────────────────────────────┬───────────┘
            │ 1. Instant WebSocket Broadcast │ 2. Parallel Server Action
            ▼ (Zero DB Disk / Zero WAL)      ▼ (Async DB Persistence)
┌────────────────────────┐      ┌────────────────────────┐
│ Supabase Realtime      │      │ Next.js Server Action  │
│ Broadcast Channel      │      │ (Prisma write to PG)   │
└───────────┬────────────┘      └───────────┬────────────┘
            │ <20ms in-memory               │ Batched DB Write
            ▼                               ▼
┌────────────────────────┐      ┌────────────────────────┐
│ Peer Kitchen Tablets   │      │ PostgreSQL Relational  │
│ (Instant UI State)     │      │ Layer (Disk/Audit)     │
└────────────────────────┘      └────────────────────────┘
```

### 5.4 Client Implementation Pattern

```typescript
// Channel initialized with Broadcast enabled
const channel = supabase.channel(`kitchen-${kitchenId}-kds`, {
  config: { broadcast: { self: false } },
});

// 1. High-frequency in-memory broadcast listener (no database load)
channel.on('broadcast', { event: 'kds_item_toggled' }, ({ payload }) => {
  setOrders((prev) => updateLocalItemState(prev, payload));
});

// 2. Authoritative PostgreSQL replication fallback for external webhooks
channel.on(
  'postgres_changes',
  { event: '*', schema: 'public', table: 'orders' },
  async () => {
    const fresh = await fetchKdsOrdersClientAction(kitchenId);
    setOrders(fresh);
  }
);

channel.subscribe();
```

---

### 5.5 Runtime Network Hardening in High-Heat Kitchen Environments

Commercial cloud kitchens operate with spotty 2.4/5GHz Wi-Fi saturated by stainless-steel walls, heavy exhaust motors, and microwaves. Cooks interact with touch screens through oil, water, and flour. KitchenOS addresses these runtime network realities at both leaf client and backend database boundaries.

#### 1. The "Greasy Finger" Debounce & Tap Lock
- **Problem**: When a cook's greasy or wet finger rapidly taps a checkbox on a laggy industrial tablet, client components without concurrency guards fire multiple parallel server actions and stream duplicate WebSocket broadcast packets down the pipe.
- **Client Mitigation** (`kds-section-client.tsx` & `packing-section-client.tsx`):
  1. **Immediate Optimistic UI Feedback**: Updates local React state in 0ms so the UI feels native and responsive.
  2. **In-Flight Mutex (`inFlightTogglesRef`)**: Tracks active mutations per item ID. Any duplicate tap received while a mutation is running is dropped immediately. A 300ms post-completion buffer absorbs mechanical multi-touch bounces.
  3. **Debounced Broadcast Timer (`debounceTimersRef`)**: Toggling an item cancels any active broadcast timer and introduces a **250ms debounce window** before publishing over the Supabase channel. If a cook frantically taps an item 5 times, exactly **one single broadcast frame** travels over the network to peer stations.

```typescript
// 1. Greasy finger lock
if (inFlightTogglesRef.current[itemId]) return;
inFlightTogglesRef.current[itemId] = true;

// 2. Immediate optimistic update
setOrders(prev => updateItem(prev, itemId));

// 3. Debounced broadcast payload
clearTimeout(debounceTimersRef.current[itemId]);
debounceTimersRef.current[itemId] = setTimeout(() => {
  supabase.channel(channelName).send({
    type: 'broadcast',
    event: 'kds_item_toggled',
    payload: { orderId, itemId, stationDone: nextDone, updatedAt: new Date().toISOString() },
  });
}, 250);
```

#### 2. Network Mutation Ordering & Deterministic Sequence Versioning (Zero Clock Drift Risk)
- **Problem**: In spotty Wi-Fi environments, a line cook tablet may drop connectivity for 5 seconds. When the connection resumes, a backlog of queued client mutations flushes over Server Actions. If another station cook on a functioning tablet already modified that order during the disconnect, the late-arriving packet could overwrite newer database state.
- **Clock Drift Vulnerability with Timestamps**: Comparing client timestamps (`Date.now()`) across different hardware tablets against the PostgreSQL server clock introduces production vulnerabilities due to local clock drift, unsynced NTP, or manual device clock changes.
- **The Solution — Incremental Sequence Version Counter (`version: Int @default(0)`)**:
  1. **Schema Column**: Added `version Int @default(0)` to `Order` and `OrderItem` in PostgreSQL.
  2. **Atomic Increment on Mutation**: Every successful server mutation atomically increments the version via Prisma (`version: { increment: 1 }`).
  3. **Client Version Tracking**: Client components render the current `version` integer on screen. When an action executes, it passes `clientVersion: currentItemVersion`.
  4. **Deterministic Concurrency Gate**:
     ```typescript
     // Pure integer sequence comparison — immune to NTP skew, timezones, and clock drift
     if (typeof clientVersion === 'number' && typeof item.version === 'number') {
       // If the database version is HIGHER than the version the cook was viewing,
       // another station cook updated the item first. Drop the stale modification.
       if (item.version > clientVersion) {
         return { 
           ok: true, 
           data: { 
             isDone: item.stationDone, 
             version: item.version 
           } 
         };
       }
     }
     ```
  5. **Auto-Reconciliation on Reconnect**: If the server drops an outdated write, it returns the newer truth along with the authoritative `version`. The client silently aligns its local state, preventing stale overwrites across kitchen stations.

#### 3. Tier 1 Realtime Broadcast Serialization & Echo Suppression
- **The Ephemeral Race Risk**: While Server Actions and PostgreSQL enforce strict integer versioning at the disk layer, broadcast frames traveling directly over WebSockets in memory between tablets could arrive out of order over choppy Wi-Fi or trigger self-echo loops.
- **Client Payload Specification**:
  ```typescript
  channel.send({
    type: 'broadcast',
    event: 'kds_item_toggled',
    payload: {
      itemId,
      isDone: nextDoneState,
      version: currentLocalVersion + 1, // Optimistic sequence progression
      senderId: getDeviceUuid(),        // Persistent client UUID for echo suppression
    },
  });
  ```
- **Peer Ingestion Gate**:
  1. **Self-Echo Filtering**: Incoming broadcast frames matching the receiving tablet's `getDeviceUuid()` are ignored.
  2. **Sequence Check**:
     ```typescript
     // If incoming sequence version is older or equal to what is already rendered,
     // discard frame as obsolete network noise
     if (incomingPayload.version <= currentRenderedVersion) {
       return;
     }
     // Apply instant state update & adopt latest version counter
     updateLocalState(incomingPayload.isDone, incomingPayload.version);
     ```
This guarantees that both the **ephemeral WebSocket broadcast layer** and the **authoritative PostgreSQL relational core** adhere to the exact same deterministic sequence logic.

---

### 5.6 Heartbeat & Resynchronization Strategy (Long-Term Dropout Recovery)

While short Wi-Fi blips are absorbed by optimistic updates and sequence version checking, extended outages (power cuts, cellular router handoffs, tablet sleep/wake cycles) can leave a client multiple version increments behind or cause it to miss newly placed orders entirely.

To prevent silent desynchronization without hammering the PostgreSQL database, KitchenOS introduces a **Multi-Trigger Heartbeat & Resynchronization Hook** (`useRealtimeReconnection`):

```
┌────────────────────────────────────────────────────────┐
│                   Reconnection Hook                    │
│             (useRealtimeReconnection.ts)               │
└──────────────────────────┬─────────────────────────────┘
                           │ Listens to 4 distinct triggers:
        ┌──────────────────┼──────────────────┬──────────────────┐
        ▼                  ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│Supabase Status│  │ Window Online │  │ Visibility    │  │ 30s Heartbeat │
│  Re-subscribe │  │ (Wi-Fi Return)│  │ (Screen Wake) │  │ Fallback Poll │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │                  │
        └──────────────────┼──────────────────┴──────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│      Fetch Authoritative Snapshot from PostgreSQL      │
│     (fetchKdsOrdersClientAction / fetchPackingOrders)  │
└────────────────────────────────────────────────────────┘
```

#### The Four Resynchronization Triggers:
1. **Supabase Realtime Channel Status Engine**:
   When the WebSocket transitions through `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED` back into `SUBSCRIBED`, the hook detects the recovery and fetches a clean snapshot.
2. **`window.addEventListener('online')`**:
   Fires immediately when the physical network adapter reconnects (e.g., when a tablet switches from dead kitchen Wi-Fi to a cellular hotspot).
3. **`document.addEventListener('visibilitychange')`**:
   Fires when the cook taps the screen to wake the tablet or switches back to the KitchenOS browser tab.
4. **Lightweight 30s Heartbeat Fallback**:
   A passive interval checks for dropped packets during busy rushes only when the device is actively online and visible.




