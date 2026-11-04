/**
 * Local-First Sync Engine
 * Handles leader-elected sequential outbox pushing, cursor-based event pulling,
 * and Supabase Realtime wake-up nudges.
 */

import {
  idbGetPendingMutations,
  idbRemoveMutation,
  idbGetLastSeq,
  idbSetLastSeq,
  idbApplyServerEvents,
  OutboxMutation,
} from '@/lib/db/edge-db';
import { useKitchenStore } from '@/stores/useKitchenStore';
import { applyMutationAction, pullKitchenEventsAction } from './sync-actions';
import { createClient } from '@/lib/supabase/client';
import { getDeviceUuid } from '@/lib/utils';

let isPushing = false;
let isPulling = false;
let activeUnsub: (() => void) | null = null;

/**
 * Sequential Outbox Push Loop:
 * Drains pending mutations in FIFO order to Postgres RPC apply_mutation.
 */
export async function flushOutbox(kitchenId?: string): Promise<void> {
  if (isPushing || typeof window === 'undefined' || !navigator.onLine) {
    return;
  }
  isPushing = true;

  try {
    const mutations = await idbGetPendingMutations(kitchenId);
    if (mutations.length === 0) {
      isPushing = false;
      return;
    }

    const deviceId = getDeviceUuid();

    for (const mutation of mutations) {
      try {
        const res = await applyMutationAction({
          mutationId: mutation.id,
          kitchenId: mutation.kitchenId,
          orderId: mutation.orderId,
          actionType: mutation.actionType,
          payload: mutation.payload,
          deviceId,
        });

        if (res.ok) {
          await idbRemoveMutation(mutation.id);
          // If server allocated authoritative orderNumber, update local store
          if (res.data?.orderNumber) {
            const { orders } = useKitchenStore.getState();
            const existing = orders[mutation.orderId];
            if (existing && existing.orderNumber !== res.data.orderNumber) {
              useKitchenStore.setState({
                orders: {
                  ...orders,
                  [mutation.orderId]: {
                    ...existing,
                    orderNumber: res.data.orderNumber,
                    version: res.data.version || existing.version,
                  },
                },
              });
            }
          }
        } else {
          // If server rejected (already dispatched / terminal state), safely remove from outbox
          if (res.error?.includes('TERMINAL_NOOP') || res.error?.includes('ALREADY_EXISTS')) {
            await idbRemoveMutation(mutation.id);
          } else {
            console.warn(`[Sync Engine] Mutation ${mutation.id} retry scheduled:`, res.error);
            break; // Stop loop, retry on next pulse
          }
        }
      } catch (networkErr) {
        console.warn(`[Sync Engine] Network interruption during push:`, networkErr);
        break; // Stop until connection restored
      }
    }

    await useKitchenStore.getState().updateOutboxCount();
  } catch (err) {
    console.error('[Sync Engine] Outbox flush error:', err);
  } finally {
    isPushing = false;
  }
}

/**
 * Cursor-based Event Pull Loop:
 * Fetches events where seq > lastSeq and applies them in batch.
 */
export async function pullEvents(kitchenId: string): Promise<void> {
  if (isPulling || typeof window === 'undefined' || !navigator.onLine) {
    return;
  }
  if (!kitchenId || kitchenId === 'ALL' || kitchenId === 'all') {
    return;
  }

  isPulling = true;

  try {
    const lastSeq = await idbGetLastSeq(kitchenId);
    const res = await pullKitchenEventsAction(kitchenId, lastSeq, 500);

    if (res.ok && res.data && res.data.length > 0) {
      const events = res.data;
      await idbApplyServerEvents(kitchenId, events);
      useKitchenStore.getState().applyServerEvents(events);
    }
  } catch (err) {
    console.error('[Sync Engine] Cursor pull error:', err);
  } finally {
    isPulling = false;
  }
}

/**
 * Starts the Local-First Sync Engine for a kitchen.
 * Handles Web Locks leader election, initial pull, Realtime nudge, and outbox sweeps.
 */
export function startSyncEngine(kitchenId: string): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if (activeUnsub) {
    activeUnsub();
    activeUnsub = null;
  }

  let isDestroyed = false;
  const targetKid = kitchenId || 'default';

  // 1. Initial Cold-Start Synchronizations
  flushOutbox(targetKid);
  if (targetKid !== 'ALL' && targetKid !== 'all') {
    pullEvents(targetKid);
  }

  // 2. Browser Event Listeners
  const onOnline = () => {
    flushOutbox(targetKid);
    if (targetKid !== 'ALL' && targetKid !== 'all') {
      pullEvents(targetKid);
    }
  };

  const onOutboxNudge = () => {
    flushOutbox(targetKid);
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('kitchflow_outbox_nudge', onOutboxNudge);

  // 3. 25-Second Watchdog Safety Sweep
  const intervalId = setInterval(() => {
    if (!isDestroyed) {
      flushOutbox(targetKid);
      if (targetKid !== 'ALL' && targetKid !== 'all') {
        pullEvents(targetKid);
      }
    }
  }, 25000);

  // 4. Supabase Realtime Wake-Up Nudge
  const supabase = createClient();
  const channelName = `kitchen-${targetKid}-pipeline-v2`;

  const channel = supabase
    .channel(channelName, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'NUDGE' }, async ({ payload }) => {
      if (isDestroyed || !payload) return;
      const deviceId = getDeviceUuid();

      // Echo protection: skip if triggered by this exact device
      if (payload.deviceId && payload.deviceId === deviceId) {
        return;
      }

      const lastSeq = await idbGetLastSeq(targetKid);
      // Fast path: contiguous sequence
      if (payload.seq === lastSeq + 1 && payload.event) {
        await idbApplyServerEvents(targetKid, [payload.event]);
        useKitchenStore.getState().applyServerEvents([payload.event]);
        await idbSetLastSeq(targetKid, payload.seq);
      } else if (payload.seq > lastSeq) {
        // Gap detected: trigger authoritative cursor pull
        pullEvents(targetKid);
      }
    })
    .subscribe();

  const cleanup = () => {
    isDestroyed = true;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('kitchflow_outbox_nudge', onOutboxNudge);
    clearInterval(intervalId);
    supabase.removeChannel(channel);
  };

  activeUnsub = cleanup;
  return cleanup;
}

