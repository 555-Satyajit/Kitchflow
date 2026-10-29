'use client';

import { createClient } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';

// Global shared channel registry so we never recreate disconnected channels on-the-fly
const channels: Record<string, RealtimeChannel> = {};

export function getSharedChannel(name: string): RealtimeChannel {
  const supabase = createClient();
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${name}`);
  if (existing) {
    return existing;
  }
  if (channels[name]) {
    return channels[name];
  }
  const channel = supabase.channel(name, {
    config: {
      broadcast: { self: true }, // self: true ensures both local and peer listeners receive
    },
  });
  channel.subscribe();
  channels[name] = channel;
  return channel;
}

export function broadcastKitchenEvent(channelName: string, event: string, payload: any) {
  try {
    const channel = getSharedChannel(channelName);
    const send = () => {
      channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    };

    if (channel.state === 'joined') {
      send();
    } else if (channel.state === 'closed') {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          send();
        }
      });
    } else {
      // Channel is in 'joining' state, send as soon as joined
      const checkInterval = setInterval(() => {
        if (channel.state === 'joined') {
          clearInterval(checkInterval);
          send();
        }
      }, 30);
      setTimeout(() => clearInterval(checkInterval), 3000);
    }
  } catch (err) {
    console.warn(`[Realtime Bus] Error broadcasting ${event} to ${channelName}:`, err);
  }
}

