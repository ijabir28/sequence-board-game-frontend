import { useSyncExternalStore } from 'react';

/*
 * Game sound effects, synthesised with the Web Audio API so there are no audio files to download. Browsers only
 * allow sound after the player has interacted with the page, so the audio context is unlocked by a tap or key (and
 * unlocked again after a phone suspends it).
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

/*
 * Unlocking, so it works on phones too:
 * - A touch's pointerdown is not a "user activation" (only a mouse's is), so phones never unlocked on it. Touch
 *   browsers count touchend, pointerup and click, so listen for those as well.
 * - iOS Safari only really starts the context when a sound is played inside the gesture, so play a silent one.
 * - Phones suspend or interrupt the context when the tab is hidden, the screen locks or a call comes in, and don't
 *   restart it themselves. So the listeners stay: any later tap resumes a context that isn't running.
 */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

function unlock() {
  const ctx = audio();
  if (!ctx || ctx.state === 'running') return;
  void ctx.resume().catch(() => {});
  try {
    const silence = ctx.createBufferSource();
    silence.buffer = ctx.createBuffer(1, 1, 22050);
    silence.connect(ctx.destination);
    silence.start(0);
  } catch {
    // Not every browser lets a source start before the context runs; resume() alone is enough for those.
  }
}

if (typeof window !== 'undefined') {
  UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));
  // Back from another tab or a locked screen: some browsers allow resuming without a new gesture.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && context && context.state !== 'running') void context.resume().catch(() => {});
  });
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
  // Never create the context here: outside a gesture it would start locked. It comes from the first tap (unlock).
  const ctx = context;
  if (!ctx) return;
  if (ctx.state === 'running') {
    sound(ctx, ctx.currentTime);
    return;
  }
  // Suspended since (a phone that locked its screen, say): once the page has had a tap, browsers let it resume
  // without a new one. Play then, unless it took too long to still mean anything; a locked one stays quiet.
  const asked = Date.now();
  ctx
    .resume()
    .then(() => {
      if (ctx.state === 'running' && Date.now() - asked < 500) sound(ctx, ctx.currentTime);
    })
    .catch(() => {});
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
