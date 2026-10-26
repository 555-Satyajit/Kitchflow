# KitchenOS Refactoring Directory & Data Location Guide

This guide explains **every refactored feature**, **why it was refactored**, and **exactly which file contains what data and logic**.

---

## 1. Core Architecture Pattern

Every refactored domain in KitchenOS follows the same 5-part feature-sliced pattern:

| File Pattern | What Data & Logic Lives Here | Execution Environment |
| :--- | :--- | :--- |
| `<domain>-cache.ts` | Pure cache keys and tag strings used by `revalidateTag` | Universal (Client & Server) |
| `<domain>-queries.ts` | Database queries, Prisma reads, and offline mock fallbacks | Server-only (`import 'server-only'`) |
| `<domain>-actions.ts` | Server Actions (mutations, DB writes, stock deductions) | Server-only (`'use server'`) |
| `components/<domain>-section.tsx` | **Async Server Component** (awaits query) + **Sibling Skeleton** (at bottom) | Server-only |
| `components/<domain>-section-client.tsx` | Interactive UI leaves, state, modals, and user event handlers | Client-only (`'use client'`) |
| `app/<domain>/page.tsx` | Pure synchronous composition page with `<Suspense fallback={<*Skeleton />}>` | Server-rendered Page |

---

## 2. Complete File-by-File Data Directory

### 2.1 Inventory Domain (`src/features/inventory/`)

