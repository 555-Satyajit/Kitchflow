-- ==============================================================================
-- Migration: 20261025173000_complete_frontend_sync.sql
-- Description: Synchronizes PostgreSQL schema with all frontend features,
--              types (Station, InventoryCategory, StorageZone, StockReasonCode,
--              PurchaseOrder items, packing QA checklists, and order financials).
-- ==============================================================================

-- 1. ENUMS EXPANSION & SYNCHRONIZATION
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
        CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'kitchen_staff');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel') THEN
        CREATE TYPE channel AS ENUM ('SWIGGY', 'ZOMATO', 'DIRECT', 'WALK_IN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'CANCELLED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'station') THEN
        CREATE TYPE station AS ENUM ('GRILL', 'FRY', 'TANDOOR', 'DUM_BIRYANI', 'WOK', 'PIZZA', 'BEVERAGE', 'DESSERT', 'ASSEMBLY', 'PACKING');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ingredient_unit') THEN
        CREATE TYPE ingredient_unit AS ENUM ('g', 'ml', 'pc', 'kg', 'l');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_category') THEN
        CREATE TYPE inventory_category AS ENUM ('PACKAGING', 'MEAT_POULTRY', 'PRODUCE_DAIRY', 'DRY_STAPLES', 'BEVERAGES_RETAIL', 'CENTRAL_PREP');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storage_zone') THEN
        CREATE TYPE storage_zone AS ENUM ('DRY_STORE', 'CHILLER', 'FREEZER', 'PACKAGING_BAY', 'STATION_LINE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_reason_code') THEN
        CREATE TYPE stock_reason_code AS ENUM ('WASTAGE_SPOILAGE', 'AUDIT_CORRECTION', 'PURCHASE_INFLOW', 'RECIPE_AUTO_CONSUMPTION');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
        CREATE TYPE purchase_order_status AS ENUM ('PENDING_DELIVERY', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_horizon') THEN
        CREATE TYPE purchase_order_horizon AS ENUM ('MANUAL', 'LOW_STOCK', 'WEEKLY', 'MONTHLY');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('CASH', 'UPI', 'CARD', 'COD', 'DUE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('PAID', 'PENDING');
    END IF;
END $$;

-- 2. ALTER INGREDIENTS TABLE (category, storageZone, supplierName, brandId)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredients' AND column_name = 'category') THEN
        ALTER TABLE ingredients ADD COLUMN category inventory_category DEFAULT 'DRY_STAPLES';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredients' AND column_name = 'storage_zone') THEN
        ALTER TABLE ingredients ADD COLUMN storage_zone storage_zone DEFAULT 'DRY_STORE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredients' AND column_name = 'supplier_name') THEN
        ALTER TABLE ingredients ADD COLUMN supplier_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredients' AND column_name = 'brand_id') THEN
        ALTER TABLE ingredients ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. ALTER MENU_ITEMS TABLE (swiggyOnline, zomatoOnline, secondaryStations, description, lastSyncedAt)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'description') THEN
        ALTER TABLE menu_items ADD COLUMN description TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'swiggy_online') THEN
        ALTER TABLE menu_items ADD COLUMN swiggy_online BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'zomato_online') THEN
        ALTER TABLE menu_items ADD COLUMN zomato_online BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'secondary_stations') THEN
        ALTER TABLE menu_items ADD COLUMN secondary_stations TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'last_synced_at') THEN
        ALTER TABLE menu_items ADD COLUMN last_synced_at TIMESTAMPTZ;
    END IF;
END $$;

-- 4. ALTER ORDERS TABLE (customerPhone, customerAddress, paymentMethod, paymentStatus, checklist, dynamicChecklist, acknowledgedAt, extra financials)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_phone') THEN
        ALTER TABLE orders ADD COLUMN customer_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_address') THEN
        ALTER TABLE orders ADD COLUMN customer_address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method payment_method DEFAULT 'COD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
        ALTER TABLE orders ADD COLUMN payment_status payment_status DEFAULT 'PENDING';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'taxes') THEN
        ALTER TABLE orders ADD COLUMN taxes NUMERIC(10, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'packaging_fee_collected') THEN
        ALTER TABLE orders ADD COLUMN packaging_fee_collected NUMERIC(10, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'net_margin_percentage') THEN
        ALTER TABLE orders ADD COLUMN net_margin_percentage NUMERIC(5, 2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'checklist') THEN
        ALTER TABLE orders ADD COLUMN checklist JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'dynamic_checklist') THEN
        ALTER TABLE orders ADD COLUMN dynamic_checklist JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'acknowledged_at') THEN
        ALTER TABLE orders ADD COLUMN acknowledged_at TIMESTAMPTZ;
    END IF;
END $$;

-- 5. ALTER ORDER_ITEMS TABLE (secondary_stations, station_done)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'secondary_stations') THEN
        ALTER TABLE order_items ADD COLUMN secondary_stations TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'station_done') THEN
        ALTER TABLE order_items ADD COLUMN station_done BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 6. ALTER STOCK_LEDGER TABLE (previous_stock, unit)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'previous_stock') THEN
        ALTER TABLE stock_ledger ADD COLUMN previous_stock NUMERIC(12, 3) DEFAULT 0.000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_ledger' AND column_name = 'unit') THEN
        ALTER TABLE stock_ledger ADD COLUMN unit TEXT DEFAULT 'g';
    END IF;
END $$;

-- 7. RECREATE/UPDATE PURCHASE ORDERS & PURCHASE ORDER ITEMS
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    ingredient_name TEXT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    received_quantity NUMERIC(12, 3),
    unit TEXT NOT NULL DEFAULT 'g',
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_ingredient_id ON purchase_order_items(ingredient_id);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view purchase order items"
    ON purchase_order_items FOR SELECT
    TO authenticated
    USING (purchase_order_id IN (
        SELECT id FROM purchase_orders WHERE has_kitchen_access(kitchen_id)
    ));
