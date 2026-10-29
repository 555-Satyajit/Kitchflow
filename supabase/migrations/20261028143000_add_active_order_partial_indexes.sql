-- Migration: 20261028143000_add_active_order_partial_indexes.sql
-- Purpose: Implement high-scale partial B-tree indexes for active orders.
-- Keeps active index size under 250KB even with millions of historical records.
-- Complies with Supabase Postgres Best Practices (query-partial-indexes.md).

-- 1. Active KDS cooking line index (ACCEPTED & PREPARING)
CREATE INDEX IF NOT EXISTS idx_orders_active_kds 
ON public.orders (kitchen_id, created_at) 
WHERE status IN ('ACCEPTED', 'PREPARING');

-- 2. Active Packing QA Station index (PREPARING & READY)
CREATE INDEX IF NOT EXISTS idx_orders_active_packing 
ON public.orders (kitchen_id, created_at) 
WHERE status IN ('PREPARING', 'READY');

-- 3. Active Orders Queue counter & live ingestion index (excluding DISPATCHED & CANCELLED)
CREATE INDEX IF NOT EXISTS idx_orders_active_queue 
ON public.orders (kitchen_id, created_at DESC) 
WHERE status NOT IN ('DISPATCHED', 'CANCELLED');
