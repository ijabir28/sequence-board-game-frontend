import { useSyncExternalStore } from 'react';

/*
 * Game sound effects, synthesised with the Web Audio API so there are no audio files to download. Browsers only
 * allow sound after the player has interacted with the page, so the audio context is unlocked on the first tap or key.
 * The player can mute them; the choice is remembered on this device.
 */

const STORAGE_KEY = 'sequence:sound';

let context: AudioContext | null = null;
let muted = loadMuted();
const listeners = new Set<() => void>();

function loadMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

// The first interaction unlocks audio for the rest of the visit.
if (typeof window !== 'undefined') {
  const unlock = () => {
    void audio()?.resume().catch(() => {});
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** One short note: a pitch, a shape, and a quick attack and decay. */
function tone(ctx: AudioContext, { frequency, start, duration, volume, type }: { frequency: number; start: number; duration: number; volume: number; type: OscillatorType }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function play(sound: (ctx: AudioContext, at: number) => void) {
  if (muted) return;
  const ctx = audio();
  // Still locked (no interaction yet) or suspended in a background tab: stay quiet rather than queue sounds up.
  if (!ctx || ctx.state !== 'running') return;
  sound(ctx, ctx.currentTime);
}

/** It's your turn: a bright two-note rising chime. */
export function playTurnChime() {
  play((ctx, at) => {
    tone(ctx, { frequency: 659.25, start: at, duration: 0.22, volume: 0.18, type: 'sine' });
    tone(ctx, { frequency: 987.77, start: at + 0.12, duration: 0.38, volume: 0.18, type: 'sine' });
  });
}

/** One second gone in the last 20: a clock tick, sharper and higher for the final five. */
export function playTick(final: boolean) {
  play((ctx, at) => {
    tone(ctx, { frequency: final ? 1568 : 1046.5, start: at, duration: final ? 0.08 : 0.05, volume: final ? 0.12 : 0.07, type: 'triangle' });
  });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'off' : 'on');
  } catch {
    // Private mode or full storage: the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether game sounds are muted on this device, and a way to change it. */
export function useMuted(): [boolean, (muted: boolean) => void] {
  return [useSyncExternalStore(subscribe, isMuted), setMuted];
}
