-- ==============================================================================
-- Migration: 20261025170000_multi_tenant_saas_schema.sql
-- Description: Multi-tenant organizations, memberships, purchase orders, 
--              optimized RLS policies with subquery caching, and FK indexes.
-- ==============================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
        CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'kitchen_staff');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
        CREATE TYPE po_status AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');
    END IF;
END $$;

-- 2. ORGANIZATIONS (Multi-Tenant Root)
CREATE TABLE IF NOT EXISTS organizations (
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

-- 3. ORGANIZATION MEMBERS (Team / RBAC)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'kitchen_staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);

-- 4. UPDATE KITCHENS TABLE WITH ORG ID & EXTRA FIELDS
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kitchens' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE kitchens ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kitchens' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE kitchens ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kitchens' AND column_name = 'currency'
    ) THEN
        ALTER TABLE kitchens ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kitchens' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE kitchens ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kitchens_org_id ON kitchens(organization_id);

-- 5. PURCHASE ORDERS TABLE
CREATE TABLE IF NOT EXISTS purchase_orders (
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

CREATE INDEX IF NOT EXISTS idx_po_kitchen_id ON purchase_orders(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(kitchen_id, status);

-- 6. MISSING FOREIGN KEY INDEXES (supabase-postgres-best-practices)
CREATE INDEX IF NOT EXISTS idx_brands_kitchen_id ON brands(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_kitchen_id ON ingredients(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_low_stock ON ingredients(kitchen_id) WHERE current_stock <= min_threshold;
CREATE INDEX IF NOT EXISTS idx_menu_items_brand_id ON menu_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_id ON recipes(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_id ON orders(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand_id ON orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(kitchen_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ingredient_id ON stock_ledger(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_order_id ON stock_ledger(order_id);

-- 7. HELPER SECURITY FUNCTIONS FOR FAST RLS EVALUATION
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

-- Revoke execute from public to avoid arbitrary invocation
REVOKE EXECUTE ON FUNCTION is_org_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION has_kitchen_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_kitchen_access(UUID) TO authenticated, service_role;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
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

-- Drop existing overlapping policies if any
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can view members of their organization" ON organization_members;
DROP POLICY IF EXISTS "Users can view kitchens of their organization" ON kitchens;
DROP POLICY IF EXISTS "Admins and Owners can manage kitchens" ON kitchens;
DROP POLICY IF EXISTS "Members can view brands" ON brands;
DROP POLICY IF EXISTS "Members can view ingredients" ON ingredients;
DROP POLICY IF EXISTS "Members can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Members can view recipes" ON recipes;
DROP POLICY IF EXISTS "Members can view and process orders" ON orders;
DROP POLICY IF EXISTS "Members can update order status" ON orders;
DROP POLICY IF EXISTS "Members can view order items" ON order_items;
DROP POLICY IF EXISTS "Members can update station completion" ON order_items;
DROP POLICY IF EXISTS "Members can view stock ledger" ON stock_ledger;
DROP POLICY IF EXISTS "Members can view purchase orders" ON purchase_orders;

-- 8.1 Organizations
CREATE POLICY "Users can view organizations they belong to"
    ON organizations FOR SELECT
    TO authenticated
    USING (id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
    ));

-- 8.2 Organization Members
CREATE POLICY "Users can view members of their organization"
    ON organization_members FOR SELECT
    TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
    ));

-- 8.3 Kitchens
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

-- 8.4 Brands, Ingredients, Menu Items, Recipes (Scoped to Kitchen)
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

-- 8.5 Orders & Order Items
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

-- 8.6 Stock Ledger & Purchase Orders
CREATE POLICY "Members can view stock ledger"
    ON stock_ledger FOR SELECT
    TO authenticated
    USING (ingredient_id IN (
        SELECT id FROM ingredients WHERE has_kitchen_access(kitchen_id)
    ));

CREATE POLICY "Members can view purchase orders"
    ON purchase_orders FOR SELECT
    TO authenticated
    USING (has_kitchen_access(kitchen_id));
