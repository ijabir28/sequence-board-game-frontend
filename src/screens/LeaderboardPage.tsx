import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api/http';
import {
  getLeaderboard,
  LEADERBOARD_LADDERS,
  LEADERBOARD_PERIODS,
  type LeaderboardEntry,
  type LeaderboardLadder,
  type LeaderboardPage,
  type LeaderboardPeriod,
} from '../api/leaderboard';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { BackToDashboard } from '../components/BackToDashboard';
import { PoweredBy } from '../components/PoweredBy';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import styles from './Forms.module.css';
import own from './LeaderboardPage.module.css';

const PER_PAGE = 20;

const PERIODS: Record<LeaderboardPeriod, { label: string; tip: string; scoreLabel: string; empty: string }> = {
  all: {
    label: 'All time',
    tip: 'Everyone who has won or lost a round, by rating',
    scoreLabel: 'Rating',
    empty: 'No rounds have been won yet. Finish a game and the first names go up here.',
  },
  week: {
    label: 'This week',
    tip: 'Rating gained over the last 7 days',
    scoreLabel: 'Gained',
    empty: 'Nobody has finished a round in the last 7 days.',
  },
  day: {
    label: 'Today',
    tip: 'Rating gained over the last 24 hours',
    scoreLabel: 'Gained',
    empty: 'Nobody has finished a round in the last 24 hours.',
  },
};

