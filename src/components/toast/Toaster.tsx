import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { DEFAULT_DURATION_MS, toastReducer, type Toast, type ToastAction, type ToastTone } from './toastQueue';
import styles from './Toaster.module.css';

export interface ToastOptions {
  /** Showing another toast with the same id replaces this one (one message per form, say). */
  id?: string;
  /** How long it stays, in ms; null stays until dismissed. Defaults by tone. */
  durationMs?: number | null;
  action?: ToastAction;
}

export interface ToastApi {
  show(tone: ToastTone, text: string, options?: ToastOptions): string;
  success(text: string, options?: ToastOptions): string;
  error(text: string, options?: ToastOptions): string;
  info(text: string, options?: ToastOptions): string;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 0;

/** Floating messages (success, error, info) over the page, so they never push the layout around. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), []);
  const api = useMemo<ToastApi>(() => {
    const show = (tone: ToastTone, text: string, options: ToastOptions = {}) => {
      const id = options.id ?? `toast-${++nextId}`;
      const durationMs = options.durationMs === undefined ? DEFAULT_DURATION_MS[tone] : options.durationMs;
      dispatch({ type: 'show', toast: { id, tone, text, durationMs, action: options.action } });
      return id;
    };
    return {
      show,
      success: (text, options) => show('success', text, options),
      error: (text, options) => show('error', text, options),
      info: (text, options) => show('info', text, options),
      dismiss,
    };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className={styles.viewport} aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

const ICONS = { error: 'alert', success: 'check', info: 'bulb' } as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  // Pointing at or focusing a toast holds it, so it can be read (or its button reached) before it goes.
  const [held, setHeld] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (held || toast.durationMs === null) return;
    const timer = setTimeout(() => dismissRef.current(), toast.durationMs);
    return () => clearTimeout(timer);
  }, [held, toast.durationMs, toast.version]);

  return (
    <div
      className={[styles.toast, styles[toast.tone]].join(' ')}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon name={ICONS[toast.tone]} size={18} />
      </span>
      <p className={styles.text}>{toast.text}</p>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className={styles.close} onClick={onDismiss} aria-label="Dismiss">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
