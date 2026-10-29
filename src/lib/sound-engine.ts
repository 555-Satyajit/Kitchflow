/**
 * KitchenOS Audio Engine
 * Plays real acoustic audio sound files (hotel desk bell, clean chime, gentle ping)
 * stored locally in `/public/sounds/` with audio pooling and volume control.
 */

export type KitchenSoundType = 
  | 'NEW_ORDER'       // Realistic desk bell / counter ding (/sounds/bell.wav)
  | 'SLA_URGENT'      // Two-tone alert chime (/sounds/urgent.wav)
  | 'ITEM_COMPLETE'   // Subtle clean ping (/sounds/tap.wav)
  | 'ORDER_DISPATCH'; // Desk bell resolution (/sounds/bell.wav)

const SOUND_PATHS: Record<KitchenSoundType, string> = {
  NEW_ORDER: '/sounds/bell.wav',
  SLA_URGENT: '/sounds/urgent.wav',
  ITEM_COMPLETE: '/sounds/tap.wav',
  ORDER_DISPATCH: '/sounds/bell.wav',
};

// Cache preloaded HTMLAudioElements for 0ms latency playback
const audioCache: Partial<Record<KitchenSoundType, HTMLAudioElement>> = {};

function getAudio(type: KitchenSoundType): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCache[type]) {
      const audio = new Audio(SOUND_PATHS[type]);
      audio.preload = 'auto';
      audioCache[type] = audio;
    }
    return audioCache[type] || null;
  } catch {
    return null;
  }
}

/**
 * Play realistic kitchen audio notification file with volume control
 */
export function playKitchenSound(type: KitchenSoundType = 'NEW_ORDER', volume: number = 0.4): void {
  try {
    const audio = getAudio(type);
    if (!audio) return;

    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay may be restricted until first user interaction
      });
    }
  } catch (err) {
    // Non-blocking catch for browser audio safety
  }
}
