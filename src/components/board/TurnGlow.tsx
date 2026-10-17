import { useRef } from 'react';
import { useNow } from '../../game/turnClock';
import { turnEdgeColor, turnEdgeHeat, turnEdgeStrength } from '../../game/turnEdge';
import styles from './Board.module.css';

export interface TurnGlowProps {
  turnStartedAt: number | null;
  /** When the turn's time runs out; null when the game has no timer (the glow then runs down over a minute). */
  turnDeadline: number | null;
  /** The turn waits on the player: the glow holds where it was. */
  paused: boolean;
}

/** Corner radius of the glow's path, in the board's 0–100 units, so it follows the board's rounded corners. */
const R = 3;
// From the middle of the top edge, clockwise round the board and back.
const PATH = `M50 0H${100 - R}A${R} ${R} 0 0 1 100 ${R}V${100 - R}A${R} ${R} 0 0 1 ${100 - R} 100H${R}A${R} ${R} 0 0 1 0 ${100 - R}V${R}A${R} ${R} 0 0 1 ${R} 0Z`;

/**
 * The turn timer, drawn as a glow round the outside of the board. It starts as a full green ring at the top centre and
 * shrinks back along the board's edge as time runs down, turning from green to red over the last 20 seconds.
 *
 * It keeps its own clock, so the second-by-second ticking re-renders only this ring, never the board or the hand.
 */
export function TurnGlow({ turnStartedAt, turnDeadline, paused }: TurnGlowProps) {
  const running = !paused && turnStartedAt !== null;
  const now = useNow(running, 1000);
  // A paused turn holds where it was. The ring is keyed by turn, so a new turn starts full again.
  const held = useRef({ strength: 1, heat: 0 });
  if (running) {
    held.current = {
      strength: turnEdgeStrength({ now, turnStartedAt, turnDeadline }) ?? 1,
      heat: turnEdgeHeat({ now, turnDeadline }),
    };
  }
  const { strength, heat } = held.current;

  return (
    <svg
      className={[styles.turnGlow, paused && styles.glowPaused, heat >= 0.5 && styles.glowHot].filter(Boolean).join(' ')}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ '--edge-color': turnEdgeColor(heat) } as React.CSSProperties}
    >
      <path className={styles.glowTrack} d={PATH} vectorEffect="non-scaling-stroke" />
      <path className={styles.glowHalo} d={PATH} pathLength={1} style={{ strokeDashoffset: 1 - strength }} vectorEffect="non-scaling-stroke" />
      <path className={styles.glowLine} d={PATH} pathLength={1} style={{ strokeDashoffset: 1 - strength }} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
