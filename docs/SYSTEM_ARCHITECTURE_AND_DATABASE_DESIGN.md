# KitchenOS: System Architecture, Database Design & AI Implementation Guide

This document captures the end-to-end technical blueprint of KitchenOS, directly synthesizing the production architecture with the **Engineering Concepts Matrix** (`docs/kitchenos_engineering_concepts.xlsx`).

---

## 1. High-Level Architectural Topology

KitchenOS operates as a **Multi-Brand Cloud Kitchen Operating System** designed for ultra-low latency order throughput ($0\text{ ms}$ optimistic punch), offline station continuity, and automated culinary intelligence.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EDGE / CLIENT DEVICES                           │
│  [ POS Register ]       [ KDS Kitchen Line ]     [ Dispatch Window ]   │
│  - Zustand Local Store   - Station Multi-view    - QR/Thermal Print    │
│  - IndexedDB Outbox      - 0ms Optimistic Bump   - QA Checklist        │
│  - Web Audio Chimes      - 25s Recall Buffer     - Rider Handover      │
└───────────────┬───────────────────▲─────────────────────▲──────────────┘
                │                   │                     │
          0ms Punch (IDB)    WebSocket Event       WebSocket Event
                │                   │                     │
                ▼                   │                     │
┌───────────────────────────────────┴─────────────────────┴──────────────┐
│                    NEXT.JS 16 APPS & API LAYER                         │
│  - React Server Components (RSC) + Server Actions                      │
│  - Local-First Outbox Synchronization (`useOutboxSync`)                │
│  - Multi-tenant RBAC Session Engine (HMAC Station PIN & Supabase Auth) │
│  - Route-level Dynamic Revalidation (`revalidatePath` / `revalidateTag`)│
└───────────────────────────────┬────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌────────────────────────────────┐
│   SUPABASE & POSTGRESQL DB    │       │    AI / INTELLIGENCE ENGINE    │
│  - Multi-Tenant RLS           │       │  - Google Gemini Flash         │
│  - ACID Transactions          │◄─────►│  - Indian Culinary Rule Engine │
│  - Append-Only Stock Ledger   │       │  - Zero-Shot Portioned Recipe  │
│  - Realtime Changefeed (WAL)  │       │    BOM & Cost Estimation       │
└───────────────────────────────┘       └────────────────────────────────┘
```

---

## 2. Database Schema & Data Integrity Design

The database schema (`prisma/schema.prisma`) implements the key correctness principles outlined in the engineering concepts matrix:

### 2.1 Multi-Tenant Hierarchy
```
Organization (SaaS Tenant Root)
  └── OrganizationMember (RBAC: owner | manager | kitchen_staff)
        └── Kitchen (Physical Facility / Cloud Hub)
              ├── Brand (Virtual Brands: e.g. Beheroz, Wendy's, Oven Story)
              │     └── MenuItem (Dishes, Retail Price, Packaging Cost)
              │           └── RecipeIngredient (BOM links to raw SKUs)
              ├── Ingredient (Raw Stockroom SKUs, Thresholds, Storage Zones)
              │     └── StockLedgerEntry (Append-only audit trail)
              ├── Order (Customer, Channels: WALK_IN | DIRECT | SWIGGY | ZOMATO)
              │     └── OrderItem (Dish snapshot, kitchen station, modifier choices)
              └── PurchaseOrder (Supplier POs, Inflow Reconciliations)
```

### 2.2 Core Concepts Applied in Database

| Concept from Matrix | Database Implementation | File / Table Reference |
| :--- | :--- | :--- |
| **ACID Transactions** | Order punch + async BOM stock deductions execute within transactional boundaries (`prisma.$transaction`). | `order-actions.ts`, `inventory-actions.ts` |
| **Event Sourcing / Append-Only Ledger** | Stock is never just mutated in-place; every inflow, wastage, or recipe consumption records a `StockLedgerEntry` with `previousStock`, `delta`, and `balanceAfter`. | `model StockLedgerEntry` |
| **Idempotency** | Orders generated at the edge carry deterministic outbox IDs (`ord-pos-<timestamp>`), preventing duplicate order creation on network retries. | `offline-edge-store.ts`, `order-actions.ts` |
| **State Machine** | Order status strictly advances across: `RECEIVED` $\to$ `ACCEPTED` $\to$ `PREPARING` $\to$ `READY` $\to$ `DISPATCHED`. | `enum OrderStatus` |
| **RBAC & Security** | Roles (`owner`, `manager`, `kitchen_staff`) with granular permission arrays (`orders`, `pos`, `kds`, `packing`, `inventory`, `margins`, `settings`). Station PINs encrypted with AES-256. | `OrganizationMember`, `src/lib/auth/crypto.ts` |
| **Auto-86 Throttling** | When any ingredient dips below its `minThreshold` or cannot satisfy 1 portion's BOM, the system atomically flips `isAvailable = false` and delists from Swiggy/Zomato. | `adjustStockAction` in `inventory-actions.ts` |

---

## 3. The 0ms Single Source of Truth Pipeline

### 3.1 The Problem It Solved
In standard web architectures, the POS waits for database network calls, recipe calculations, and platform updates before printing a bill ($5\text{--}33\text{ seconds}$). Furthermore, multi-screen polling creates desynchronized ticket counts ($1 \to 0 \to 1$).

### 3.2 The Petpooja-Style Two-Phase Resolution
1. **Phase 1: Local-First Ingest (0ms)**
   - Cashier clicks **"Punch Order"**.
   - Immediate sequential token generated locally via IndexedDB (`DIR-001`, `DIR-002`).
   - Order stored in browser IndexedDB `outbox_orders` (`offline-edge-store.ts`).
   - Unified Zustand store (`useKitchenPipelineStore.ts`) adds the order in an $O(1)$ dictionary map.
   - Cash drawer kicks, thermal receipt prints, audio chime dings immediately with **zero network wait**.

2. **Phase 2: Decoupled Background Persistence & Broadcast**
   - Background worker invokes `createManualOrderAction`.
   - The primary order record and line items persist to PostgreSQL.
   - **BOM Inventory Loop Decoupled**: Ingredient deductions and stock ledger writes execute asynchronously in background tasks.
   - Supabase Realtime emits WebSocket broadcasts to kitchen line tablets (`KDS`) and packaging dispatch stations.
   - If offline, `useOutboxSync` holds the order in the outbox and auto-flushes it once connection is restored.

3. **0ms KDS Bump & Recall Buffer**
   - Kitchen staff taps **"Done"**: Ticket instantly vanishes from the screen with $0\text{ ms}$ delay.
   - Ticket enters a **25-second Recall Buffer**: If accidentally bumped during rush, cook taps **"Recall Last"** to bring the ticket back without supervisor override.

---

## 4. Artificial Intelligence Implementation (Smart Recipe AI & BOM Engine)

KitchenOS features a two-tiered hybrid culinary AI engine located in:
- [`src/lib/geminiDishGenerator.ts`](file:///c:/projects/Kitchenos/src/lib/geminiDishGenerator.ts)
- [`src/lib/aiBOMEstimator.ts`](file:///c:/projects/Kitchenos/src/lib/aiBOMEstimator.ts)

```
                       [ New Dish Input / Voice Prompt ]
                                      │
                                      ▼
                        API Key & Connectivity Check?
                               ┌──────┴──────┐
                       Yes     │             │    No / Offline
                               ▼             ▼
             [ Google Gemini Flash ]     [ Local Indian Culinary Rule Engine ]
             - Model Cascade Strategy    - 50+ Regional Heuristics
             - Grounded in Stockroom     - Fallback portions & stations
             - SKU Deduplication         - Instant 0ms response
                               │             │
                               └──────┬──────┘
                                      ▼
             [ Structured Commercial Bill of Materials (BOM) ]
             ├─ Exact Gram / Milliliter Portions per Dish
             ├─ Automated Cooking Station Assignment (GRILL, FRY, WOK, etc.)
             ├─ Packaging Cost Estimation (Containers, Cutlery, Carry Bags)
             ├─ Recommended Retail Price & Gross Margin Percentage
             └─ Direct Match & Link to Existing Stockroom Inventory IDs
```

### 4.1 Tier 1: Google Gemini Flash Engine (`geminiDishGenerator.ts`)
- **Model Cascade**: Evaluates requests using `gemini-flash-latest`, `gemini-2.5-flash-lite`, and `gemini-3.5-flash`.
- **Context-Grounded Stockroom Deduplication**:
  - Injects current stockroom raw materials into the LLM prompt.
  - Forces the model to reuse existing pantry items (e.g. mapping `"Butter"` to existing `"Amul Table Butter (Salted)"`), preventing duplicate SKU creation.
- **Portion & Food Cost Prediction**:
  - Calculates cost-per-portion in Indian Rupees (INR).
  - Emits secondary station routing (e.g. Primary: `GRILL`, Secondary: `ASSEMBLY`).

### 4.2 Tier 2: Local Rule Engine Fallback (`aiBOMEstimator.ts`)
- Operates 100% offline or when no Gemini API key is configured.
- Contains pre-trained culinary BOM heuristics for North Indian, Biryani, Indo-Chinese, Burgers, Pizzas, Sandwiches, and Desserts.
- Ensures the application never crashes or halts dish creation during network dropouts.

### 4.3 Voice-to-Dish Ingestion
- Integrated HTML5 Speech Recognition API inside [`AddMenuItemModal.tsx`](file:///c:/projects/Kitchenos/src/components/inventory/modals/AddMenuItemModal.tsx).
- Kitchen managers can speak dish names in Hinglish/English (e.g. *"Paneer Tikka Sandwich with Extra Mozzarella"*), triggering auto-BOM generation hands-free.

---

## 5. Multi-Outlet Tenant Isolation & Cache Synchronization

To guarantee that dishes, orders, and inventory are never leaked or accidentally hidden across physical hubs:
1. **Brand-to-Outlet Scoping**:
   - Every `Brand` and `Ingredient` belongs strictly to a physical `kitchenId`.
   - Modals and POS interfaces enforce that all added dishes are mapped to a brand belonging to the active outlet session (`kitchflow_active_kitchen_id`).
2. **Next.js Router Cache Invalidation**:
   - Updates trigger dual revalidations:
     - Tag-based: `revalidateTag(inventoryTags.kitchen(kitchenId))`
     - Path-based: `revalidatePath('/inventory')` and `revalidatePath('/pos')`
   - Client components automatically reconcile temporary client-generated IDs (`m-...`) with the persisted database UUIDs returned by server actions.

---

## 6. Summary of Engineering Matrix Alignment

| Concept | Status in KitchenOS | Architectural Role |
| :--- | :--- | :--- |
| **Offline-first / local sync** | **Implemented** | IndexedDB edge store, local token sequencing, outbox queue. |
| **Caching & Invalidation** | **Implemented** | Dual Next.js tag + path invalidation, optimistic local stores. |
| **Decoupled Operations** | **Implemented** | POS order punch fast-lane decoupled from slow-lane inventory BOM calculation. |
| **State Machine Discipline** | **Implemented** | Enforced order flow with 25s kitchen recall buffer. |
| **Culinary Intelligence** | **Implemented** | Hybrid Gemini Flash + deterministic offline rule engine. |
