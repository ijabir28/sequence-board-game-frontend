import { useEffect, useRef } from 'react';
import { playTick, playTurnChime } from '../../game/sounds';
import { useNow } from '../../game/turnClock';
import { FINAL_TICKS, tickSecond } from '../../game/turnTicks';

interface TurnSoundsProps {
  /** Changes whenever a new turn starts that this device should announce; null when it shouldn't. */
  chimeKey: string | null;
  /** The viewer's own turn is running: the clock ticks over its last 20 seconds. */
  ticking: boolean;
  turnDeadline: number | null;
}

/**
 * Plays the turn sounds: a chime when your turn arrives, and a tick each second over its last 20. It draws nothing and
 * keeps its own clock, so the ticking never re-renders the rest of the game screen.
 */
export function TurnSounds({ chimeKey, ticking, turnDeadline }: TurnSoundsProps) {
  const previousChime = useRef(chimeKey);
  useEffect(() => {
    // Not when the page opens on your turn: only when the turn passes to you.
    if (chimeKey !== null && chimeKey !== previousChime.current) playTurnChime();
    previousChime.current = chimeKey;
  }, [chimeKey]);

  const running = ticking && turnDeadline !== null;
  // A quarter-second clock, so each tick lands close to the second it marks.
  const now = useNow(running, 250);
  const second = running ? tickSecond({ now, turnDeadline }) : null;
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (second !== null && second !== lastTick.current) playTick(second <= FINAL_TICKS);
    lastTick.current = second;
  }, [second]);

  return null;
}
