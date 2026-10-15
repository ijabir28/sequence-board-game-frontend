import { useEffect, useRef, useState } from 'react';
import type { TeamIndex } from '../../engine/setup';
import { TEAM_STYLES, teamName } from '../../game/teams';
import { formatElapsed, useNow } from '../../game/turnClock';
import type { PlayerView } from '../../game/types';
import { Chip } from '../Chip';
import styles from './TurnPanel.module.css';

interface TurnPanelProps {
  players: PlayerView[];
  currentPlayerId: string | null;
  /** The player whose hand this screen shows. */
  viewer: PlayerView | null;
  /** One shared screen: every turn is someone at this device, so it never says "Your turn". */
  hotSeat: boolean;
  winner: TeamIndex | null;
  turn: number | null;
  turnStartedAt: number | null;
  /** When the turn's timer runs out; null when the game has no timer. */
  turnDeadline: number | null;
}

/** Without a turn timer, a turn this long gets the clock's warning colour. */
const SLOW_TURN_MS = 60_000;
/** With a turn timer, the countdown turns amber, then red and urgent. */
const WARN_MS = 20_000;
const URGENT_MS = 10_000;

/**
 * Whose turn it is, in its own box so it can't be missed: the player and team, a running timer, and the turn
 * order with the current player marked. When it becomes your turn, the box flashes and the tab title says so.
 */
export function TurnPanel({ players, currentPlayerId, viewer, hotSeat, winner, turn, turnStartedAt, turnDeadline }: TurnPanelProps) {
  const current = players.find((p) => p.id === currentPlayerId) ?? null;
  const yours = !hotSeat && current !== null && viewer !== null && current.id === viewer.id;
  const running = winner === null && current !== null && turnStartedAt !== null;
  const now = useNow(running, 500);
  const alerting = useTurnAlert(yours, current?.id ?? null, hotSeat);

  const team = winner ?? current?.team ?? viewer?.team ?? null;
  const style = team !== null ? TEAM_STYLES[team] : null;
  const elapsed = running ? now - turnStartedAt! : 0;
  const counting = running && turnDeadline !== null;
  const left = counting ? Math.max(0, turnDeadline! - now) : 0;
  const total = counting ? Math.max(1, turnDeadline! - turnStartedAt!) : 1;
  const urgency = !counting ? (elapsed >= SLOW_TURN_MS ? 'warn' : null) : left <= URGENT_MS ? 'urgent' : left <= WARN_MS ? 'warn' : null;

  return (
    <section
      className={[styles.panel, yours && styles.yours, alerting && styles.alert, yours && urgency === 'urgent' && styles.hurry]
        .filter(Boolean)
        .join(' ')}
      style={style ? ({ '--turn-team': style.color, '--turn-glow': style.glow } as React.CSSProperties) : undefined}
      aria-label="Turn"
    >
      <div className={styles.main}>
        {team !== null && (
          <span className={styles.chip} aria-hidden="true">
            <Chip team={team} />
          </span>
        )}
        <div className={styles.text}>
          <p className={styles.eyebrow}>{winner !== null ? 'Game over' : turn !== null ? `Turn ${turn}` : 'Turn'}</p>
          <p className={styles.who}>
            {winner !== null ? (
              <>
                <strong>{teamName(winner)}</strong> wins
              </>
            ) : current ? (
              <>
                <strong>{yours ? 'Your turn' : `${current.name}'s turn`}</strong>
                <span className={styles.team}>{teamName(current.team)}</span>
              </>
            ) : viewer ? (
              // The source has no turn order (the legacy server game): say who is playing instead.
              <>
                Playing as <strong>{viewer.name}</strong>
              </>
            ) : (
              'Waiting for the game to start'
            )}
          </p>
        </div>
        {running && (
          <span
            className={[styles.timer, urgency === 'warn' && styles.slow, urgency === 'urgent' && styles.urgent].filter(Boolean).join(' ')}
            role="timer"
            aria-label={counting ? 'Time left this turn' : 'Time on this turn'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 9v4l2.5 2M10 2h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {counting ? (left > 0 ? formatElapsed(left + 999) : "Time's up") : formatElapsed(elapsed)}
          </span>
        )}
      </div>
      {counting && (
        <div className={styles.track} aria-hidden="true">
          <span
            className={[styles.bar, urgency === 'warn' && styles.barWarn, urgency === 'urgent' && styles.barUrgent].filter(Boolean).join(' ')}
            style={{ transform: `scaleX(${left / total})` }}
          />
        </div>
      )}
      {yours && counting && left <= URGENT_MS && (
        <p className={styles.warning} role="alert">
          {left > 0 ? 'Hurry: when time runs out, a random card is played for you.' : 'Time is up: a random card is being played for you.'}
        </p>
      )}
      {players.length > 1 && winner === null && (
        <ol className={styles.order} aria-label="Turn order">
          {players.map((p) => {
            const isCurrent = p.id === currentPlayerId;
            return (
              <li
                key={p.id}
                className={[styles.player, isCurrent && styles.current].filter(Boolean).join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className={styles.playerChip} aria-hidden="true">
                  <Chip team={p.team} />
                </span>
                <span className={styles.playerName}>
                  {p.name}
                  {!hotSeat && viewer?.id === p.id && <span className={styles.you}> (you)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * When it becomes the viewer's turn: flash for a moment, buzz a phone, and put "Your turn" in the tab title
 * until the turn ends, so a player in another tab notices. In hot-seat play the flash marks every new turn.
 */
function useTurnAlert(yours: boolean, currentId: string | null, hotSeat: boolean): boolean {
  const [alerting, setAlerting] = useState(false);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const changed = previous.current !== null && previous.current !== currentId;
    previous.current = currentId;
    if (!changed || !(yours || hotSeat)) return;
    setAlerting(true);
    if (yours) navigator.vibrate?.(200);
    const timer = setTimeout(() => setAlerting(false), 2400);
    return () => clearTimeout(timer);
  }, [currentId, yours, hotSeat]);

  useEffect(() => {
    if (!yours) return;
    const base = document.title;
    document.title = `● Your turn · ${base}`;
    return () => {
      document.title = base;
    };
  }, [yours]);

  return alerting;
}
