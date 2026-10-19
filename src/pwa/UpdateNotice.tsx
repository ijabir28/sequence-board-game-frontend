import { useEffect } from 'react';
import { useToast } from '../components/toast/Toaster';
import { applyUpdate, onUpdateReady } from './serviceWorker';

/** Offers to reload into a new build once its service worker is ready. Renders nothing itself. */
export function UpdateNotice() {
  const toast = useToast();
  useEffect(
    () =>
      onUpdateReady(() =>
        toast.info('A new version of Sequence is ready.', {
          id: 'app-update',
          durationMs: null,
          action: { label: 'Reload', onClick: applyUpdate },
        }),
      ),
    [toast],
  );
  return null;
}
