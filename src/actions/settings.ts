'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentKitchenContext } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { encryptPin, decryptPin } from '@/lib/auth/crypto';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Persist active kitchen selection in an HTTP-only cookie and revalidate views
 */
export async function switchActiveKitchenAction(kitchenId: string): Promise<ActionResult<{ activeKitchenId: string }>> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    cookieStore.set('kitchflow_active_kitchen_id', kitchenId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });

    revalidatePath('/orders');
    revalidatePath('/orders/history');
    revalidatePath('/customers');
    revalidatePath('/inventory');
    revalidatePath('/settings');
    revalidatePath('/kds');
    revalidatePath('/dispatch');

    return { ok: true, data: { activeKitchenId: kitchenId } };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to switch active kitchen' };
  }
}

/**
 * 1. Fetch all kitchens in user's organization
 */
export async function getOrganizationKitchensAction(targetKitchenId?: string): Promise<ActionResult<{
  kitchens: Array<{
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    fssaiLic: string | null;
    gstRate: number;
    thermalRollSize: string;
    invoiceTerms: string | null;
    isActive: boolean;
    brandCount: number;
    brandNames?: string[];
  }>;
  activeKitchenId: string;
  brands?: Array<{
    id: string;
    kitchenId?: string;
    name: string;
    tagline?: string;
    color?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    fssaiLic?: string;
    invoiceTerms?: string;
    active: boolean;
  }>;
  allBrands?: Array<{
    id: string;
    kitchenId?: string;
    name: string;
    tagline?: string;
    color?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    fssaiLic?: string;
    invoiceTerms?: string;
    active: boolean;
  }>;
}>> {
  try {
    const session = await getCurrentKitchenContext();
    const effectiveKitchenId = targetKitchenId || session.kitchenId;
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.userId },
      include: {
        organization: {
          include: {
            kitchens: {
              include: {
                brands: {
                  select: { id: true, name: true },
                },
                _count: {
                  select: { brands: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!membership?.organization) {
      return { ok: false, error: 'Organization not found' };
    }

    const kitchens = membership.organization.kitchens.map((k) => ({
      id: k.id,
      name: k.name,
      address: k.address,
      phone: k.phone,
      email: k.email,
      gstin: k.gstin,
      fssaiLic: k.fssaiLic,
      gstRate: k.gstRate,
      thermalRollSize: k.thermalRollSize,
      invoiceTerms: k.invoiceTerms,
      isActive: k.isActive,
      brandCount: k._count.brands,
      brandNames: k.brands.map((b) => b.name),
    }));

    // Fetch all brands in this organization across all kitchens
    const allKitchenIds = kitchens.map((k) => k.id);
    const orgBrands = await prisma.brand.findMany({
      where: { 
        kitchenId: { in: allKitchenIds }
      },
      orderBy: { createdAt: 'asc' },
    });

    const isAll = effectiveKitchenId === 'ALL';
    const activeBrands = isAll 
      ? orgBrands 
      : orgBrands.filter((b) => b.kitchenId === effectiveKitchenId);

    const mapBrand = (b: any) => ({
      id: b.id,
      kitchenId: b.kitchenId,
      name: b.name,
      tagline: b.tagline || '',
      color: b.color || '#f97316',
      logoUrl: b.logoUrl || undefined,
      address: b.address || undefined,
      phone: b.phone || undefined,
      email: b.email || undefined,
      fssaiLic: b.fssaiLic || undefined,
      invoiceTerms: b.invoiceTerms || undefined,
      active: b.active,
    });

    return {
      ok: true,
      data: {
        kitchens,
        activeKitchenId: effectiveKitchenId,
        brands: activeBrands.map(mapBrand),
        allBrands: orgBrands.map(mapBrand),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed fetching kitchens' };
  }
}

/**
 * 2. Create a new physical Kitchen Outlet
 */
export async function createKitchenAction(input: {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  fssaiLic?: string;
  gstRate?: number;
  thermalRollSize?: string;
  invoiceTerms?: string;
}): Promise<ActionResult<{ kitchenId: string; name: string }>> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && session.role !== 'manager') {
      return { ok: false, error: 'Unauthorized: Only owners and managers can create kitchen facilities' };
    }

    const member = await prisma.organizationMember.findFirst({
      where: { userId: session.userId },
    });

    if (!member?.organizationId) {
      return { ok: false, error: 'Organization profile missing for user' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const newKitchen = await tx.kitchen.create({
        data: {
          organizationId: member.organizationId,
          name: input.name.trim(),
          address: input.address?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          gstin: input.gstin?.trim() || null,
          fssaiLic: input.fssaiLic?.trim() || null,
          gstRate: input.gstRate || 5.0,
          thermalRollSize: input.thermalRollSize || '80mm',
          invoiceTerms: input.invoiceTerms?.trim() || 'Food once sold cannot be returned or exchanged.',
          isActive: true,
        },
      });

      // Auto-create primary brand: the kitchen itself is the brand by default!
      await tx.brand.create({
        data: {
          kitchenId: newKitchen.id,
          name: newKitchen.name,
          tagline: 'Main Kitchen Storefront',
          color: '#f97316',
          address: newKitchen.address,
          phone: newKitchen.phone,
          email: newKitchen.email,
          fssaiLic: newKitchen.fssaiLic,
          invoiceTerms: newKitchen.invoiceTerms,
          active: true,
        },
      });

      return newKitchen;
    });

    revalidatePath('/settings');
    revalidatePath('/orders');
    return {
      ok: true,
      data: { kitchenId: result.id, name: result.name },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed creating kitchen' };
  }
}

/**
 * 3. Update Kitchen Outlet Profile & Invoice Defaults
 */
export async function updateKitchenSettingsAction(input: {
  kitchenId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  fssaiLic?: string;
  gstRate?: number;
  thermalRollSize?: string;
  invoiceTerms?: string;
}): Promise<ActionResult> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('settings')) {
      return { ok: false, error: 'Unauthorized: Settings permission required' };
    }
    if (session.kitchenIds && !session.kitchenIds.includes(input.kitchenId)) {
      return { ok: false, error: 'Unauthorized: Facility does not belong to your organization' };
    }

    await prisma.kitchen.update({
      where: { id: input.kitchenId },
      data: {
        name: input.name.trim(),
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        gstin: input.gstin?.trim() || null,
        fssaiLic: input.fssaiLic?.trim() || null,
        gstRate: input.gstRate !== undefined ? Number(input.gstRate) : 5.0,
        thermalRollSize: input.thermalRollSize || '80mm',
        invoiceTerms: input.invoiceTerms?.trim() || 'Food once sold cannot be returned or exchanged.',
      },
    });

    revalidatePath('/settings');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed updating kitchen settings' };
  }
}

/**
 * 4. Create or Update Virtual Brand (Brand-Wise Custom Invoices)
 */
export async function saveBrandAction(input: {
  id?: string;
  kitchenId: string;
  name: string;
  tagline?: string;
  color?: string;
  address?: string;
  phone?: string;
  email?: string;
  fssaiLic?: string;
  invoiceTerms?: string;
}): Promise<ActionResult<{ brandId: string }>> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('settings')) {
      return { ok: false, error: 'Unauthorized: Settings permission required' };
    }
    if (session.kitchenIds && !session.kitchenIds.includes(input.kitchenId)) {
      return { ok: false, error: 'Unauthorized: Facility does not belong to your organization' };
    }

    if (input.id) {
      const existingBrand = await prisma.brand.findFirst({
        where: {
          id: input.id,
          kitchenId: input.kitchenId,
        },
      });

      if (!existingBrand) {
        return { ok: false, error: 'Brand not found or unauthorized' };
      }

      const updated = await prisma.brand.update({
        where: { id: input.id },
        data: {
          name: input.name.trim(),
          tagline: input.tagline?.trim() || null,
          color: input.color || '#f97316',
          address: input.address?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          fssaiLic: input.fssaiLic?.trim() || null,
          invoiceTerms: input.invoiceTerms?.trim() || null,
        },
      });
      revalidatePath('/settings');
      revalidatePath('/orders');
      return { ok: true, data: { brandId: updated.id } };
    }

    const created = await prisma.brand.create({
      data: {
        kitchenId: input.kitchenId,
        name: input.name.trim(),
        tagline: input.tagline?.trim() || 'Virtual Cloud Kitchen Storefront',
        color: input.color || '#f97316',
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        fssaiLic: input.fssaiLic?.trim() || null,
        invoiceTerms: input.invoiceTerms?.trim() || null,
        active: true,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/orders');
    return { ok: true, data: { brandId: created.id } };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed saving brand' };
  }
}

/**
/**
 * 5. Fetch Staff members with brand & station access, custom role, and permissions
 */
export async function getStaffMembersAction(): Promise<ActionResult<Array<{
  id: string;
  userId: string;
  name: string | null;
  role: string;
  customRole: string | null;
  permissions: string[];
  kitchenId: string | null;
  kitchenName?: string | null;
  pin: string | null;
  allowedBrands: string[];
  createdAt: string;
}>>> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('settings')) {
      return { ok: false, error: 'Unauthorized: Settings permission required' };
    }

    const currentMember = await prisma.organizationMember.findFirst({
      where: { userId: session.userId },
    });

    if (!currentMember?.organizationId) {
      return { ok: false, error: 'Organization not found' };
    }

    const [members, kitchens] = await Promise.all([
      prisma.organizationMember.findMany({
        where: { organizationId: currentMember.organizationId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.kitchen.findMany({
        where: { organizationId: currentMember.organizationId },
        select: { id: true, name: true },
      }),
    ]);

    const kitchenNameMap = new Map(kitchens.map((k) => [k.id, k.name]));
    const ALL_PERMISSIONS = ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings'];

    const decryptedMembers = await Promise.all(
      members.map(async (m: any) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        role: m.role,
        customRole: m.role === 'owner' ? (m.customRole || 'Owner & Founder') : m.customRole || null,
        // Owner always has ALL permissions unrestricted
        permissions: m.role === 'owner' ? ALL_PERMISSIONS : (m.permissions || ['orders', 'kds', 'packing']),
        kitchenId: m.kitchenId || null,
        kitchenName: m.kitchenId ? kitchenNameMap.get(m.kitchenId) || null : null,
        pin: m.pin ? await decryptPin(m.pin) : null,
        allowedBrands: m.allowedBrands,
        createdAt: m.createdAt.toISOString(),
      }))
    );

    return {
      ok: true,
      data: decryptedMembers,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed fetching staff members' };
  }
}

/**
 * 6. Create or invite Staff Account with Custom Role Name and Feature Permissions
 */
export async function createStaffMemberAction(input: {
  name: string;
  email: string;
  password?: string;
  pin?: string;
  role?: 'admin' | 'manager' | 'kitchen_staff';
  customRole?: string;
  permissions?: string[];
  kitchenId?: string;
  allowedBrands?: string[];
}): Promise<ActionResult> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('settings')) {
      return { ok: false, error: 'Unauthorized: Settings permission required' };
    }

    const currentMember = await prisma.organizationMember.findFirst({
      where: { userId: session.userId },
    });

    if (!currentMember?.organizationId) {
      return { ok: false, error: 'Organization context not found' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let targetUserId = `staff-${Date.now()}`;

    // Provision directly into Supabase Auth if credentials provided
    if (supabaseUrl && supabaseKey && input.email && input.password) {
      try {
        const signUpRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: input.email.trim(),
            password: input.password,
            data: {
              full_name: input.name.trim(),
              pin: input.pin || '1234',
            },
          }),
        });

        const signUpData = await signUpRes.json();
        if (signUpData?.id || signUpData?.user?.id) {
          targetUserId = signUpData?.id || signUpData?.user?.id;
        }

        // Auto-confirm email in auth.users
        await prisma.$queryRawUnsafe(
          'UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE email = $1',
          input.email.trim()
        ).catch(() => {});
      } catch (e) {
        console.warn('Supabase auth staff creation warning:', e);
      }
    }

    // Default permissions if none provided
    const permissions = input.permissions && input.permissions.length > 0 
      ? input.permissions 
      : ['orders', 'kds', 'packing'];

    // Encrypt PIN before persisting at rest
    const encryptedPin = input.pin?.trim() ? await encryptPin(input.pin.trim()) : null;

    await prisma.organizationMember.create({
      data: {
        organizationId: currentMember.organizationId,
        userId: targetUserId,
        role: input.role || 'kitchen_staff',
        customRole: input.customRole?.trim() || null,
        permissions: permissions,
        kitchenId: input.kitchenId || null,
        name: input.name.trim(),
        pin: encryptedPin,
        allowedBrands: input.allowedBrands || [],
      },
    });

    revalidatePath('/settings');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed creating staff member' };
  }
}

