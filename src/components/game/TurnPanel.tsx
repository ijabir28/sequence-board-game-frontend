import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { TeamIndex } from '../../engine/setup';
import { TEAM_STYLES, teamName } from '../../game/teams';
import { formatElapsed, useNow } from '../../game/turnClock';
import type { PlayerView } from '../../game/types';
import { Chip } from '../Chip';
import { Icon } from '../ui/Icon';
import { tipProps } from '../ui/TooltipLayer';
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
  /** The current player left the table, so the game waits on their turn. */
  turnPaused?: boolean;
  /** While paused: the time the current player will have when they're back (ms). */
  turnTimeLeft?: number | null;
  /** Ids of the players who aren't at the table. */
  away?: string[];
  /**
   * Phones: the panel folds into one line (your countdown on your turn, else whose turn it is) and expands on
   * request, showing `children` (the scoreboard) too.
   */
  collapsible?: { open: boolean; onToggle: () => void; children?: ReactNode };
}

/** Without a turn timer, a turn this long gets the clock's warning colour. */
const SLOW_TURN_MS = 60_000;
/** With a turn timer, the countdown turns amber, then red and urgent. */
const WARN_MS = 20_000;
const URGENT_MS = 10_000;

/**
 * Whose turn it is, in its own box so it can't be missed: the player and team, the time left on your own turn (the
 * board's glow shows it too, in place of a clock bar), and the turn order with the current player marked. When it becomes your turn, the box flashes and the tab title says so.
 */
export function TurnPanel({
  players,
  currentPlayerId,
  viewer,
  hotSeat,
  winner,
  turn,
  turnStartedAt,
  turnDeadline,
  turnPaused = false,
  turnTimeLeft = null,
  away = [],
  collapsible,
}: TurnPanelProps) {
  const detailsId = useId();
  const current = players.find((p) => p.id === currentPlayerId) ?? null;
  const yours = !hotSeat && current !== null && viewer !== null && current.id === viewer.id;
  // The clock is for the player who has to beat it: only on your own turn (in hot-seat play, the person at the
  // device always has the turn). Everyone else just sees whose turn it is.
  const ownTurn = yours || (hotSeat && current !== null);
  // The current player left the table: everyone sees that the game waits for them, and nobody's clock runs.
  const paused = winner === null && current !== null && turnPaused;
  const running = winner === null && current !== null && turnStartedAt !== null && ownTurn && !paused;
  const now = useNow(running, 500);
  const alerting = useTurnAlert(yours, current?.id ?? null, hotSeat);

  const team = winner ?? current?.team ?? viewer?.team ?? null;
  const style = team !== null ? TEAM_STYLES[team] : null;
  const elapsed = running ? now - turnStartedAt! : 0;
  const counting = running && turnDeadline !== null;
  const left = counting ? Math.max(0, turnDeadline! - now) : 0;
  const urgency = !counting ? (elapsed >= SLOW_TURN_MS ? 'warn' : null) : left <= URGENT_MS ? 'urgent' : left <= WARN_MS ? 'warn' : null;

  const className = [styles.panel, yours && styles.yours, paused && styles.paused, alerting && styles.alert, yours && urgency === 'urgent' && styles.hurry]
    .filter(Boolean)
    .join(' ');
  const teamStyle = style ? ({ '--turn-team': style.color, '--turn-glow': style.glow } as React.CSSProperties) : undefined;
  const timer = running && (
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
  );
  const pausedTimer = paused && (
    <span className={[styles.timer, styles.pausedTimer].join(' ')} role="timer" aria-label="Turn paused">
      <Icon name="pause" size={14} />
      Paused{turnTimeLeft !== null && ` · ${formatElapsed(turnTimeLeft + 999)}`}
    </span>
  );
  // On your own turn a pause means your page isn't counted at the table: a menu is open, or it is reconnecting.
  const pausedText = !paused
    ? null
    : yours
      ? 'Your turn is paused until you are back at the board.'
      : `${current!.name} is not at the table. The game is paused until they come back.`;
  const pausedNotice = pausedText && (
    <p className={styles.awayNotice} role="status">
      <Icon name="wifiOff" size={16} />
      <span>{pausedText}</span>
    </p>
  );

  // Folded (phones): one line. Your turn shows your countdown; otherwise just whose turn it is.
  if (collapsible && !collapsible.open) {
    return (
      <section className={[className, styles.folded].join(' ')} style={teamStyle} aria-label="Turn">
        <button
          type="button"
          className={styles.summary}
          aria-expanded={false}
          aria-controls={detailsId}
          onClick={collapsible.onToggle}
          {...tipProps('Show the turn details, turn order and scores')}
        >
          {team !== null && (
            <span className={styles.summaryChip} aria-hidden="true">
              <Chip team={team} />
            </span>
          )}
          <span className={styles.summaryText}>
            {winner !== null
              ? `${teamName(winner)} wins`
              : current
                ? paused && !yours
                  ? `${current.name} is away`
                  : yours
                    ? 'Your turn'
                    : `${current.name}'s turn`
                : 'Waiting for the game to start'}
          </span>
          {timer}
          {pausedTimer}
          <Icon name="chevronDown" size={18} />
          <span className="visually-hidden">Show turn details and scores</span>
        </button>
        {pausedNotice && <div className={styles.foldedNotice}>{pausedNotice}</div>}
      </section>
    );
  }

  return (
    <section className={className} style={teamStyle} aria-label="Turn" id={detailsId}>
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
        {timer}
        {pausedTimer}
        {collapsible && (
          <button
            type="button"
            className={styles.fold}
            aria-expanded={true}
            aria-controls={detailsId}
            onClick={collapsible.onToggle}
            {...tipProps('Fold the turn details back to one line', 'bottom', 'end')}
          >
            <Icon name="chevronUp" size={18} />
            <span className="visually-hidden">Hide turn details and scores</span>
          </button>
        )}
      </div>
      {pausedNotice}
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
                  {!hotSeat && viewer?.id === p.id && <span className={styles.you}> (You)</span>}
                </span>
                {away.includes(p.id) && <span className={styles.awayTag}>away</span>}
              </li>
            );
          })}
        </ol>
      )}
      {collapsible?.children}
    </section>
  );
}

/**
 * When it becomes the viewer's turn: flash for a moment and put "Your turn" in the tab title until the turn ends, so
 * a player in another tab notices. In hot-seat play the flash marks every new turn. (The chime and the phone's buzz
 * come from TurnSounds.)
 */
function useTurnAlert(yours: boolean, currentId: string | null, hotSeat: boolean): boolean {
  const [alerting, setAlerting] = useState(false);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const changed = previous.current !== null && previous.current !== currentId;
    previous.current = currentId;
    if (!changed || !(yours || hotSeat)) return;
    setAlerting(true);
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
