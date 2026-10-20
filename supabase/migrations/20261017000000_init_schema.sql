-- ==============================================================================
-- Cloud Kitchen OS: Schema Migration
-- Multi-Brand Cloud Kitchen schema with append-only stock ledger & frozen financials
-- ==============================================================================

-- 1. Tenants & Kitchens
CREATE TABLE IF NOT EXISTS kitchens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Brands (Multiple virtual brands sharing one kitchen)
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID REFERENCES kitchens(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tagline TEXT,
    color TEXT DEFAULT '#f97316',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ingredients Master
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID REFERENCES kitchens(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'pc', 'kg', 'l')),
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
    min_threshold NUMERIC(12, 3) NOT NULL DEFAULT 0,
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    station TEXT NOT NULL CHECK (station IN ('GRILL', 'FRY', 'ASSEMBLY', 'PACKING')),
    selling_price NUMERIC(10, 2) NOT NULL,
    packaging_cost NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Recipes (Bill of Materials - BOM)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(menu_item_id, ingredient_id)
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_id UUID REFERENCES kitchens(id),
    brand_id UUID REFERENCES brands(id),
    channel TEXT NOT NULL CHECK (channel IN ('SWIGGY', 'ZOMATO', 'DIRECT', 'WALK_IN')),
    order_number TEXT NOT NULL,
    customer_name TEXT,
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'CANCELLED')),
    target_prep_minutes INT DEFAULT 15,
    gross_amount NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0,
    commission_rate NUMERIC(5, 4) DEFAULT 0.22,
    commission_amount NUMERIC(10, 2) DEFAULT 0,
    ingredient_cost NUMERIC(10, 2) DEFAULT 0,
    packaging_cost NUMERIC(10, 2) DEFAULT 0,
    net_margin NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ready_at TIMESTAMPTZ
);

-- 7. Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    name TEXT NOT NULL,
    station TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price NUMERIC(10, 2) NOT NULL,
    is_station_done BOOLEAN DEFAULT FALSE
);

-- 8. Append-Only Stock Ledger (Audit Trail)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    delta NUMERIC(12, 3) NOT NULL, -- negative for consumption, positive for restock
    balance_after NUMERIC(12, 3) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('ORDER_CONSUMPTION', 'PURCHASE_RESTOCK', 'WASTAGE_SPOILAGE', 'PHYSICAL_AUDIT_CORRECTION')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime publication enablement for live kitchen updates
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