Manages raw materials, reorder levels, purchase orders, and the immutable stock ledger.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/features/inventory/inventory-cache.ts`](file:///c:/projects/Kitchenos/src/features/inventory/inventory-cache.ts) | Cache tags: `inventory`, `inventory:${kitchenId}`, `inventory:${kitchenId}:ledger`, `inventory:${kitchenId}:purchase-orders`. |
| [`src/features/inventory/inventory-queries.ts`](file:///c:/projects/Kitchenos/src/features/inventory/inventory-queries.ts) | **Reads**: `getInventoryData(kitchenId)`. Fetches `ingredients`, `menuItems`, `brands`, `stockLedgerEntry`, and `purchaseOrders`. Falls back to seed data if PostgreSQL is not connected. |
| [`src/features/inventory/inventory-actions.ts`](file:///c:/projects/Kitchenos/src/features/inventory/inventory-actions.ts) | **Writes**: `adjustStockAction` (atomic stock adjustment + ledger entry), `toggleMenuItemPlatformAction` (Swiggy/Zomato online toggles). |
| [`src/features/inventory/components/inventory-section.tsx`](file:///c:/projects/Kitchenos/src/features/inventory/components/inventory-section.tsx) | **RSC**: `<InventorySection />` (awaits `getInventoryData`).<br>**Skeleton**: `<InventorySectionSkeleton />` (at bottom, shadcn skeleton with header, KPI cards, and table rows). |
| [`src/features/inventory/components/inventory-section-client.tsx`](file:///c:/projects/Kitchenos/src/features/inventory/components/inventory-section-client.tsx) | **Interactive UI**: Role guard (cook restricted view), inventory table search/filter, wastage modal triggers, purchase order modal triggers. |
| [`src/app/inventory/page.tsx`](file:///c:/projects/Kitchenos/src/app/inventory/page.tsx) | **Route Page**: Synchronous page wrapping `<InventorySection />` in `<Suspense fallback={<InventorySectionSkeleton />}>`. |

---

### 2.2 KDS Domain (Kitchen Display System) (`src/features/kds/`)

Manages real-time cook stations, order preparation SLAs, station item tickets, and order readiness.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/features/kds/kds-cache.ts`](file:///c:/projects/Kitchenos/src/features/kds/kds-cache.ts) | Cache tags: `kds`, `kds:${kitchenId}`, `kds:${kitchenId}:orders`, `kds:${kitchenId}:station:${station}`. |
| [`src/features/kds/kds-queries.ts`](file:///c:/projects/Kitchenos/src/features/kds/kds-queries.ts) | **Reads**: `getKdsOrders(kitchenId)`. Fetches live active orders (`RECEIVED`, `ACCEPTED`, `PREPARING`) with items, brand colors, and stations. |
| [`src/features/kds/kds-actions.ts`](file:///c:/projects/Kitchenos/src/features/kds/kds-actions.ts) | **Writes**: `toggleStationItemAction` (marks item completed at station line), `markOrderReadyAction` (advances order to `READY` status). |
| [`src/features/kds/components/kds-section.tsx`](file:///c:/projects/Kitchenos/src/features/kds/components/kds-section.tsx) | **RSC**: `<KdsSection />` (awaits `getKdsOrders`).<br>**Skeleton**: `<KdsSectionSkeleton />` (at bottom, renders station pills and live ticket cards). |
| [`src/features/kds/components/kds-section-client.tsx`](file:///c:/projects/Kitchenos/src/features/kds/components/kds-section-client.tsx) | **Interactive UI**: Station selector tab (`GRILL`, `FRY`, `DUM_BIRYANI`, etc.), 1-second live SLA ticker, Web Audio sound chimes for overdue tickets. |
| [`src/app/kds/page.tsx`](file:///c:/projects/Kitchenos/src/app/kds/page.tsx) | **Route Page**: Synchronous page wrapping `<KdsSection />` in `<Suspense fallback={<KdsSectionSkeleton />}>`. |

---

### 2.3 Orders & POS Domain (`src/features/orders/`)

Manages order queue feeds, manual billing, POS table tokens, customer lookup, and order status transitions.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/features/orders/order-cache.ts`](file:///c:/projects/Kitchenos/src/features/orders/order-cache.ts) | Cache tags: `orders`, `orders:${kitchenId}`, `orders:${kitchenId}:feed`, `orders:detail:${orderId}`. |
| [`src/features/orders/order-queries.ts`](file:///c:/projects/Kitchenos/src/features/orders/order-queries.ts) | **Reads**: `getOrdersData(kitchenId)`. Fetches complete historical orders, customer records, brands, and menu items. |
| [`src/features/orders/order-actions.ts`](file:///c:/projects/Kitchenos/src/features/orders/order-actions.ts) | **Writes**: `updateOrderStatusAction` (updates order lifecycle), `createManualOrderAction` (creates manual POS orders with tax/margin calculations). |
| [`src/features/orders/components/orders-section.tsx`](file:///c:/projects/Kitchenos/src/features/orders/components/orders-section.tsx) | **RSC**: `<OrdersSection />` (awaits `getOrdersData`).<br>**Skeleton**: `<OrdersSectionSkeleton />` (at bottom, renders KPI revenue bar and order feed list). |
| [`src/features/orders/components/orders-section-client.tsx`](file:///c:/projects/Kitchenos/src/features/orders/components/orders-section-client.tsx) | **Interactive UI**: Order queue filters, manual order modal triggers, margin modal inspector, and cook station access guard. |
| [`src/app/orders/page.tsx`](file:///c:/projects/Kitchenos/src/app/orders/page.tsx) | **Route Page**: Synchronous page wrapping `<OrdersSection />` in `<Suspense fallback={<OrdersSectionSkeleton />}>`. |
| [`src/app/pos/page.tsx`](file:///c:/projects/Kitchenos/src/app/pos/page.tsx) | **POS Counter Page**: Fast walk-in/delivery register, customer phone auto-lookup, cash tender calculator, and WhatsApp receipt generator. |

---

### 2.4 Margins & P&L Domain (`src/features/margins/`)

Manages food cost percentages, aggregator commissions, unit economics, and profit & loss analysis.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/features/margins/margins-cache.ts`](file:///c:/projects/Kitchenos/src/features/margins/margins-cache.ts) | Cache tags: `margins`, `margins:${kitchenId}`. |
| [`src/features/margins/margins-queries.ts`](file:///c:/projects/Kitchenos/src/features/margins/margins-queries.ts) | **Reads**: `getMarginsOrders(kitchenId)`. Fetches financial breakdown metrics: `grossAmount`, `discount`, `commissionAmount`, `ingredientCost`, `packagingCost`, `netMargin`. |
| [`src/features/margins/components/margins-section.tsx`](file:///c:/projects/Kitchenos/src/features/margins/components/margins-section.tsx) | **RSC**: `<MarginsSection />` (awaits `getMarginsOrders`).<br>**Skeleton**: `<MarginsSectionSkeleton />` (at bottom, renders P&L metric cards and channel breakdown rows). |
| [`src/features/margins/components/margins-section-client.tsx`](file:///c:/projects/Kitchenos/src/features/margins/components/margins-section-client.tsx) | **Interactive UI**: Unit economics charts, commission rate sliders, store P&L inspection, and Line Cook security lock screen. |
| [`src/app/margins/page.tsx`](file:///c:/projects/Kitchenos/src/app/margins/page.tsx) | **Route Page**: Synchronous page wrapping `<MarginsSection />` in `<Suspense fallback={<MarginsSectionSkeleton />}>`. |

---

### 2.5 Packing & Dispatch QA Domain (`src/features/packing/`)

Manages final assembly packaging checks before handover to delivery riders.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/features/packing/packing-cache.ts`](file:///c:/projects/Kitchenos/src/features/packing/packing-cache.ts) | Cache tags: `packing`, `packing:${kitchenId}`. |
| [`src/features/packing/packing-queries.ts`](file:///c:/projects/Kitchenos/src/features/packing/packing-queries.ts) | **Reads**: `getPackingOrders(kitchenId)`. Fetches orders currently in `PREPARING` and `READY` status needing packaging verification. |
| [`src/features/packing/packing-actions.ts`](file:///c:/projects/Kitchenos/src/features/packing/packing-actions.ts) | **Writes**: `toggleChecklistItemAction` (toggles cold beverage separation, cutlery, tamper seal), `completePackingAction` (marks order as `DISPATCHED`). |
| [`src/features/packing/components/packing-section.tsx`](file:///c:/projects/Kitchenos/src/features/packing/components/packing-section.tsx) | **RSC**: `<PackingSection />` (awaits `getPackingOrders`).<br>**Skeleton**: `<PackingSectionSkeleton />` (at bottom, renders order cards with checklist checkboxes). |
| [`src/features/packing/components/packing-section-client.tsx`](file:///c:/projects/Kitchenos/src/features/packing/components/packing-section-client.tsx) | **Interactive UI**: Dynamic checklist verification tailored to dish items (e.g. chaas triggers beverage separation; biryani triggers spoon & raita checks). |
| [`src/app/packing/page.tsx`](file:///c:/projects/Kitchenos/src/app/packing/page.tsx) | **Route Page**: Synchronous page wrapping `<PackingSection />` in `<Suspense fallback={<PackingSectionSkeleton />}>`. |

### 2.6 In-House Delivery Domain (`src/features/delivery/`)

Manages self-delivered customer orders, rider assignments, customer addresses, phone calls, and delivered acknowledgments.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/features/delivery/delivery-cache.ts`](file:///c:/projects/Kitchenos/src/features/delivery/delivery-cache.ts) | Cache tags: `delivery`, `delivery:${kitchenId}`. |
| [`src/features/delivery/delivery-queries.ts`](file:///c:/projects/Kitchenos/src/features/delivery/delivery-queries.ts) | **Reads**: `getDeliveryOrders(kitchenId)`. Filters strictly to `channel: 'DIRECT'` orders to prevent aggregator riders (Swiggy/Zomato) from mixing with in-house runner queues. |
| [`src/features/delivery/components/delivery-section.tsx`](file:///c:/projects/Kitchenos/src/features/delivery/components/delivery-section.tsx) | **RSC**: `<DeliverySection />` (awaits `getDeliveryOrders`).<br>**Skeleton**: `<DeliverySectionSkeleton />` (at bottom, renders rider status tabs, delivery order cards, and action buttons). |
| [`src/features/delivery/components/delivery-portal-client.tsx`](file:///c:/projects/Kitchenos/src/features/delivery/components/delivery-portal-client.tsx) | **Interactive UI**: Status tabs (`PENDING`, `DISPATCHED`, `ALL`), search by customer name/phone/address, quick phone call button (`tel:`), Google Maps routing link (`https://maps.google.com/?q=`), and delivery confirmation dialog. |
| [`src/app/delivery/page.tsx`](file:///c:/projects/Kitchenos/src/app/delivery/page.tsx) | **Route Page**: Synchronous page wrapping `<DeliverySection />` in `<Suspense fallback={<DeliverySectionSkeleton />}>`. |

---

### 2.7 Global Layout & High-Availability Navigation Architecture (`src/context/`, `src/components/mobile/`)

Manages high-availability real-time sync for navigation badges, emergency pauses, and cross-station data consistency across mobile and desktop.

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`src/context/KitchenContext.tsx`](file:///c:/projects/Kitchenos/src/context/KitchenContext.tsx) | **Global Provider**: State management with `orders: []` (empty array initialization to prevent mock data flashing), `isOrdersLoaded`, `navCounts`, and `refreshNavCounts`. Integrated with **4-Axis Reconnection Hook** (`useRealtimeReconnection`) on channel `'kitchen-global-nav'` with a **25,000ms** heartbeat recovery thread for network failover and tablet screen wake. |
| [`src/features/orders/order-actions.ts`](file:///c:/projects/Kitchenos/src/features/orders/order-actions.ts) | **`getNavCountsAction(kitchenId)`**: Direct PostgreSQL query using `prisma.order.count()` returning authoritative counts for Live Queue, KDS Cook, and Packing Dispatch. |
| [`src/components/mobile/AppHeader.tsx`](file:///c:/projects/Kitchenos/src/components/mobile/AppHeader.tsx) | **Desktop & Tablet Navigation**: Dual-source count evaluation (derives dynamic filtered counts if page orders exist, otherwise authoritative PostgreSQL `navCounts`). Guarded by `mounted` state to prevent SSR/client hydration mismatches. Renders animated skeleton pills while syncing. |
| [`src/components/mobile/NavigationBar.tsx`](file:///c:/projects/Kitchenos/src/components/mobile/NavigationBar.tsx) | **Mobile Bottom Navigation**: Bottom tab bar (`Live Queue`, `KDS Cook`, `Dispatch`, `Inventory`, `Margins`) with dual-source count evaluation, skeleton pulse pills, and zero-hydration-mismatch `mounted` guard. |

---

## 3. Database & Schema Files

| File Path | What You Will Find In This File |
| :--- | :--- |
| [`prisma/schema.prisma`](file:///c:/projects/Kitchenos/prisma/schema.prisma) | The complete Prisma schema matching all frontend features (Organizations, Kitchens, Brands, Ingredients, MenuItems, Recipes, Orders, OrderItems, StockLedgerEntry, PurchaseOrders, PurchaseOrderItems). |
| [`supabase/migrations/20261025170000_multi_tenant_saas_schema.sql`](file:///c:/projects/Kitchenos/supabase/migrations/20261025170000_multi_tenant_saas_schema.sql) | SQL migration: Creates organizations, RBAC memberships, purchase orders, foreign key B-tree indexes, and fast cached RLS policies. |
| [`supabase/migrations/20261025173000_complete_frontend_sync.sql`](file:///c:/projects/Kitchenos/supabase/migrations/20261025173000_complete_frontend_sync.sql) | SQL migration: Synchronizes all 10 kitchen stations, inventory categories, storage zones, stock reason codes, and order financial columns. |

