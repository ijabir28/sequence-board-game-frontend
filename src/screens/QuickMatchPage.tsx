import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import {
  getQueueStatus,
  joinQueue,
  leaveQueue,
  MATCH_TIMERS,
  type MatchTeams,
  type MatchTimer,
  type QueueStatus,
} from '../api/matchmaking';
import { onMatchFound } from '../api/socket';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { BackToDashboard } from '../components/BackToDashboard';
import { PoweredBy } from '../components/PoweredBy';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { sequencesToWin } from '../engine/setup';
import styles from './Forms.module.css';
import own from './QuickMatchPage.module.css';

/** How often a waiting page asks for its status: it also keeps the player in the queue (the server drops them after 30 s). */
const POLL_MS = 4000;

type Queued = Extract<QueueStatus, { status: 'queued' }>;

type State =
  | { status: 'loading' }
  | { status: 'choose' }
  | { status: 'queued'; queue: Queued | null }
  | { status: 'playing'; roomId: string };

/** "1:05": a duration in whole seconds, as minutes and seconds. */
export function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Quick Match: pick 2 or 3 teams (one player each) and a turn timer, then wait to be seated. The game opens by itself. */
export function QuickMatchPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [teams, setTeams] = useState<MatchTeams>(2);
  const [timer, setTimer] = useState<MatchTimer>('medium');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Set once a table is found, so leaving the page for the game doesn't also leave the queue.
  const seated = useRef(false);
  const queued = state.status === 'queued';

  const openGame = useCallback(
    (roomId: string) => {
      seated.current = true;
      navigate(`/table/${encodeURIComponent(roomId)}/game`);
    },
    [navigate],
  );

  const follow = useCallback(
    (next: QueueStatus) => {
      if (next.status === 'matched') return openGame(next.roomId);
      if (next.status === 'playing') return setState({ status: 'playing', roomId: next.roomId });
      if (next.status === 'queued') {
        setTeams(next.teams);
        setTimer(next.timer);
        return setState({ status: 'queued', queue: next });
      }
      if (next.status === 'matching') return setState((prev) => (prev.status === 'queued' ? prev : { status: 'queued', queue: null }));
      setState({ status: 'choose' });
    },
    [openGame],
  );

  // Where we stand on arrival: maybe still queued from a moment ago, or with a quick match to go back to.
  useEffect(() => {
    getQueueStatus()
      .then(follow)
      .catch(() => setState({ status: 'choose' }));
  }, [follow]);

  // While waiting: check in, hear about the match as soon as it's made, and keep the clocks moving.
  useEffect(() => {
    if (!queued) return;
    const poll = setInterval(() => {
      getQueueStatus()
        .then(follow)
        .catch(() => undefined);
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const unsubscribe = profile ? onMatchFound(profile.handle, openGame) : () => undefined;
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      unsubscribe();
    };
  }, [queued, follow, openGame, profile]);

  // Leaving the page while waiting leaves the queue too.
  useEffect(() => {
    if (!queued) return;
    return () => {
      if (!seated.current) void leaveQueue().catch(() => undefined);
    };
  }, [queued]);

  const find = async () => {
    setBusy(true);
    toast.dismiss('quick-match');
    try {
      setNow(Date.now());
      follow(await joinQueue(teams, timer));
    } catch (e) {
      toast.error(errorMessage(e), { id: 'quick-match' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      follow(await leaveQueue());
    } catch (e) {
      toast.error(errorMessage(e), { id: 'quick-match' });
    } finally {
      setBusy(false);
    }
  };

  const timerLabel = MATCH_TIMERS.find((t) => t.id === timer)!;

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <BackToDashboard className={own.back} tip="Go back to the dashboard" />
        <section className={[styles.card, own.card].join(' ')} aria-labelledby="quick-match-title">
          <header className={styles.header}>
            <h1 id="quick-match-title" className={own.title}>
              <Icon name="bolt" size={26} />
              Quick Match
            </h1>
            <p>Play someone new without sharing a code. Everyone plays on their own team.</p>
          </header>

          {state.status === 'loading' && (
            <p className={styles.help} role="status">
              Checking the queue…
            </p>
          )}

          {state.status === 'playing' && (
            <div className={own.notice}>
              <p>You have a quick match in progress. Finish it before you look for another.</p>
              <Button variant="primary" onClick={() => openGame(state.roomId)} tip="Open the game you're playing">
                Back to your game
              </Button>
            </div>
          )}

          {(state.status === 'choose' || state.status === 'queued') && (
            <fieldset className={styles.fieldset} disabled={queued}>
              <legend>Teams</legend>
              <div className={styles.segmented}>
                {([2, 3] as const).map((n) => (
                  <label
                    key={n}
                    className={styles.segment}
                    {...tipProps(`${n} players, one per team. ${sequencesToWin(n)} sequence${sequencesToWin(n) > 1 ? 's' : ''} to win`, 'top')}
                  >
                    <input type="radio" name="teams" checked={teams === n} onChange={() => setTeams(n)} />
                    <span>{n} teams</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {(state.status === 'choose' || state.status === 'queued') && (
            <fieldset className={styles.fieldset} disabled={queued}>
              <legend>Turn timer</legend>
              <div className={styles.segmented}>
                {MATCH_TIMERS.map((t) => (
                  <label key={t.id} className={styles.segment} {...tipProps(`${t.seconds} seconds a turn`, 'top')}>
                    <input type="radio" name="timer" checked={timer === t.id} onChange={() => setTimer(t.id)} />
                    <span>
                      {t.label} <small className={own.seconds}>{t.seconds}s</small>
                    </span>
                  </label>
                ))}
              </div>
              <p className={styles.help}>Every other setting is the standard one. A quick match is a single round.</p>
            </fieldset>
          )}

          {state.status === 'choose' && (
            <Button variant="primary" className={own.find} busy={busy} onClick={() => void find()} tip="Join the queue for this game">
              <Icon name="bolt" size={18} />
              Find a match
            </Button>
          )}

          {state.status === 'queued' && (
            <Waiting queue={state.queue} now={now} teams={teams} timerLabel={timerLabel.label} busy={busy} onCancel={() => void cancel()} />
          )}

          <p className={own.footer}>
            Quick matches have <Link to="/leaderboard?ladder=matchmaking">a leaderboard of their own</Link>, apart from your
            private tables.
          </p>
        </section>
        <PoweredBy />
      </div>
    </>
  );
}

function Waiting({
  queue,
  now,
  teams,
  timerLabel,
  busy,
  onCancel,
}: {
  queue: Queued | null;
  now: number;
  teams: MatchTeams;
  timerLabel: string;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className={own.waiting} role="status" aria-live="polite">
      <span className={own.pulse} aria-hidden="true" />
      <div className={own.waitingText}>
        <strong>{queue === null ? 'Setting up your table…' : `Looking for ${teams === 2 ? 'an opponent' : 'opponents'}…`}</strong>
        <span>
          {teams} teams · {timerLabel}
          {queue && ` · waiting ${clock(now - queue.joinedAt)}`}
        </span>
      </div>
      <Button size="sm" variant="ghost" busy={busy} onClick={onCancel} tip="Leave the queue">
        <Icon name="close" size={16} />
        Cancel
      </Button>
    </div>
  );
}