const LADDERS: Record<LeaderboardLadder, { label: string; tip: string; intro: string }> = {
  custom: {
    label: 'Private tables',
    tip: 'Rounds played at tables shared with a code',
    intro:
      'Every round won or lost at a private table moves your rating, which starts at 1200. Beating a stronger team earns more than beating a weaker one.',
  },
  matchmaking: {
    label: 'Quick Match',
    tip: 'Quick matches, rated on their own',
    intro:
      'Quick matches have a rating of their own, from 1200, apart from private tables. Forfeiting a match counts as a loss.',
  },
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready'; ladder: LeaderboardLadder } & LeaderboardPage);

function readLadder(value: string | null): LeaderboardLadder {
  return LEADERBOARD_LADDERS.includes(value as LeaderboardLadder) ? (value as LeaderboardLadder) : 'custom';
}

function readPeriod(value: string | null): LeaderboardPeriod {
  return LEADERBOARD_PERIODS.includes(value as LeaderboardPeriod) ? (value as LeaderboardPeriod) : 'all';
}

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** "+16", "−8", "0": a rating change with its sign. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

/** A win rate as a whole percentage: 0.666 → "67%". */
export function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * The leaderboards: private tables' or Quick Match's, each with every rated player by Elo rating, or by the rating
 * gained this week or today. The board, period and page are in the address, so the back button and a shared link land
 * on the same board. The signed-in player's row is highlighted, and pinned under the list when they are on another page.
 */
export function LeaderboardPage() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const ladder = readLadder(params.get('ladder'));
  const period = readPeriod(params.get('period'));
  const page = readPage(params.get('page'));
  const [state, setState] = useState<State>({ status: 'loading' });

  const go = useCallback(
    (next: { ladder?: LeaderboardLadder; period?: LeaderboardPeriod; page?: number }) => {
      const nextLadder = next.ladder ?? ladder;
      const nextPeriod = next.period ?? period;
      const nextPage = next.page ?? 1;
      const query: Record<string, string> = {};
      if (nextLadder !== 'custom') query.ladder = nextLadder;
      if (nextPeriod !== 'all') query.period = nextPeriod;
      if (nextPage > 1) query.page = String(nextPage);
      setParams(query);
    },
    [ladder, period, setParams],
  );

  const load = useCallback(async () => {
    // Keep the current board on screen while the next page loads, so the list doesn't jump.
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    try {
      const result = await getLeaderboard(period, page, PER_PAGE, ladder);
      // A page past the end (the board shrank, or an old link): show the last page that exists.
      if (result.players.length === 0 && page > result.pages) return go({ page: result.pages });
      setState({ status: 'ready', ladder, ...result });
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e) });
    }
  }, [ladder, period, page, go]);

  useEffect(() => {
    void load();
  }, [load]);

  const ready = state.status === 'ready' ? state : null;
  // While another board loads, the one on screen belongs to the previous choice.
  const stale = ready !== null && (ready.ladder !== ladder || ready.period !== period || ready.page !== page);
  const meta = PERIODS[period];
  const you = ready?.you ?? null;
  const youOnPage = you !== null && ready !== null && you.page === ready.page;

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <BackToDashboard className={own.back} tip="Go back to the dashboard: your tables and games" />
        <section className={[styles.card, styles.wide, own.card].join(' ')} aria-labelledby="leaderboard-title">
          <header className={own.top}>
            <div className={styles.header}>
              <h1 id="leaderboard-title" className={own.title}>
                <Icon name="trophy" size={26} />
                Leaderboard
              </h1>
              <p>{LADDERS[ladder].intro}</p>
            </div>
            <div className={own.tabs} role="tablist" aria-label="Board">
              {LEADERBOARD_LADDERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === ladder}
                  aria-controls="leaderboard-list"
                  className={own.tab}
                  onClick={() => key !== ladder && go({ ladder: key })}
                  {...tipProps(LADDERS[key].tip)}
                >
                  {LADDERS[key].label}
                </button>
              ))}
            </div>
            <div className={own.tabs} role="tablist" aria-label="Period">
              {LEADERBOARD_PERIODS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === period}
                  aria-controls="leaderboard-list"
                  className={own.tab}
                  onClick={() => key !== period && go({ period: key })}
                  {...tipProps(PERIODS[key].tip)}
                >
                  {PERIODS[key].label}
                </button>
              ))}
            </div>
          </header>

          {ready && (
            <YourStanding
              you={you}
              period={period}
              signedInName={profile?.name ?? null}
              onShow={you && !youOnPage ? () => go({ page: you.page }) : undefined}
            />
          )}

          <div id="leaderboard-list" role="tabpanel" aria-busy={state.status === 'loading' || stale} className={own.panel}>
            {state.status === 'loading' && (
              <p className={styles.help} role="status">
                Loading the leaderboard…
              </p>
            )}

            {state.status === 'error' && (
              <div className={own.problem}>
                <p className={styles.error} role="alert">
                  <Icon name="alert" size={18} />
                  <span>{state.message}</span>
                </p>
                <Button size="sm" onClick={() => void load()} tip="Load the leaderboard again">
                  Try again
                </Button>
              </div>
            )}

            {ready && ready.players.length === 0 && <p className={styles.help}>{meta.empty}</p>}

            {ready && ready.players.length > 0 && (
              <ol className={[own.list, stale && own.stale].filter(Boolean).join(' ')} aria-label={`${meta.label} leaderboard`}>
                <li className={own.headings} aria-hidden="true">
                  <span>#</span>
                  <span>Player</span>
                  <span className={own.num}>{meta.scoreLabel}</span>
                  <span className={[own.num, own.wide].join(' ')}>W–L</span>
                  <span className={[own.num, own.wide].join(' ')}>Win rate</span>
                </li>
                {ready.players.map((player) => (
                  <Row key={player.handle} player={player} period={ready.period} mine={player.handle === profile?.handle} />
                ))}
                {you && !youOnPage && (
                  <>
                    <li className={own.gap} aria-hidden="true">
                      ⋯
                    </li>
                    <Row player={you} period={ready.period} mine pinned />
                  </>
                )}
              </ol>
            )}
          </div>

          {ready && <Pager page={ready.page} pages={ready.pages} total={ready.total} busy={stale} onPage={(p) => go({ page: p })} />}
        </section>
        <PoweredBy />
      </div>
    </>
  );
}

