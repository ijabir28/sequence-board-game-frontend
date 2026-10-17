import { TEAM_STYLES, teamName } from '../../game/teams';
import type { PlayerStats, RoundResult, RoundsView, SeriesSummary } from '../../game/types';
import type { TeamIndex } from '../../engine/setup';
import { Chip } from '../Chip';
import { tipProps } from '../ui/TooltipLayer';
import styles from './RoundResults.module.css';

/** "45 s", "12 min", "1 h 5 min". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** "Team Green wins the match, 2–1" or "A draw: Team Green and Team Blue won 1 round each". */
export function describeVerdict(summary: SeriesSummary): string {
  const score = summary.teams
    .map((t) => t.roundsWon)
    .sort((a, b) => b - a)
    .join('–');
  if (summary.winner !== null) return `${teamName(summary.winner)} wins the match, ${score}`;
  const each = summary.teams.find((t) => t.team === summary.leaders[0])?.roundsWon ?? 0;
  return `A draw: ${summary.leaders.map(teamName).join(' and ')} won ${plural(each, 'round')} each`;
}

function TeamCell({ team }: { team: TeamIndex }) {
  return (
    <span className={styles.team}>
      <span className={styles.chip} aria-hidden="true">
        <Chip team={team} />
      </span>
      {TEAM_STYLES[team].name}
    </span>
  );
}

interface Column<T> {
  label: string;
  tip: string;
  value: (row: T) => number;
}

const PLAYER_COLUMNS: Column<PlayerStats>[] = [
  { label: 'Played', tip: 'Cards played: chips placed or removed', value: (p) => p.plays },
  { label: 'Wild', tip: 'Two-eyed jacks played (wild: a chip on any open cell)', value: (p) => p.wilds },
  { label: 'Removed', tip: "One-eyed jacks played: opponents' chips taken off", value: (p) => p.removals },
  { label: 'Dead', tip: 'Dead cards exchanged', value: (p) => p.exchanges },
  { label: 'Passes', tip: 'Turns passed with nothing to play', value: (p) => p.passes },
  { label: 'Timed out', tip: 'Moves made for them when their turn timer ran out', value: (p) => p.timedOut },
];

