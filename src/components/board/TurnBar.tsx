import { useRef } from 'react';
import { useNow } from '../../game/turnClock';
import { turnEdgeColor, turnEdgeHeat, turnEdgeStrength } from '../../game/turnEdge';
import styles from './Board.module.css';

export interface TurnBarProps {
  turnStartedAt: number | null;
  /** When the turn's time runs out; null when the game has no timer (the bar then runs down over a minute). */
  turnDeadline: number | null;
  /** The turn waits on the player: the bar holds where it was. */
  paused: boolean;
}

/** The bar runs this far outside the board's edge, and is this thick: it hugs the board without covering any cell. */
const BAR_PX = 6;
/** The board's corner radius (--radius-card + 2px, see Board.module.css) plus the bar's offset, so it follows the corners. */
const CORNER_PX = 8 + 2 + BAR_PX / 2;

/**
 * The turn timer, as a progress bar round the board's whole perimeter. When the turn starts the bar runs all the way
 * round, from the top-left corner clockwise and back to it. As time runs down the empty part sweeps clockwise from the
 * top-left corner, eating the bar, which turns from green to red over the last 20 seconds.
 *
 * It keeps its own clock, so the second-by-second ticking re-renders only this bar, never the board or the hand.
 */
export function TurnBar({ turnStartedAt, turnDeadline, paused }: TurnBarProps) {
  const running = !paused && turnStartedAt !== null;
  const now = useNow(running, 1000);
  // A paused turn holds where it was. The bar is keyed by turn, so a new turn starts full again.
  const held = useRef({ strength: 1, heat: 0 });
  if (running) {
    held.current = {
      strength: turnEdgeStrength({ now, turnStartedAt, turnDeadline }) ?? 1,
      heat: turnEdgeHeat({ now, turnDeadline }),
    };
  }
  const { strength, heat } = held.current;

  // A rect's outline starts just after its top-left corner and runs clockwise. With a dash as long as the outline, a
  // negative offset of (1 - strength) leaves only the last `strength` of it: from the sweep point on round to the
  // top-left corner.
  const rect = { x: 0, y: 0, width: '100%', height: '100%', rx: CORNER_PX, pathLength: 1 };
  return (
    <svg
      className={[styles.turnBar, paused && styles.barPaused, heat >= 0.5 && styles.barHot].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={{ '--edge-color': turnEdgeColor(heat), '--bar-px': `${BAR_PX}px` } as React.CSSProperties}
    >
      <rect className={styles.barTrack} {...rect} />
      <rect className={styles.barFill} {...rect} style={{ strokeDashoffset: -(1 - strength) }} />
    </svg>
  );
}
