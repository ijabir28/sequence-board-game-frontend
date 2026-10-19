// Registers the service worker (src/pwa/sw.js) in production builds and tells the page when a newer build's worker is
// waiting. It waits rather than taking over at once: the page that's open was built with the old files, and swapping
// them under it could break a lazy-loaded screen or a hot-seat game in progress. The player reloads when it suits them.

type Listener = () => void;

let waiting: ServiceWorker | null = null;
const listeners = new Set<Listener>();

function found(worker: ServiceWorker) {
  waiting = worker;
  listeners.forEach((listener) => listener());
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Only an update counts: the very first worker has no older page to replace.
        if (registration.waiting && navigator.serviceWorker.controller) found(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) found(worker);
          });
        });
        // An installed app can stay open for days; look for a new build whenever it comes back to the front.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
}

/** Calls `listener` once a new build is ready (straight away if one already is); returns the unsubscribe. */
export function onUpdateReady(listener: Listener): () => void {
  listeners.add(listener);
  if (waiting) listener();
  return () => listeners.delete(listener);
}

/** Switches to the waiting build and reloads the page into it. */
export function applyUpdate() {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
