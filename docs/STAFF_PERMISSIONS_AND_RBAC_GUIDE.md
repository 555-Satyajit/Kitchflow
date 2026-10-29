# KitchFlow OS — Staff Permissions & RBAC Architecture Guide

## 1. Overview & Architecture

KitchFlow is designed for multi-tenant, multi-brand cloud kitchens where multiple staff members operate on shared hardware (kitchen tablets, POS terminals, and packing displays).

To prevent cooks from seeing financial margins or cashiers from altering recipes and outlet tax settings, KitchFlow implements a **3-Tier Defense-in-Depth RBAC Model**:

```
[ Incoming Request / Browser Navigation ]
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Tier 1: Edge Middleware (src/lib/supabase/middleware.ts) │
│ - Instant route inspection at the network edge           │
│ - Reads HTTP-only `kitchflow_staff_session` cookie       │
│ - Blocks & redirects unauthorized staff before rendering │
└──────────────────────────┬───────────────────────────────┘
                           │ (Allowed)
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Tier 2: Server-Side Feature Guard (src/lib/session.ts)   │
│ - Calls `await requirePermission('<perm_key>')`          │
│ - Executes inside the feature Server Component (RSC)     │
│ - Guarantees 0-byte data leakage from Postgres queries   │
└──────────────────────────┬───────────────────────────────┘
                           │ (Authorized)
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Tier 3: Zero-Flash UI Gating (AppHeaderServer/Layout)    │
│ - `AppHeaderServer` & `NavigationBarServer` stream HTML   │
│ - Pre-filters nav tabs before sending HTML to browser    │
│ - No skeleton flashes of forbidden tabs during loading   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Authentication Boundary: Staff PIN vs Owner Auth

1. **Owner Authentication (`email` + `password`)**:
   - Authenticated via Supabase Auth (`supabase.auth.signInWithPassword`).
   - Resolved as `role === 'owner'` in database `OrganizationMember`.
   - Granted full global bypass to all features and routes.

2. **Staff Station Authentication (`4-digit PIN`)**:
   - Authenticated via `loginWithPinAction(pin)` in `src/actions/auth.ts`.
   - **Brute-Force Rate Limiting**: Maximum 5 failed attempts per IP/terminal before a 15-minute lockout is enforced (`src/lib/auth/rate-limiter.ts`).
   - **Cryptographic HMAC-SHA256 Token**: Sets a tamper-proof signed cookie (`kitchflow_staff_session`) using Web Crypto HMAC:
     `token = <base64url(payload)>.<base64url(signature)>`
   - **Live Database Re-Verification**: Every request verifies the member in PostgreSQL (`prisma.organizationMember`). If an owner revokes or deletes the member in Settings, their access is terminated immediately on their very next click!
   - **Crucial Security Invariant**: Non-owner staff logging in with a PIN **never** inherit the store owner's Supabase session. If an owner previously logged in on that tablet, the PIN login signs out the owner session (`supabase.auth.signOut()`) to prevent privilege escalation.

---

## 3. Existing Permission Keys & Route Map

| Permission Key | Target Route | Purpose & Station Access |
|---|---|---|
| `orders` | `/orders` | Live order queue, status updates, cancel/hold |
| `kds` | `/kds` | Cook screen, prep times, bump bar tickets |
| `packing` | `/packing` | Bagging, dispatch QA checklist, rider handoff |
| `pos` | `/pos` | Counter billing, manual orders, bill receipts |
| `inventory` | `/inventory` | Ingredient stock levels, min-thresholds, wastage |
| `procurement`| In Drawer / POs | Supplier purchase orders, WhatsApp indents |
| `margins` | `/margins` | Food costs, commission breakdowns, profit analytics |
| `settings` | `/settings` | Outlets, brand tax profiles, staff PINs, printers |

---

## 4. How to Add a New Feature with Permissions (Step-by-Step Guide)

Whenever you add a new feature (for example: **Catering & Bulk Orders** at `/catering` with permission key `catering`, or **Customer CRM** at `/crm` with permission key `crm`), follow these **5 steps**:

### Step 1: Register Route in Edge Middleware
File: [`src/lib/supabase/middleware.ts`](file:///c:/projects/Kitchenos/src/lib/supabase/middleware.ts)

Add your route and its required permission to `routePermissionMap`:
```typescript
const routePermissionMap: Record<string, string> = {
  '/margins': 'margins',
  '/inventory': 'inventory',
  '/settings': 'settings',
  '/kds': 'kds',
  '/packing': 'packing',
  '/orders': 'orders',
  '/pos': 'pos',
  '/catering': 'catering', // <-- Add your new route mapping here
}
```

### Step 2: Guard the Feature Server Component with `requirePermission`
File: `src/features/<feature>/components/<feature>-section.tsx`

Following the Next.js App Architecture guidelines:
- Keep `src/app/<feature>/page.tsx` **synchronous**.
- Call `await requirePermission('<key>')` inside the async feature server component:

```typescript
// src/features/catering/components/catering-section.tsx
import 'server-only';
import React from 'react';
import { requirePermission } from '@/lib/session';
import { getCateringOrders } from '../catering-queries';
import { CateringSectionClient } from './catering-section-client';

