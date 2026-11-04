'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrganizationKitchensAction, switchActiveKitchenAction } from '@/actions/settings';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useKitchenStore } from '@/stores/useKitchenStore';

export const OUTLETS_QUERY_KEY = ['organization-outlets'] as const;
export const ACTIVE_OUTLET_QUERY_KEY = ['active-outlet-id'] as const;

export interface KitchenOutlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function useOutlets() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // 1. Fetch organization kitchens with TanStack Query
  const outletsQuery = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('kitchflow_active_kitchen_id') || undefined : undefined;
      const res = await getOrganizationKitchensAction(storedId);
      if (!res.ok || !res.data) {
        throw new Error(res.error || 'Failed to fetch outlets');
      }
      return res.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const kitchens = outletsQuery.data?.kitchens || [];
  const brands = outletsQuery.data?.brands || [];

  // 2. Active Kitchen ID query (synchronized in TanStack Query memory + localStorage fallback)
  const activeKitchenQuery = useQuery<string>({
    queryKey: ACTIVE_OUTLET_QUERY_KEY,
    queryFn: () => {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('kitchflow_active_kitchen_id');
        if (cached) return cached;
      }
      return outletsQuery.data?.activeKitchenId || (kitchens[0]?.id ?? 'ALL');
    },
    staleTime: 1000 * 30,
  });

  const activeOutletId = activeKitchenQuery.data || (typeof window !== 'undefined' ? localStorage.getItem('kitchflow_active_kitchen_id') : undefined) || 'ALL';
  const activeOutletName =
    activeOutletId === 'ALL'
      ? 'All Outlets'
      : kitchens.find((k) => k.id === activeOutletId)?.name || (typeof window !== 'undefined' ? localStorage.getItem('kitchflow_active_kitchen_name') : undefined) || 'Select Outlet';

  // 3. TanStack Mutation for Instant Switching (Zero Blank-Screen Reload)
  const switchOutletMutation = useMutation({
    mutationFn: async ({ outletId, outletName }: { outletId: string; outletName: string }) => {
      // 1. Immediately set cookie on client for instantaneous synchronization
      if (typeof document !== 'undefined') {
        document.cookie = `kitchflow_active_kitchen_id=${outletId}; path=/; max-age=2592000; SameSite=Lax`;
      }

      // 2. Clean up supabase realtime channels to avoid cross-tenant leaks
      try {
        const supabase = createClient();
        await supabase.removeAllChannels();
      } catch (wsErr) {
        console.warn('Realtime channel cleanup error:', wsErr);
      }

      // 3. Persist in server cookie & trigger server revalidations
      const res = await switchActiveKitchenAction(outletId);
      if (!res.ok) {
        throw new Error(res.error || 'Failed to switch outlet');
      }
      return { outletId, outletName };
    },
    onMutate: async ({ outletId, outletName }) => {
      // Cancel queries that may interfere
      await queryClient.cancelQueries({ queryKey: ACTIVE_OUTLET_QUERY_KEY });
      const previousOutletId = queryClient.getQueryData<string>(ACTIVE_OUTLET_QUERY_KEY);

      // Optimistically update active outlet
      queryClient.setQueryData<string>(ACTIVE_OUTLET_QUERY_KEY, outletId);
      useKitchenStore.getState().setActiveKitchenId(outletId);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('kitchflow_active_kitchen_id', outletId);
          localStorage.setItem('kitchflow_active_kitchen_name', outletName);
        } catch {}
      }

      return { previousOutletId };
    },
    onError: (err, variables, context) => {
      if (context?.previousOutletId) {
        queryClient.setQueryData<string>(ACTIVE_OUTLET_QUERY_KEY, context.previousOutletId);
      }
    },
    onSettled: async (data) => {
      if (data?.outletId) {
        queryClient.setQueryData<string>(ACTIVE_OUTLET_QUERY_KEY, data.outletId);
      }
      // Invalidate relevant TanStack queries so components smoothly re-fetch with new kitchenId
      queryClient.invalidateQueries({ queryKey: OUTLETS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVE_OUTLET_QUERY_KEY });
      
      // Tell Next.js App Router to refresh server components with new active kitchen
      router.refresh();
    },
  });

  const selectOutlet = (outletId: string, outletName: string) => {
    if (outletId === activeOutletId || switchOutletMutation.isPending) return;
    switchOutletMutation.mutate({ outletId, outletName });
  };

  return {
    outlets: kitchens,
    brands,
    activeOutletId,
    activeOutletName,
    isLoading: outletsQuery.isLoading,
    isSwitching: switchOutletMutation.isPending,
    selectOutlet,
  };
}

