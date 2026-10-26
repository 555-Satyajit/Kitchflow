import 'server-only';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export interface UserSessionContext {
  userId: string;
  userName: string;
  kitchenId: string;
  kitchenName: string;
  role: string;
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

  const userKitchen = explicitKitchenId
    ? membership.organization.kitchens.find((k) => k.id === explicitKitchenId)
    : membership.organization.kitchens[0];

  if (!userKitchen) {
    throw new KitchenNotFoundError(`Specified kitchen '${explicitKitchenId}' does not belong to your organization`);
  }

  const fullName =
    (user.user_metadata?.full_name as string) ||
    user.email?.split('@')[0] ||
    'Store Owner';

  return {
    userId: user.id,
    userName: fullName,
    kitchenId: userKitchen.id,
    kitchenName: userKitchen.name,
    role: membership.role,
  };
}
