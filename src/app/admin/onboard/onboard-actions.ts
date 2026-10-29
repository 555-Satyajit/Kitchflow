'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTag } from 'next/cache';
import { inventoryTags } from '@/features/inventory/inventory-cache';
import { orderTags } from '@/features/orders/order-cache';

export interface ProvisionKitchenInput {
  accessKey?: string;
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  fssaiLic?: string;
  gstRate?: number;
  thermalRollSize?: string;
  brands: Array<{
    name: string;
    cuisine?: string;
    color?: string;
  }>;
  menuItems: Array<{
    name: string;
    brandName: string;
    price: number;
    category?: string;
  }>;
  menuOnboardingMode: 'self' | 'managed';
  conciergeNotes?: string;
  ownerCredentials: {
    name: string;
    email: string;
    password?: string;
    pin?: string;
  };
}

export interface ProvisionResult {
  ok: boolean;
  kitchenId?: string;
  organizationId?: string;
  brandsCreated?: number;
  menuItemsCreated?: number;
  error?: string;
}

export async function verifyAdminAccessKeyAction(key: string): Promise<{ ok: boolean }> {
  const expectedKey = process.env.INTERNAL_OPS_KEY || (process.env.NODE_ENV !== 'production' ? 'kitchflow2026' : null);
  if (!expectedKey) {
    return { ok: false };
  }
  return { ok: key.trim() === expectedKey };
}

export async function provisionKitchenAction(data: ProvisionKitchenInput): Promise<ProvisionResult> {
  try {
    const expectedKey = process.env.INTERNAL_OPS_KEY || (process.env.NODE_ENV !== 'production' ? 'kitchflow2026' : null);
    if (!expectedKey || !data.accessKey || data.accessKey.trim() !== expectedKey) {
      return {
        ok: false,
        error: 'Unauthorized: Invalid or missing administrator access key.',
      };
    }

    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `kitchen-${Date.now()}`;

    // Execute atomic PostgreSQL provisioning transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ensure or create Organization root
      let org = await tx.organization.findFirst({
        where: { slug },
      });

      if (!org) {
        org = await tx.organization.create({
          data: {
            name: `${data.name} Group`,
            slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
            subscriptionTier: 'starter',
            subscriptionStatus: 'active',
          },
        });
      }

      // 2. Create physical Kitchen facility with all collected onboarding data
      const kitchen = await tx.kitchen.create({
        data: {
          organizationId: org.id,
          name: data.name,
          address: data.address || null,
          phone: data.phone || null,
          email: data.ownerCredentials?.email || null,
          gstin: data.gstin || null,
          fssaiLic: data.fssaiLic || null,
          gstRate: data.gstRate !== undefined ? Number(data.gstRate) : 5.0,
          thermalRollSize: data.thermalRollSize || '80mm',
          invoiceTerms: 'Food once sold cannot be returned or exchanged.',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          isActive: true,
        },
      });

      // 3. Provision Virtual Brands
      const createdBrandsMap = new Map<string, string>(); // brandName -> brandId
      for (const b of data.brands) {
        const brand = await tx.brand.create({
          data: {
            kitchenId: kitchen.id,
            name: b.name,
            tagline: b.cuisine || null,
            color: b.color || '#f97316',
            active: true,
          },
        });
        createdBrandsMap.set(b.name.toLowerCase().trim(), brand.id);
      }

      // 4. Provision Seed Menu Items if in self-seed mode
      let menuItemsCreated = 0;
      if (data.menuOnboardingMode === 'self' && data.menuItems.length > 0) {
        for (const m of data.menuItems) {
          const matchedBrandId = 
            createdBrandsMap.get(m.brandName.toLowerCase().trim()) || 
            createdBrandsMap.values().next().value;

          if (matchedBrandId) {
            await tx.menuItem.create({
              data: {
                brandId: matchedBrandId,
                name: m.name,
                description: m.category ? `Category: ${m.category}` : '',
                station: 'ASSEMBLY',
                sellingPrice: m.price,
                packagingCost: 15.0,
                isAvailable: true,
                swiggyOnline: true,
                zomatoOnline: true,
              },
            });
            menuItemsCreated++;
          }
        }
      }



      return {
        kitchenId: kitchen.id,
        organizationId: org.id,
        brandsCreated: createdBrandsMap.size,
        menuItemsCreated,
      };
    });

    // 6. Automatically register and confirm the owner in Supabase Auth & link to Organization
    if (data.ownerCredentials?.email && data.ownerCredentials?.password) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          // Attempt sign up via Supabase Auth API
          const signUpRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: data.ownerCredentials.email.trim(),
              password: data.ownerCredentials.password,
              data: {
                full_name: data.ownerCredentials.name,
                pin: data.ownerCredentials.pin,
              },
            }),
          });

          const signUpData = await signUpRes.json();
          const userId = signUpData?.id || signUpData?.user?.id;

          // Directly auto-confirm the email in auth.users so password sign-in succeeds immediately
          await prisma.$queryRawUnsafe(
            'UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE email = $1',
            data.ownerCredentials.email.trim()
          );

          // If user exists or was created, attach to OrganizationMember as owner
          if (userId && result.organizationId) {
            await prisma.organizationMember.upsert({
              where: {
                organizationId_userId: {
                  organizationId: result.organizationId,
                  userId: userId,
                },
              },
              create: {
                organizationId: result.organizationId,
                userId: userId,
                role: 'owner',
                name: data.ownerCredentials.name,
                pin: data.ownerCredentials.pin,
              },
              update: {
                role: 'owner',
                name: data.ownerCredentials.name,
                pin: data.ownerCredentials.pin,
              },
            });
          }
        }
      } catch (authErr) {
        console.warn('Auto-provisioning owner into Supabase Auth notice:', authErr);
      }
    }

    // Invalidate Server Component caches
    revalidateTag(inventoryTags.kitchen(result.kitchenId), 'max');
    revalidateTag(orderTags.kitchen(result.kitchenId), 'max');

    return {
      ok: true,
      ...result,
    };
  } catch (error: any) {
    console.error('Provisioning kitchen failed:', error);
    return {
      ok: false,
      error: error?.message || 'Database provisioning failed',
    };
  }
}
