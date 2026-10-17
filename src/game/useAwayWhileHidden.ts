import { useEffect, useRef, useState } from 'react';

/**
 * True while the page is hidden and `enabled`: a phone that is locked, or switched to another app. Phones used to
 * freeze a hidden page, which dropped its connection, so the server paused the player's turn. A page that keeps
 * playing sound stays alive when hidden instead, so it has to say it stepped away itself.
 *
 * It must say so at once: a phone may throttle or freeze a hidden page's timers and rendering within moments, so
 * `onHide` is called straight from the visibilitychange event, before anything is left to React's scheduling.
 */
export function useAwayWhileHidden(enabled: boolean, onHide: () => void): boolean {
  const [away, setAway] = useState(false);
  const hide = useRef(onHide);
  hide.current = onHide;
  useEffect(() => {
    if (!enabled) {
      setAway(false);
      return;
    }
    const update = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden) hide.current();
      setAway(hidden);
    };
    // pagehide also fires when a phone puts the page away (for example into its back-forward cache), sometimes while
    // it still reads as visible.
    const pageHide = () => {
      hide.current();
      setAway(true);
    };
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', pageHide);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', pageHide);
    };
  }, [enabled]);
  return away;
}
