'use client';

import { useEffect, useRef, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UseRealtimeReconnectionProps {
  kitchenId?: string;
  channelName: string;
  onSynchronizeTruth?: () => Promise<void> | void;
  onReconnect?: () => Promise<void> | void; // Backwards-compatible alias
  heartbeatIntervalMs?: number;
}

/**
 * Multi-Trigger Heartbeat & Resynchronization Hook
 * Absorbs structural network dropouts, channel reconnections, and window sleep/wake cycles safely.
 * Prevents overlapping asynchronous reconciliation passes using an in-flight execution mutex.
 */
export function useRealtimeReconnection({
  kitchenId,
  channelName,
  onSynchronizeTruth,
  onReconnect,
  heartbeatIntervalMs = 30000,
}: UseRealtimeReconnectionProps) {
  const [, startTransition] = useTransition();

  // Stabilize sync callback reference
  const syncCallback = onSynchronizeTruth || onReconnect;
  const syncCallbackRef = useRef(syncCallback);
  syncCallbackRef.current = syncCallback;

  // Track system execution instances to prevent overlapping queries
  const isFetchingRef = useRef<boolean>(false);
  const activeChannelRef = useRef<RealtimeChannel | null>(null);

  // Authoritative data fetch executing inside a React transitional scope with guarded mutex
  const executeReconciliation = (triggerSource: string) => {
    if (isFetchingRef.current || !syncCallbackRef.current) return;

    isFetchingRef.current = true;
    console.log(`[Reconnection Engine] Sync initiated by: ${triggerSource}`);

    startTransition(async () => {
      try {
        if (syncCallbackRef.current) {
          await syncCallbackRef.current();
        }
      } catch (error) {
        console.error(`[Reconnection Engine] Synchronization failed:`, error);
      } finally {
        isFetchingRef.current = false;
      }
    });
  };

  useEffect(() => {
    const supabase = createClient();

    // 1. Monitor Supabase Channel Status changes
    const channel = supabase.channel(`heartbeat-${channelName}`);
    activeChannelRef.current = channel;

    channel.subscribe((status) => {
      // Catch socket reconnections when channel switches back to SUBSCRIBED
      if (status === 'SUBSCRIBED') {
        executeReconciliation('SUPABASE_CHANNEL_RECONNECTED');
      }
    });

    // 2. Hardware Adapter Online Detection (Wi-Fi router recover / hotspot fallback)
    const handleNetworkOnline = () => {
      executeReconciliation('HARDWARE_NETWORK_ONLINE');
    };

    // 3. Document Visibility Focus Tracker (Screen wake / browser tab restoration)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeReconciliation('WINDOW_VISIBILITY_WAKE');
      }
    };

    // 4. Lightweight Passive Heartbeat Fallback
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        executeReconciliation('PASSIVE_HEARTBEAT_POLL');
      }
    }, heartbeatIntervalMs);

    // Bind event listeners across window execution boundaries
    window.addEventListener('online', handleNetworkOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('online', handleNetworkOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (activeChannelRef.current) {
        supabase.removeChannel(activeChannelRef.current);
      }
    };
  }, [kitchenId, channelName, heartbeatIntervalMs]);
}