function Row({ player, period, mine, pinned }: { player: LeaderboardEntry; period: LeaderboardPeriod; mine: boolean; pinned?: boolean }) {
  const top = player.rank <= 3 ? own[`top${player.rank}`] : undefined;
  return (
    <li
      className={[own.row, mine && own.mine, pinned && own.pinned].filter(Boolean).join(' ')}
      aria-current={mine ? 'true' : undefined}
    >
      <span className={[own.rank, top].filter(Boolean).join(' ')} aria-label={`Rank ${player.rank}`}>
        {player.rank}
      </span>
      <span className={own.player}>
        <Avatar name={player.name} handle={player.handle} image={player.image} size={36} />
        <span className={own.who}>
          <span className={own.name}>
            {player.name}
            {mine && <span className={own.youTag}>You</span>}
          </span>
          <span className={own.handle}>@{player.handle}</span>
          <span className={own.narrowStats}>
            {player.won}–{player.lost} · {percent(player.winRate)} won
          </span>
        </span>
      </span>
      <span className={own.num}>
        <span className={own.score}>{period === 'all' ? player.rating : signed(player.score)}</span>
        {period !== 'all' && <span className={own.sub}>{player.rating}</span>}
      </span>
      <span className={[own.num, own.wide].join(' ')} aria-label={`${player.won} won, ${player.lost} lost`}>
        {player.won}–{player.lost}
      </span>
      <span className={[own.num, own.wide].join(' ')}>
        <span className={own.rate}>
          <span className={own.rateBar} style={{ width: percent(player.winRate) }} />
        </span>
        {percent(player.winRate)}
      </span>
    </li>
  );
}

function YourStanding({
  you,
  period,
  signedInName,
  onShow,
}: {
  you: (LeaderboardEntry & { page: number }) | null;
  period: LeaderboardPeriod;
  signedInName: string | null;
  onShow?: () => void;
}) {
  if (!you) {
    return (
      <p className={own.standing}>
        <span className={own.standingText}>
          {signedInName ? `${signedInName}, you're` : "You're"} not on this board yet.{' '}
          {period === 'all' ? 'Finish a round to get your rating.' : `Finish a round ${period === 'week' ? 'this week' : 'today'} to join it.`}
        </span>
      </p>
    );
  }
  return (
    <div className={own.standing} aria-label="Your standing">
      <dl className={own.stats}>
        <div>
          <dt>Rank</dt>
          <dd>#{you.rank}</dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd>{you.rating}</dd>
        </div>
        <div>
          <dt>{period === 'all' ? 'Since start' : 'Gained'}</dt>
          <dd className={you.ratingChange > 0 ? own.up : you.ratingChange < 0 ? own.down : undefined}>{signed(you.ratingChange)}</dd>
        </div>
        <div>
          <dt>Won–lost</dt>
          <dd>
            {you.won}–{you.lost}
          </dd>
        </div>
        <div>
          <dt>Win rate</dt>
          <dd>{percent(you.winRate)}</dd>
        </div>
      </dl>
      {onShow && (
        <Button size="sm" variant="ghost" onClick={onShow} tip={`Go to page ${you.page}, where you are on the board`}>
          Show my position
        </Button>
      )}
    </div>
  );
}

function Pager({ page, pages, total, busy, onPage }: { page: number; pages: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className={own.pager} aria-label="Pages of the leaderboard">
      <Button size="sm" variant="ghost" disabled={page <= 1 || busy} onClick={() => onPage(1)} aria-label="First page" tip="Back to the top of the board">
        <Icon name="chevronUp" size={16} />
        Top
      </Button>
      <Button size="sm" variant="ghost" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)} aria-label="Previous page" tip="Show the players above">
        <Icon name="chevronLeft" size={16} />
        Previous
      </Button>
      <span className={own.position} aria-live="polite">
        Page {page} of {pages} · {total} players
      </span>
      <Button size="sm" variant="ghost" disabled={page >= pages || busy} onClick={() => onPage(page + 1)} aria-label="Next page" tip="Show the players below">
        Next
        <Icon name="chevronRight" size={16} />
      </Button>
    </nav>
  );
}
