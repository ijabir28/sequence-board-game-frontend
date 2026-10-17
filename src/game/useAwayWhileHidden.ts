import { useEffect, useState } from 'react';

/** As long as the server waits for a dropped connection before counting a player as gone (presence.js). */
export const HIDDEN_AWAY_MS = 4000;

/**
 * True once the page has been hidden for HIDDEN_AWAY_MS while `enabled`: a phone that is locked, or switched to
 * another app. Phones used to freeze a hidden page, which dropped its connection, so the server paused the player's
 * turn. A page that keeps playing sound stays alive when hidden instead, so it has to say it stepped away itself.
 */
export function useAwayWhileHidden(enabled: boolean): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setAway(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'hidden') timer = setTimeout(() => setAway(true), HIDDEN_AWAY_MS);
      else setAway(false);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled]);
  return away;
}
