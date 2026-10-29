-- Migration: 20261028150000_compliance_security_hardening.sql
-- Description:
-- 1. Fix SECURITY DEFINER function grants: Revoke EXECUTE from PUBLIC and anon on public.has_kitchen_access and public.is_org_member.
--    Grant EXECUTE strictly to authenticated and service_role.
-- 2. Add Row-Level Security policies for dispatch_check_rules:
--    Ensure authenticated members can only view, insert, update, or delete dispatch check rules for kitchens they have access to.

-- Step 1: Function Execution Hardening
REVOKE EXECUTE ON FUNCTION public.has_kitchen_access(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_kitchen_access(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_member(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(TEXT) TO authenticated, service_role;

-- Step 2: Ensure dispatch_check_rules RLS is enabled
ALTER TABLE public.dispatch_check_rules ENABLE ROW LEVEL SECURITY;

-- Step 3: Add Tenant Isolation Policies for dispatch_check_rules
DROP POLICY IF EXISTS "Members can view dispatch check rules" ON public.dispatch_check_rules;
CREATE POLICY "Members can view dispatch check rules"
  ON public.dispatch_check_rules
  FOR SELECT
  TO authenticated
  USING (has_kitchen_access(kitchen_id));

DROP POLICY IF EXISTS "Members can manage dispatch check rules" ON public.dispatch_check_rules;
CREATE POLICY "Members can manage dispatch check rules"
  ON public.dispatch_check_rules
  FOR ALL
  TO authenticated
  USING (has_kitchen_access(kitchen_id))
  WITH CHECK (has_kitchen_access(kitchen_id));