/**
 * 7. Update Staff Member Permissions and Roles
 */
export async function updateStaffMemberAction(input: {
  memberId: string;
  name?: string;
  customRole?: string;
  role?: 'admin' | 'manager' | 'kitchen_staff' | 'owner';
  permissions?: string[];
  kitchenId?: string | null;
  pin?: string;
  allowedBrands?: string[];
}): Promise<ActionResult> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('settings')) {
      return { ok: false, error: 'Unauthorized: Settings permission required' };
    }

    const currentMember = await prisma.organizationMember.findFirst({
      where: { userId: session.userId },
    });

    if (!currentMember?.organizationId) {
      return { ok: false, error: 'Organization context not found' };
    }

    // Verify target member belongs to the same organization
    const target = await prisma.organizationMember.findUnique({
      where: { id: input.memberId },
    });

    if (!target || target.organizationId !== currentMember.organizationId) {
      return { ok: false, error: 'Target staff member not found' };
    }

    // SECURITY RULE: Staff members can NEVER edit or revoke an Owner's access
    if (target.role === 'owner') {
      if (currentMember.role !== 'owner') {
        return { ok: false, error: 'Access Denied: Staff members cannot edit the Owner account' };
      }
      // Even if the owner edits themselves, their role remains owner and permissions remain full
      input.role = 'owner';
      input.permissions = ['orders', 'pos', 'kds', 'packing', 'inventory', 'procurement', 'margins', 'settings'];
    }

    const encryptedPin = input.pin !== undefined && input.pin.trim() !== ''
      ? await encryptPin(input.pin.trim())
      : (input.pin === '' ? null : undefined);

    await prisma.organizationMember.update({
      where: { id: input.memberId },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        customRole: input.customRole !== undefined ? input.customRole.trim() : undefined,
        role: input.role !== undefined ? input.role : undefined,
        permissions: input.permissions !== undefined ? input.permissions : undefined,
        kitchenId: input.kitchenId !== undefined ? input.kitchenId : undefined,
        pin: encryptedPin,
        allowedBrands: input.allowedBrands !== undefined ? input.allowedBrands : undefined,
      },
    });

    revalidatePath('/settings');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed updating staff member' };
  }
}

/**
 * 8. Remove Staff Member from Organization
 */
export async function deleteStaffMemberAction(memberId: string): Promise<ActionResult> {
  try {
    const session = await getCurrentKitchenContext();
    if (session.role !== 'owner' && !session.permissions?.includes('settings')) {
      return { ok: false, error: 'Unauthorized: Settings permission required' };
    }

    const currentMember = await prisma.organizationMember.findFirst({
      where: { userId: session.userId },
    });

    if (!currentMember?.organizationId) {
      return { ok: false, error: 'Organization context not found' };
    }

    const target = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.organizationId !== currentMember.organizationId) {
      return { ok: false, error: 'Unauthorized to remove this staff member' };
    }

    if (target.role === 'owner') {
      return { ok: false, error: 'Cannot remove organization owner' };
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    revalidatePath('/settings');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed removing staff member' };
  }
}
