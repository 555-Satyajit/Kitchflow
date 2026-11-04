'use client';

import { useEffect } from 'react';
import { useKitchenStore } from '@/stores/useKitchenStore';
import { startSyncEngine } from '@/lib/sync/sync-engine';
import { isLocalFirstPipelineEnabled } from '@/lib/flags';

export function LocalFirstSyncSupervisor() {
  const hydrate = useKitchenStore((s) => s.hydrate);
  const activeKid = useKitchenStore((s) => s.activeKitchenId) || 'all';

  useEffect(() => {
    if (!isLocalFirstPipelineEnabled()) return;

    let targetKid = activeKid;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('kitchflow_active_kitchen_id');
      if (stored) targetKid = stored;
    }

    // 1. Initial 0ms IDB Hydration
    hydrate(targetKid);

    // 2. Start Sync Engine
    const cleanup = startSyncEngine(targetKid);

    return () => {
      cleanup();
    };
  }, [activeKid, hydrate]);

  return null;
}

