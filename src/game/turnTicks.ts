/** The clock ticks once a second over the last this-long of a timed turn. */
export const TICK_FROM_MS = 20_000;
/** The last few ticks are sharper. */
export const FINAL_TICKS = 5;

/**
 * Which tick is due: the whole seconds left on the turn (rounded up, as the countdown shows them) while that is within
 * the last 20 seconds and above zero, else null. A new number means a tick is due.
 */
export function tickSecond({ now, turnDeadline }: { now: number; turnDeadline: number | null }): number | null {
  if (turnDeadline === null) return null;
  const left = turnDeadline - now;
  if (left <= 0 || left > TICK_FROM_MS) return null;
  return Math.ceil(left / 1000);
}
