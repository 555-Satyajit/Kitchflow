# KitchenOS — Cloud Kitchen Operating System

A real-time, super mobile-first operating system for multi-brand cloud kitchens in India. It handles cross-platform aggregator ingestion (Swiggy/Zomato), station-based Kitchen Display Systems (KDS), automated recipe-level inventory deductions (BOM & Auto-86), and true-margin unit economics.

---

## 📁 Project Architecture & Directory Layout

```text
Kitchenos/
├── docs/                             # Product documentation, PRDs, and architecture blueprints
│   ├── Cloud Kitchen OS — Product Requirements Document (PRD).docx
│   ├── Cloud_Kitchen_OS_Master_Plan.md
│   ├── Antigravity_Agent_PRD.md
│   └── Repository_Structure_Blueprint.md
│
├── prisma/
│   └── schema.prisma                 # Database models (Multi-brand, Recipes, BOM, Orders, StockLedger)
│
├── supabase/
│   └── migrations/                   # Supabase PostgreSQL DDL migrations & realtime publications
│
├── public/                           # Static assets, audio chimes, PWA manifests
│
├── src/
│   ├── app/                          # Next.js App Router (Pages & API Route Handlers)
│   │   ├── api/                      # REST & Webhook API Endpoints (Backend Layer 1)
│   │   │   ├── webhooks/
│   │   │   │   ├── swiggy/route.ts   # Ingest Swiggy partner webhook orders
│   │   │   │   └── zomato/route.ts   # Ingest Zomato partner webhook orders
│   │   │   ├── orders/
│   │   │   │   └── route.ts          # GET/POST orders endpoint
│   │   │   └── emergency/
│   │   │       └── route.ts          # Emergency "Pause All Platforms" trigger
│   │   ├── globals.css               # Kitchen dark theme, high contrast, oversized touch targets
│   │   ├── layout.tsx                # App root layout with viewport metadata
│   │   └── page.tsx                  # Super mobile-first single-page shell
│   │
│   ├── components/                   # UI Presentation Components (Mobile & Station Views)
│   │   ├── mobile/
│   │   │   ├── BottomNav.tsx         # Bottom navigation bar with live status badges
│   │   │   └── TopHeader.tsx         # Top bar with Emergency Pause-All button
│   │   ├── orders/
│   │   │   └── OrdersQueueView.tsx   # Live order queue feed
│   │   ├── kds/
│   │   │   └── KDSView.tsx           # Station KDS (Grill, Fry, Assembly) & bulk batching
│   │   ├── packing/
│   │   │   └── PackingView.tsx       # Tamper seal and packaging verification checklist
│   │   ├── inventory/
│   │   │   └── InventoryView.tsx     # Stockroom adjustments & Auto-86 availability toggles
│   │   └── margins/
│   │       ├── MarginsView.tsx       # Shift P&L and cost breakdown distribution
│   │       └── MarginModal.tsx       # Detailed per-order unit economics drawer
│   │
│   ├── server/                       # Backend Business Logic & Server Actions
│   │   ├── actions/                  # Next.js Server Actions (Mutations called directly by UI)
│   │   │   ├── orders.ts             # Status transitions, station completions
│   │   │   └── inventory.ts          # Manual adjustments, wastage logging
│   │   └── services/                 # Reusable Core Business Services
│   │       ├── order.service.ts      # Canonical order ingestion & state machine
│   │       ├── inventory.service.ts  # Recipe BOM consumption & Auto-86 triggers
│   │       └── margin.service.ts     # Point-in-time true margin calculations
│   │
│   ├── lib/                          # Shared Singletons & Utilities
│   │   ├── prisma.ts                 # Prisma Client singleton
│   │   ├── supabase.ts               # Supabase Client configuration
│   │   ├── utils.ts                  # Currency formatters, cn() tailwind merger
│   │   └── mockData.ts               # Seed data for local offline development
│   │
│   └── types/                        # Core TypeScript Interfaces
│       └── index.ts                  # Orders, Brands, Stations, Ingredients, BOM
│
├── .env.example                      # Environment variables template
├── package.json                      # Next.js 16 + React 19 + Prisma + Supabase
├── pnpm-lock.yaml                    # Deterministic lockfile
└── tsconfig.json                     # Strict TypeScript configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js $\ge 20$ (Recommended: Node 22+)
* `pnpm` $\ge 10$

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your database and Supabase keys:
```bash
cp .env.example .env.local
```

### 4. Database Setup (Prisma)
Generate the Prisma client:
```bash
pnpm exec prisma generate
```
Push the schema to your PostgreSQL / Supabase database:
```bash
pnpm exec prisma db push
```

### 5. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) on your mobile browser or desktop.
