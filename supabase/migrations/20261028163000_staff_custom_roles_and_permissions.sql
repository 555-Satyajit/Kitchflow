-- Migration: Add custom role, feature permissions, and kitchen binding to organization_members
-- Date: 2026-10-28
-- Description: Non-destructive addition of custom_role, permissions array, and optional kitchen_id (TEXT)

ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS custom_role TEXT,
ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY['orders', 'kds', 'packing']::TEXT[],
ADD COLUMN IF NOT EXISTS kitchen_id TEXT REFERENCES kitchens(id) ON DELETE SET NULL;

-- Create index on kitchen_id for rapid outlet staff filtering
CREATE INDEX IF NOT EXISTS idx_org_members_kitchen_id ON organization_members(kitchen_id);
