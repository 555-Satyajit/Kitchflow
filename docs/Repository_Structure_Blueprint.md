# Cloud Kitchen OS — Repository & Monorepo Architecture Blueprint
**Version:** 1.0  
**Date:** October 17, 2026  
**Status:** Architecture Proposal  

---

## 1. Repository Strategy: Single Monorepo (pnpm Workspaces)

For a real-time, multi-surface operational platform like Cloud Kitchen OS, a **pnpm workspaces monorepo** provides clean modular separation while allowing shared schemas, types, and database contracts between the web apps and backend logic.

---

## 2. Directory Structure Blueprint

```text
Kitchenos/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # Lint, type-check, test on PR
│   │   └── deploy.yml                 # Vercel / Supabase automated deployments
│   └── pull_request_template.md
│
├── apps/
│   └── web/                           # Next.js 15 (App Router) Super Mobile-First App
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/            # Auth routes: login, pin-code, switch role
│       │   │   │   └── login/
│       │   │   ├── (dashboard)/       # Main App Layout (Mobile Shell + Bottom Nav)
│       │   │   │   ├── layout.tsx     # Super mobile-first shell (top bar, bottom nav)
│       │   │   │   ├── page.tsx       # Live Orders Queue (Aggregator feed)
│       │   │   │   ├── kds/           # Kitchen Display System (Grill, Fry, Assembly)
│       │   │   │   ├── packing/       # Packing Checklist Station
│       │   │   │   ├── delivery/      # In-house Direct Rider Dispatch & Routing
│       │   │   │   ├── pos/           # Fast Walk-in & Phone Order Register
│       │   │   │   ├── inventory/     # Stock, Ingredients & Auto-86 Controls
│       │   │   │   ├── menu/          # Multi-brand menu & Recipe BOM builder
│       │   │   │   └── margins/       # True Margin & P&L analytics
│       │   │   └── api/               # Backend API & Webhook handlers
│       │   │       ├── webhooks/      # Swiggy & Zomato order ingestion webhooks
│       │   │       ├── emergency/     # "Pause All Platforms" trigger
│       │   │       └── inventory/     # Deductions & stock ledger sync
│       │   │
│       │   ├── components/            # UI Component Library (shadcn/ui + custom)
│       │   │   ├── ui/                # Base shadcn primitives (Button, Card, Dialog, Sheet, Badge...)
│       │   │   ├── mobile/            # Mobile-specific layout components (BottomNav, TouchDrawer, Swiper)
│       │   │   ├── orders/            # OrderCard, LiveQueue, MarginBreakdownSheet
│       │   │   ├── kds/               # KDSStationTicket, CountdownTimer, BatchList
│       │   │   └── packing/           # PackingChecklist, TamperSealButton
│       │   │
│       │   ├── hooks/                 # Custom reactive hooks
│       │   │   ├── use-orders-feed.ts # Supabase Realtime order streaming hook
│       │   │   ├── use-kds-timer.ts   # SLA countdown & chromatic status hook
│       │   │   └── use-audio-alert.ts # Escalating chime for new unacknowledged orders
│       │   │
│       │   ├── lib/                   # Utility libraries & clients
│       │   │   ├── supabase/          # Supabase client (browser, server, middleware)
│       │   │   ├── audio.ts           # Web Audio API alert generator
│       │   │   └── utils.ts           # cn() class helper, currency formatters
│       │   │
│       │   └── styles/
│       │       └── globals.css        # Tailwind theme, kitchen contrast tokens, safe-area padding
│       │
│       ├── public/
│       │   ├── audio/                 # High-priority kitchen alert chimes
│       │   ├── icons/                 # PWA icons & station badges
│       │   └── manifest.json          # Mobile PWA manifest
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.ts
│
├── packages/                          # Shared Packages (DRY across potential future workers)
│   ├── database/                      # Supabase Database Models & Migrations
│   │   ├── migrations/                # SQL schema migrations (tenancy, ledger, BOM)
│   │   ├── seed.sql                   # Sample kitchen data (Biryani Central, Burger Box, etc.)
│   │   └── schema.sql                 # Complete reference DDL
│   │
│   ├── types/                         # Shared TypeScript definitions
│   │   ├── order.ts                   # Canonical Order, Item, Modifier schemas
│   │   ├── inventory.ts               # Ingredient, Recipe BOM, Ledger types
│   │   └── margin.ts                  # Cost breakdown & profit calculations
│   │
│   └── config/                        # Shared ESLint, Prettier, TypeScript configs
│
├── docs/                              # Project Documentation
│   ├── PRD.docx                       # Original PRD
│   ├── Architecture.md                # System diagrams & data flows
│   └── API_Specification.md           # Normalized webhook contracts
│
├── .gitignore
├── .env.example
├── pnpm-workspace.yaml                # pnpm workspace definition
└── package.json                       # Monorepo root
```

---

## 3. Two Proposed Repository Layouts

### Option A: Standard Full-Stack Next.js Project (Fastest, Leanest)
* Single root `package.json` with Next.js App Router in `src/`.
* Supabase schemas in `supabase/migrations/`.
* Zero monorepo orchestration overhead, best for immediate prototyping and rapid MVP delivery.

### Option B: Monorepo with `pnpm workspaces` (Most Scalable, Modular)
* Root `pnpm-workspace.yaml` containing `apps/web` and `packages/types`, `packages/database`.
* Allows cleanly separating database migrations and shared type packages from UI code.

---

## 4. GitHub Workflow Strategy
* **`main`**: Production-ready, auto-deployed to Vercel/Supabase staging.
* **`develop`**: Active integration branch.
* **Branch naming**: `feat/kds-screen`, `feat/order-ingestion`, `feat/supabase-schema`.
