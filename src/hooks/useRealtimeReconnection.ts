'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseRealtimeReconnectionOptions {
  channelName: string;
  onReconnect: () => Promise<void> | void;
  heartbeatIntervalMs?: number; // Optional heartbeat fallback interval (e.g. 30s)
}

/**
 * Lightweight, robust hook to handle:
 * 1. Supabase WebSocket channel reconnection states (CHANNEL_ERROR, TIMED_OUT, CLOSED -> SUBSCRIBED).
 * 2. Window online/visibilitychange recovery (e.g., tablet screen waking up or Wi-Fi reconnecting).
 * 3. Heartbeat safety polling fallback during long shifts to ensure missed frames are re-synced.
 */
export function useRealtimeReconnection({
  channelName,
  onReconnect,
  heartbeatIntervalMs = 30000,
}: UseRealtimeReconnectionOptions) {
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const wasOfflineRef = useRef(false);

  useEffect(() => {
    // 1. Browser Window Online Event (Wi-Fi reconnection / cellular failover)
    const handleOnline = () => {
      wasOfflineRef.current = true;
      onReconnectRef.current();
    };

    // 2. Page Visibility Event (Tablet screen wakes up from sleep or app brought back from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onReconnectRef.current();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Supabase Realtime Channel Status Listener
    const supabase = createClient();
    const statusChannel = supabase.channel(`status-${channelName}`)
      .subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          wasOfflineRef.current = true;
        } else if (status === 'SUBSCRIBED') {
          if (wasOfflineRef.current) {
            wasOfflineRef.current = false;
            // Channel re-established after disconnection — re-sync authoritative state immediately
            onReconnectRef.current();
          }
        }
      });

    // 4. Low-overhead periodic heartbeat check (guarantees catching missed broadcast frames)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        onReconnectRef.current();
      }
    }, heartbeatIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      supabase.removeChannel(statusChannel);
    };
  }, [channelName, heartbeatIntervalMs]);
}
