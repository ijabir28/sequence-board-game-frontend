// The list of toasts on screen, as a pure reducer so it can be tested without rendering.

export type ToastTone = 'error' | 'success' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  tone: ToastTone;
  text: string;
  /** How long it stays, in ms; null stays until dismissed. */
  durationMs: number | null;
  action?: ToastAction;
  /** Bumped when a toast is shown again with the same id, so its timer restarts. */
  version: number;
}

/** Good news goes quickly; errors stay long enough to read twice. */
export const DEFAULT_DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 4000, error: 7000 };

/** Older toasts make way beyond this many. */
export const MAX_TOASTS = 3;

export type ToastEvent = { type: 'show'; toast: Omit<Toast, 'version'> } | { type: 'dismiss'; id: string };

export function toastReducer(toasts: Toast[], event: ToastEvent): Toast[] {
  if (event.type === 'dismiss') return toasts.filter((t) => t.id !== event.id);
  const existing = toasts.find((t) => t.id === event.toast.id);
  // The same id replaces the toast in place (for example the latest message about one form).
  if (existing) return toasts.map((t) => (t.id === event.toast.id ? { ...event.toast, version: t.version + 1 } : t));
  // The same message twice in a row would only stack up: restart the one showing instead.
  const twin = toasts.find((t) => t.text === event.toast.text && t.tone === event.toast.tone);
  if (twin) return toasts.map((t) => (t === twin ? { ...t, version: t.version + 1 } : t));
  return [...toasts, { ...event.toast, version: 0 }].slice(-MAX_TOASTS);
}
