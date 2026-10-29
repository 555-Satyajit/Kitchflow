'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signSessionToken } from '@/lib/auth/token'
import { checkPinRateLimit, recordFailedPinAttempt, resetPinRateLimit } from '@/lib/auth/rate-limiter'

export async function loginWithSupabase(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/orders'

  if (!email || !password) {
    return { error: 'Please enter both email and password' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, redirectTo }
}

export async function signOutFromSupabase() {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.delete('kitchflow_staff_session')
    cookieStore.delete('kitchflow_active_kitchen_id')
  } catch (e) {}

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function loginWithPinAction(pin: string): Promise<{
  success?: boolean;
  error?: string;
  redirectTo?: string;
  staffName?: string;
  role?: string;
  permissions?: string[];
}> {
  try {
    const cleanPin = pin.trim();
    if (!cleanPin) {
      return { error: 'Please enter your 4-digit PIN' };
    }

    // Resolve client identifier for rate-limiting
    let clientIdentifier = 'local-terminal';
    try {
      const { headers } = await import('next/headers');
      const headerList = await headers();
      clientIdentifier = headerList.get('x-forwarded-for')?.split(',')[0].trim() ||
        headerList.get('x-real-ip') ||
        'local-terminal';
    } catch {}

    const rateCheck = checkPinRateLimit(clientIdentifier);
    if (!rateCheck.allowed) {
      return {
        error: `Terminal temporarily locked due to repeated incorrect PIN entries. Please retry in ${rateCheck.retryAfterSeconds || 900} seconds.`,
      };
    }

    const { prisma } = await import('@/lib/prisma');
    const { decryptPin, encryptPin } = await import('@/lib/auth/crypto');

    // Retrieve active members with configured PINs
    const candidateMembers = await prisma.organizationMember.findMany({
      where: {
        pin: { not: null },
      },
      include: {
        organization: {
          include: {
            kitchens: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    let member: (typeof candidateMembers)[number] | null = null;
    for (const cand of candidateMembers) {
      if (!cand.pin) continue;
      const decrypted = await decryptPin(cand.pin);
      if (decrypted === cleanPin) {
        member = cand;
        // Transparent upgrade: if member had a legacy plaintext PIN, encrypt it immediately
        if (!cand.pin.startsWith('enc:gcm:v1:')) {
          encryptPin(cleanPin).then((encrypted) => {
            prisma.organizationMember.update({
              where: { id: cand.id },
              data: { pin: encrypted },
            }).catch(() => {});
          });
        }
        break;
      }
    }

    if (member) {
      resetPinRateLimit(clientIdentifier);

      const activeKitchen = member.organization?.kitchens?.[0];
      const permissions = member.role === 'owner' 
        ? ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings']
        : ((member as any).permissions || ['orders', 'kds', 'packing']);

      // If staff member is not an owner, make sure any prior owner Supabase auth session is cleared
      if (member.role !== 'owner') {
        try {
          const supabase = await createClient();
          await supabase.auth.signOut();
        } catch {}
      }

      // Store cryptographically signed staff session cookie
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const sessionPayload = {
          memberId: member.id,
          userId: member.userId,
          name: member.name || 'Staff Member',
          role: member.role,
          organizationId: member.organizationId,
          kitchenId: member.kitchenId || activeKitchen?.id || null,
          kitchenName: activeKitchen?.name || null,
          permissions,
        };

        const signedToken = await signSessionToken(sessionPayload);

        cookieStore.set('kitchflow_staff_session', signedToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        if (member.kitchenId || activeKitchen?.id) {
          cookieStore.set('kitchflow_active_kitchen_id', member.kitchenId || activeKitchen!.id, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
          });
        }
      } catch (cookieErr) {
        console.warn('Could not set staff session cookie:', cookieErr);
      }

      const targetRedirect = permissions.includes('pos')
        ? '/pos'
        : permissions.includes('orders')
        ? '/orders'
        : permissions.includes('kds')
        ? '/kds'
        : permissions.includes('packing')
        ? '/packing'
        : permissions.includes('inventory')
        ? '/inventory'
        : '/orders';

      return {
        success: true,
        redirectTo: targetRedirect,
        staffName: member.name || 'Staff Member',
        role: member.role,
        permissions,
      };
    }

    // Fallback default pins strictly allowed in non-production or when explicit demo flag is enabled
    const allowDemoPins = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_PINS === 'true';
    if (allowDemoPins && (cleanPin === '1234' || cleanPin === '5123')) {
      resetPinRateLimit(clientIdentifier);
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const demoSessionPayload = {
          memberId: 'demo-staff',
          userId: 'demo-staff',
          name: 'Store Cashier',
          role: 'kitchen_staff',
          organizationId: 'org-kitchflow-demo',
          kitchenId: 'kitch-koramangala-01',
          kitchenName: 'Koramangala Cloud Hub #1',
          permissions: ['orders', 'pos', 'kds', 'packing'],
        };

        const signedToken = await signSessionToken(demoSessionPayload);

        cookieStore.set('kitchflow_staff_session', signedToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
        });
      } catch (cookieErr) {
        console.warn('Could not set demo staff session cookie:', cookieErr);
      }

      return {
        success: true,
        redirectTo: '/pos',
        staffName: 'Store Cashier',
        role: 'kitchen_staff',
        permissions: ['orders', 'pos', 'kds', 'packing'],
      };
    }

    const rateResult = recordFailedPinAttempt(clientIdentifier);
    if (rateResult.isLocked) {
      return {
        error: 'Too many incorrect PIN attempts. This terminal has been locked for 15 minutes for security.',
      };
    }

    return {
      error: `Invalid PIN. ${rateResult.remainingAttempts} attempt(s) remaining before station lockout.`,
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to authenticate PIN' };
  }
}