export async function CateringSection({ kitchenId }: { kitchenId?: string }) {
  // 🛡️ Guard: redirects unauthorized staff automatically to their allowed station
  await requirePermission('catering');

  const data = await getCateringOrders(kitchenId);
  return <CateringSectionClient initialData={data} />;
}
```

And in your synchronous page:
```typescript
// src/app/catering/page.tsx
import { Suspense } from 'react';
import { CateringSection, CateringSectionSkeleton } from '@/features/catering/components/catering-section';

export default function CateringPage() {
  return (
    <Suspense fallback={<CateringSectionSkeleton />}>
      <CateringSection />
    </Suspense>
  );
}
```

### Step 3: Add to Navigation Bars (Desktop Header & Mobile Bar)
Files:
- [`src/components/mobile/AppHeader.tsx`](file:///c:/projects/Kitchenos/src/components/mobile/AppHeader.tsx)
- [`src/components/mobile/NavigationBar.tsx`](file:///c:/projects/Kitchenos/src/components/mobile/NavigationBar.tsx)

Add the item to `rawNavLinks` in `AppHeader.tsx`:
```typescript
const rawNavLinks = [
  { href: '/orders', permission: 'orders', label: t.liveQueue, icon: ClipboardList, badge: liveOrderCount, isDynamic: true },
  { href: '/kds', permission: 'kds', label: t.kdsCook, icon: Flame, badge: kdsPendingCount, isDynamic: true },
  { href: '/packing', permission: 'packing', label: t.dispatch, icon: PackageCheck, badge: packingPendingCount, isDynamic: true },
  { href: '/inventory', permission: 'inventory', label: t.inventory, icon: Boxes, badge: lowStockCount, isDynamic: false },
  { href: '/margins', permission: 'margins', label: t.margins, icon: TrendingUp, isDynamic: false },
  { href: '/catering', permission: 'catering', label: 'Catering', icon: Utensils, isDynamic: false }, // <-- New
]
```
Because `AppHeaderServer` passes `initialRole` and `initialPermissions` from the session cookie, the server pre-filters the array before sending HTML:
```typescript
const navLinks = rawNavLinks.filter((item) => {
  if (profileRole === 'owner') return true;
  return userPermissions.includes(item.permission);
});
```

### Step 4: Grant Permissions in Settings & Staff Management
File: [`src/app/settings/components/settings-client-view.tsx`](file:///c:/projects/Kitchenos/src/app/settings/components/settings-client-view.tsx)

Add your permission to the available checklist when creating or editing a staff member:
```typescript
const AVAILABLE_PERMISSIONS = [
  { id: 'orders', label: 'Live Orders Queue' },
  { id: 'pos', label: 'POS Terminal & Cashier' },
  { id: 'kds', label: 'KDS Kitchen Cook Screen' },
  { id: 'packing', label: 'Dispatch & Packing' },
  { id: 'inventory', label: 'Inventory & Stock' },
  { id: 'procurement', label: 'Purchase Orders & Indents' },
  { id: 'margins', label: 'Financial Margins & Profit' },
  { id: 'settings', label: 'Kitchen & Store Settings' },
  { id: 'catering', label: 'Catering & Bulk Orders' }, // <-- New
];
```

### Step 5: (If Client-Only Component) Add Fallback Route Redirect
If your new page is a pure client component (`'use client'`), add an effect-based redirect for safety:
```typescript
React.useEffect(() => {
  try {
    const activeRole = localStorage.getItem('kitchflow_active_staff_role');
    const activePerms = localStorage.getItem('kitchflow_active_staff_permissions');
    if (activeRole && activeRole !== 'owner' && activePerms) {
      const perms = JSON.parse(activePerms);
      if (Array.isArray(perms) && !perms.includes('catering')) {
        router.replace('/orders');
      }
    }
  } catch {}
}, [router]);
```

---

## 5. Security & Architectural Invariants to Remember

1. **Never use `if (!mounted) return true` in navigation filters**. Doing so causes the server to render all tabs during SSR, exposing forbidden options to staff while data is loading.
2. **Never default role state to `'owner'` in client components**. Default to `'kitchen_staff'` and pass `initialRole` and `initialPermissions` from the server.
3. **Always keep `app/**/page.tsx` synchronous**. Put `await requirePermission(...)` inside the feature async server component (`*Section`) inside `<Suspense>`, never at the top of `page.tsx`.
4. **Never log in with owner Supabase credentials for a staff PIN**. Staff identities belong in `kitchflow_staff_session`, not Supabase owner auth.

