/** Without a turn timer, the board's edge thins over this long. */
export const UNTIMED_EDGE_MS = 60_000;

/**
 * How strong the board's turn edge is, from 1 (the turn just started) down to 0 (time is up): the share of the
 * turn's time that is left. Without a timer it fades over UNTIMED_EDGE_MS. Null when there is no turn to show.
 */
export function turnEdgeStrength({
  now,
  turnStartedAt,
  turnDeadline,
}: {
  now: number;
  turnStartedAt: number | null;
  turnDeadline: number | null;
}): number | null {
  if (turnStartedAt === null) return null;
  const total = turnDeadline !== null ? turnDeadline - turnStartedAt : UNTIMED_EDGE_MS;
  const left = turnDeadline !== null ? turnDeadline - now : UNTIMED_EDGE_MS - (now - turnStartedAt);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, left / total));
}
