-- Migration: 20261028140000_optimize_has_kitchen_access_rls.sql
-- Purpose: Optimize RLS evaluation for has_kitchen_access helper function
-- Avoid multi-table JOINs inside per-row RLS checks, replacing with indexed scalar subquery.

CREATE OR REPLACE FUNCTION public.has_kitchen_access(k_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = (SELECT organization_id FROM public.kitchens WHERE id = k_id)
      AND user_id = (SELECT auth.uid())
  );
$$;

-- Ensure execute permissions conform to Supabase security checklist
REVOKE EXECUTE ON FUNCTION public.has_kitchen_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_kitchen_access(UUID) TO authenticated, service_role;
