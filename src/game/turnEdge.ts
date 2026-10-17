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

/** The glow starts turning from green to red this long before the turn's time runs out. */
export const EDGE_WARN_MS = 20_000;

/**
 * How far the board's glow has turned from green towards red: 0 until the last EDGE_WARN_MS of a timed turn, then up
 * to 1 when time is up. Untimed turns stay green.
 */
export function turnEdgeHeat({ now, turnDeadline }: { now: number; turnDeadline: number | null }): number {
  if (turnDeadline === null) return 0;
  const left = turnDeadline - now;
  if (left >= EDGE_WARN_MS) return 0;
  return Math.min(1, Math.max(0, 1 - left / EDGE_WARN_MS));
}

/** The glow's colour for a heat from turnEdgeHeat: green (hue 150) through amber to red (hue 0). */
export function turnEdgeColor(heat: number): string {
  const hue = Math.round(150 * (1 - heat));
  return `hsl(${hue} 85% ${55 - 5 * heat}%)`;
}
