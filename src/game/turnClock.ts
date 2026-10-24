import { useEffect, useState } from 'react';

/** "0:07", "12:30", "1:02:03". Negative times (clock jitter) read as 0:00. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * The current time, updated every `intervalMs` while `active` and the page is visible. A hidden page shows nothing,
 * so its clock stops rather than re-render the table several times a second for no one; it catches up on coming back.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;
    const follow = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(timer);
        timer = undefined;
      } else if (timer === undefined) {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), intervalMs);
      }
    };
    follow();
    document.addEventListener('visibilitychange', follow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', follow);
    };
  }, [active, intervalMs]);
  return now;
}
