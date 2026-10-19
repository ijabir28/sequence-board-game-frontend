import { useSyncExternalStore } from 'react';

// "Install app": Chrome, Edge and Android fire beforeinstallprompt once the manifest and service worker qualify, and
// the page may show the browser's install dialog later, from a click. iOS has no such event; there the app is
// installed from Safari's Share menu, so the page can only say how.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Call before the app renders: the event can fire as soon as the page loads. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's own mini-infobar away; the account menu offers it instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone and iPad (iPadOS reports itself as a Mac with a touch screen). */
function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Where the Add to Home Screen item is in this iOS browser. Chrome and Edge have had it since iOS 16.4. */
function iosSteps(): string {
  const ua = navigator.userAgent;
  if (/CriOS|EdgiOS/.test(ua)) return 'Tap the Share button in the address bar, then Add to Home Screen.';
  if (/FxiOS/.test(ua)) return 'Open the menu, tap Share, then Add to Home Screen.';
  return 'Tap Share at the bottom of Safari, then Add to Home Screen.';
}

export type InstallOption = { kind: 'prompt'; install: () => Promise<void> } | { kind: 'ios'; steps: string } | null;

/** How this browser can install the app, or null if it can't or it already is installed. */
export function useInstallOption(): InstallOption {
  const prompt = useSyncExternalStore(subscribe, () => deferred);
  if (isStandalone()) return null;
  if (prompt) {
    return {
      kind: 'prompt',
      install: async () => {
        await prompt.prompt();
        // The event can be used once, whatever the player chose.
        await prompt.userChoice.catch(() => undefined);
        deferred = null;
        notify();
      },
    };
  }
  return isIos() ? { kind: 'ios', steps: iosSteps() } : null;
}
