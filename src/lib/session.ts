import 'server-only';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, StaffSessionPayload } from '@/lib/auth/token';
import { hasPermission as checkHasPermission } from '@/lib/auth/permissions';

export interface UserSessionContext {
  userId: string;
  userName: string;
  kitchenId: string;
  kitchenName: string;
  kitchenIds?: string[];
  role: string;
  permissions?: string[];
}

export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication required to access kitchen resources') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class KitchenNotFoundError extends Error {
  constructor(message = 'No active kitchen facility found for this organization') {
    super(message);
    this.name = 'KitchenNotFoundError';
  }
}

/**
 * Hardened multi-tenant session context resolver.
 * Strictly guarantees that queries execute within the cryptographic scope
 * of the authenticated user without ever falling back to foreign tenant records.
 */
export async function getCurrentKitchenContext(explicitKitchenId?: string): Promise<UserSessionContext> {
  // connection() signals to Next.js Partial Prerendering to stream dynamically at request time
  await connection();

  // 1. Verify POS Staff Terminal Session Token (HMAC signed)
  let staffSession: StaffSessionPayload | null = null;
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('kitchflow_staff_session')?.value;
    if (token) {
      staffSession = await verifySessionToken(token);
    }
  } catch {
    // Session token verify error or cookies unavailable
  }

  if (staffSession?.organizationId) {
    // Live re-verification against PostgreSQL database
    let liveRole = staffSession.role;
    let livePermissions = staffSession.permissions;
    let liveName = staffSession.name;

    if (staffSession.memberId && staffSession.memberId !== 'demo-staff') {
      const liveMember = await prisma.organizationMember.findUnique({
        where: { id: staffSession.memberId },
        select: {
          id: true,
          role: true,
          permissions: true,
          name: true,
          organizationId: true,
        },
      });

      // If staff member was deleted by owner, reject session immediately
      if (!liveMember || liveMember.organizationId !== staffSession.organizationId) {
        throw new AuthenticationRequiredError('Staff terminal session has been revoked or removed');
      }

      liveRole = liveMember.role;
      livePermissions = liveMember.permissions;
      if (liveMember.name) liveName = liveMember.name;
    }

    const org = await prisma.organization.findUnique({
      where: { id: staffSession.organizationId },
      include: {
        kitchens: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (org && org.kitchens.length > 0) {
      let cookieKitchenId: string | undefined;
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        cookieKitchenId = cookieStore.get('kitchflow_active_kitchen_id')?.value;
      } catch {}

      const targetKitchenId = explicitKitchenId || cookieKitchenId || staffSession.kitchenId;
      const allKitchenIds = org.kitchens.map((k) => k.id);
      const isAll = targetKitchenId === 'ALL';

      const userKitchen = !isAll && targetKitchenId
        ? org.kitchens.find((k: { id: string }) => k.id === targetKitchenId) || org.kitchens[0]
        : org.kitchens[0];

      const permissions = liveRole === 'owner'
        ? ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings']
        : (livePermissions || ['orders', 'kds', 'packing']);

      return {
        userId: staffSession.userId || 'pos-terminal-staff',
        userName: liveName || 'Station Cashier',
        kitchenId: isAll ? 'ALL' : userKitchen.id,
        kitchenName: isAll ? 'All Outlets' : userKitchen.name,
        kitchenIds: allKitchenIds,
        role: liveRole || 'kitchen_staff',
        permissions,
      };
    }
  }

  // 2. Otherwise verify Supabase Auth user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new AuthenticationRequiredError('Active session not found or token expired');
  }

  // Resolve organization and kitchen bound to this authenticated user
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          kitchens: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!membership || !membership.organization?.kitchens?.length) {
    throw new KitchenNotFoundError('No active cloud kitchen associated with your account');
  }

  let cookieKitchenId: string | undefined;
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieKitchenId = cookieStore.get('kitchflow_active_kitchen_id')?.value;
  } catch {
    // cookies() unavailable in non-request contexts
  }

  const targetKitchenId = explicitKitchenId || cookieKitchenId;
  const allKitchenIds = membership.organization.kitchens.map((k) => k.id);
  const isAll = targetKitchenId === 'ALL';

  const userKitchen = !isAll && targetKitchenId
    ? membership.organization.kitchens.find((k: { id: string }) => k.id === targetKitchenId) || membership.organization.kitchens[0]
    : membership.organization.kitchens[0];

  const fullName =
    (user.user_metadata?.full_name as string) ||
    user.email?.split('@')[0] ||
    'Store Owner';

  const permissions = membership.role === 'owner'
    ? ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings', 'history', 'customers', 'delivery']
    : ((membership as any).permissions || ['orders', 'kds', 'packing']);

  return {
    userId: user.id,
    userName: fullName,
    kitchenId: isAll ? 'ALL' : userKitchen.id,
    kitchenName: isAll ? 'All Outlets' : userKitchen.name,
    kitchenIds: allKitchenIds,
    role: membership.role,
    permissions,
  };
}

/**
 * Server-side route and action permission enforcer.
 * Redirects or aborts if the authenticated session lacks the required permission.
 */
export async function requirePermission(permission: string, fallbackUrl?: string): Promise<UserSessionContext> {
  const session = await getCurrentKitchenContext();
  if (checkHasPermission(session.role, session.permissions, permission)) {
    return session;
  }

  const userPerms = session.permissions || ['orders', 'kds', 'packing'];
  const routePriority = ['orders', 'pos', 'kds', 'packing', 'inventory'];
  const fallback = fallbackUrl || ('/' + (routePriority.find((p) => userPerms.includes(p)) || 'orders'));
  const { redirect } = await import('next/navigation');
  redirect(fallback);

  return session;
}