function StatsTable<T>({ caption, rows, first, columns, rowKey }: {
  caption: string;
  rows: T[];
  first: { label: string; cell: (row: T) => React.ReactNode };
  columns: Column<T>[];
  rowKey: (row: T) => string;
}) {
  // The highest value in each column is marked, so the round's standouts are easy to spot.
  const best = columns.map((column) => Math.max(...rows.map(column.value)));
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{first.label}</th>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={styles.number} {...tipProps(column.tip)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              <th scope="row">{first.cell(row)}</th>
              {columns.map((column, i) => {
                const value = column.value(row);
                return (
                  <td key={column.label} className={[styles.number, value > 0 && value === best[i] && styles.best].filter(Boolean).join(' ')}>
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayersTable({ caption, players }: { caption: string; players: PlayerStats[] }) {
  // Teammates sit together, in team order.
  const sorted = [...players].sort((a, b) => a.team - b.team);
  return (
    <StatsTable
      caption={caption}
      rows={sorted}
      rowKey={(p) => p.id}
      first={{
        label: 'Player',
        cell: (p) => (
          <span className={styles.team}>
            <span className={styles.chip} aria-hidden="true">
              <Chip team={p.team} />
            </span>
            {p.name}
          </span>
        ),
      }}
      columns={PLAYER_COLUMNS}
    />
  );
}

/** Rounds won so far by each team, from the won rounds. */
function standings(results: RoundResult[], teamCount: number): number[] {
  const wins = Array.from({ length: teamCount }, () => 0);
  results.forEach((r) => {
    if (r.winner !== null) wins[r.winner]++;
  });
  return wins;
}

function RoundBody({ result, results, playerName }: { result: RoundResult; results: RoundResult[]; playerName: (id: string) => string }) {
  const { stats } = result;
  const teamCount = stats?.teams.length ?? 2;
  const wins = standings(results, teamCount);
  const facts = [
    stats && plural(stats.turns, 'turn'),
    result.durationMs !== null && formatDuration(result.durationMs),
    stats && `${playerName(stats.firstPlayerId)} moved first`,
  ].filter(Boolean);
  return (
    <div className={styles.body}>
      <div className={styles.headline}>
        {result.winner !== null && (
          <span className={styles.bigChip} aria-hidden="true">
            <Chip team={result.winner} />
          </span>
        )}
        <div>
          <p className={styles.verdict}>{result.winner !== null ? `${teamName(result.winner)} won round ${result.round}` : `Round ${result.round}`}</p>
          {facts.length > 0 && <p className={styles.facts}>{facts.join(' · ')}</p>}
        </div>
      </div>
      {results.length > 1 && (
        <p className={styles.standings}>
          <span className={styles.standingsLabel}>Rounds won so far</span>
          {wins.map((count, team) => (
            <span key={team} className={styles.team}>
              <span className={styles.chip} aria-hidden="true">
                <Chip team={team as TeamIndex} />
              </span>
              {TEAM_STYLES[team as TeamIndex].name} {count}
            </span>
          ))}
        </p>
      )}
      {stats ? (
        <>
          <StatsTable
            caption="Teams"
            rows={stats.teams}
            rowKey={(t) => String(t.team)}
            first={{ label: 'Team', cell: (t) => <TeamCell team={t.team} /> }}
            columns={[
              { label: 'Seq.', tip: 'Sequences completed', value: (t) => t.sequences },
              { label: 'Chips', tip: 'Chips on the board when the round ended', value: (t) => t.chips },
              { label: 'Placed', tip: 'Chips put down, wild jacks included', value: (t) => t.placed },
              { label: 'Removed', tip: "Opponents' chips taken off", value: (t) => t.removed },
            ]}
          />
          <PlayersTable caption="Players" players={stats.players} />
        </>
      ) : (
        <p className={styles.facts}>This round was won before the game kept statistics.</p>
      )}
    </div>
  );
}

function SeriesBody({ summary, results }: { summary: SeriesSummary; results: RoundResult[] }) {
  return (
    <div className={styles.body}>
      <div className={styles.headline}>
        {summary.winner !== null && (
          <span className={styles.bigChip} aria-hidden="true">
            <Chip team={summary.winner} />
          </span>
        )}
        <div>
          <p className={styles.verdict}>{describeVerdict(summary)}</p>
          <p className={styles.facts}>
            {plural(summary.roundsPlayed, 'round')} · {plural(summary.turns, 'turn')} in all
          </p>
        </div>
      </div>
      <ol className={styles.roundList} aria-label="Every round">
        {results.map((r) => (
          <li key={r.round}>
            <span className={styles.roundNumber}>Round {r.round}</span>
            {r.winner !== null ? <TeamCell team={r.winner} /> : <span>No winner</span>}
            <span className={styles.facts}>
              {[r.stats && plural(r.stats.turns, 'turn'), r.durationMs !== null && formatDuration(r.durationMs)].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
      <StatsTable
        caption="Teams, every round"
        rows={summary.teams}
        rowKey={(t) => String(t.team)}
        first={{ label: 'Team', cell: (t) => <TeamCell team={t.team} /> }}
        columns={[
          { label: 'Rounds', tip: 'Rounds won', value: (t) => t.roundsWon },
          { label: 'Seq.', tip: 'Sequences completed', value: (t) => t.sequences },
          { label: 'Placed', tip: 'Chips put down, wild jacks included', value: (t) => t.placed },
          { label: 'Removed', tip: "Opponents' chips taken off", value: (t) => t.removed },
        ]}
      />
      {summary.players.length > 0 && <PlayersTable caption="Players, every round" players={summary.players} />}
    </div>
  );
}

interface RoundResultsProps {
  rounds: RoundsView;
  /** A player's display name, for "who moved first". */
  playerName: (id: string) => string;
}

/** The latest won round's statistics, or once the host ended the rounds, the final result of them all. */
export function RoundResults({ rounds, playerName }: RoundResultsProps) {
  if (rounds.over && rounds.summary) return <SeriesBody summary={rounds.summary} results={rounds.results} />;
  const latest = rounds.results.at(-1);
  if (!latest) return <p className={styles.facts}>No round has been won yet.</p>;
  return <RoundBody result={latest} results={rounds.results} playerName={playerName} />;
}
