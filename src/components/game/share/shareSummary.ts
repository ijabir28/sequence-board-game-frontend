import type { Pos } from '../../../engine/board';
import type { Sequence } from '../../../engine/sequences';
import type { TeamIndex } from '../../../engine/setup';
import { TEAM_STYLES, teamName } from '../../../game/teams';
import type { CellView, GameView, PlayerView, RoundDetail } from '../../../game/types';
import type { LogEntry } from '../../../engine/game';
import { describeVerdict, formatDuration } from '../RoundResults';

/** Everything the share image shows of a finished game, worked out from the game's view. */
export interface ShareSummary {
  /** The table's name, or the kind of game ("Hot-seat"). */
  title: string;
  /**
   * In the sharer's own words when their team won ("I just won a Sequence match!", "I just won round 2!"), otherwise
   * "Team Green wins", "Team Green wins round 2", "Team Green wins the match, 2–1" or a draw.
   */
  headline: string;
  /** The winning team's players, e.g. "Asha & Ben" (after the team's name when the headline is "I won"); null for a draw. */
  subline: string | null;
  winner: TeamIndex | null;
  /** The player sharing is on the winning team (never in hot-seat play, where the device is everyone's). */
  viewerWon: boolean;
  /** The round just won, while more may follow; null once the whole game or match is decided. */
  round: number | null;
  teams: ShareTeam[];
  /** A few headline numbers: rounds, turns, how long it took, the date. */
  facts: { label: string; value: string }[];
  board: CellView[][];
  sequences: Sequence[];
  /** The winning move, ringed as the last move is during play. */
  lastMove: Pos | null;
}

export interface ShareTeam {
  team: TeamIndex;
  name: string;
  players: string[];
  /** Rounds won over a match of rounds, otherwise sequences completed. */
  score: number;
  scoreLabel: string;
  won: boolean;
}

function names(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} & ${list.at(-1)}`;
}

function sum(values: (number | null)[]): number | null {
  return values.every((v): v is number => v !== null) ? values.reduce((a, b) => a + b, 0) : null;
}

/** The winning move: the last chip placed or removed. */
function lastMoveOf(log: LogEntry[]): Pos | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.kind === 'place' || entry.kind === 'remove') return entry.pos;
  }
  return null;
}

/**
 * The headline and the line under it. A sharer whose team won says so in their own words; hot-seat play never does,
 * since the device is everyone's and "I" would be nobody in particular.
 */
function whoWon(
  winner: TeamIndex | null,
  { players, viewer, hotSeat, round, teamHeadline }: { players: PlayerView[]; viewer: PlayerView | null; hotSeat?: boolean; round: number | null; teamHeadline: string },
) {
  const winners = winner === null ? '' : names(players.filter((p) => p.team === winner).map((p) => p.name));
  const viewerWon = !hotSeat && viewer !== null && winner !== null && viewer.team === winner;
  if (!viewerWon) return { viewerWon, headline: teamHeadline, subline: winners || null };
  return {
    viewerWon,
    headline: round !== null ? `I just won round ${round}!` : 'I just won a Sequence match!',
    subline: [teamName(winner!), winners].filter(Boolean).join(' · '),
  };
}

/** "20 Oct 2026". */
export function formatShareDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The share card for a finished game, or null while nobody has won. A table whose host has ended the rounds shares
 * the whole match; a round just won shares that round; other games share the game.
 *
 * `playedMs` is how long the game took when the screen measured it itself (hot-seat games are never saved, so they
 * are timed from the start); table games carry their own round times.
 */
export function buildShareSummary(
  view: GameView,
  options: { modeLabel: string; hotSeat?: boolean; playedMs?: number | null; now?: Date },
): ShareSummary | null {
  if (view.winner === null) return null;
  const rounds = view.rounds ?? null;
  const series = rounds?.over && rounds.summary ? rounds.summary : null;
  const latest = rounds?.results.at(-1) ?? null;
  const playersOf = (team: TeamIndex) => view.players.filter((p) => p.team === team).map((p) => p.name);

  const winner = series ? series.winner : view.winner;
  const round = rounds && !series ? rounds.round : null;
  const teamHeadline = series ? describeVerdict(series) : round !== null ? `${teamName(view.winner)} wins round ${round}` : `${teamName(view.winner)} wins`;

  const teams: ShareTeam[] = series
    ? series.teams.map((t) => ({
        team: t.team,
        name: teamName(t.team),
        players: playersOf(t.team),
        score: t.roundsWon,
        scoreLabel: t.roundsWon === 1 ? 'round won' : 'rounds won',
        won: series.winner === t.team,
      }))
    : view.teams.map((t) => ({
        team: t.index,
        name: teamName(t.index),
        players: playersOf(t.index),
        score: t.sequences,
        scoreLabel: t.sequences === 1 ? 'sequence' : 'sequences',
        won: view.winner === t.index,
      }));

  const durationMs = series ? sum(rounds!.results.map((r) => r.durationMs)) : rounds ? (latest?.durationMs ?? null) : (options.playedMs ?? null);
  const turns = series ? series.turns : view.turn;
  const facts: ShareSummary['facts'] = [];
  if (series) facts.push({ label: 'Rounds', value: String(series.roundsPlayed) });
  else if (rounds) facts.push({ label: 'Round', value: String(rounds.round) });
  if (turns !== null && turns > 0) facts.push({ label: 'Turns', value: String(turns) });
  if (durationMs !== null && durationMs > 0) facts.push({ label: 'Duration', value: formatDuration(durationMs) });
  facts.push({ label: 'Played', value: formatShareDate(options.now ?? new Date()) });

  return {
    title: view.title ?? options.modeLabel,
    ...whoWon(winner, { players: view.players, viewer: view.viewer, hotSeat: options.hotSeat, round, teamHeadline }),
    winner,
    round,
    teams,
    facts,
    board: view.board,
    sequences: view.sequences,
    lastMove: lastMoveOf(view.log),
  };
}

/**
 * The share card for one round of a table, looked back on from the final results: its board as it ended, the
 * sequences each team made in it, and its turns and time. Its date isn't known, so the card leaves it out.
 */
export function buildRoundShareSummary(
  detail: RoundDetail,
  options: { title: string; players: PlayerView[]; viewer: PlayerView | null; hotSeat?: boolean },
): ShareSummary {
  const { result } = detail;
  const winner = result.winner;
  const teamIndexes = result.stats
    ? result.stats.teams.map((t) => t.team)
    : [...new Set(options.players.map((p) => p.team))].sort((a, b) => a - b);
  const sequencesOf = (team: TeamIndex) =>
    result.stats?.teams.find((t) => t.team === team)?.sequences ?? detail.sequences.filter((s) => s.team === team).length;
  const teams: ShareTeam[] = teamIndexes.map((team) => {
    const score = sequencesOf(team);
    return {
      team,
      name: teamName(team),
      players: options.players.filter((p) => p.team === team).map((p) => p.name),
      score,
      scoreLabel: score === 1 ? 'sequence' : 'sequences',
      won: winner === team,
    };
  });
  const facts: ShareSummary['facts'] = [{ label: 'Round', value: String(result.round) }];
  if (result.stats && result.stats.turns > 0) facts.push({ label: 'Turns', value: String(result.stats.turns) });
  if (result.durationMs !== null && result.durationMs > 0) facts.push({ label: 'Duration', value: formatDuration(result.durationMs) });
  const teamHeadline = winner === null ? `Round ${result.round}` : `${teamName(winner)} wins round ${result.round}`;
  return {
    title: options.title,
    ...whoWon(winner, { ...options, round: result.round, teamHeadline }),
    winner,
    round: result.round,
    teams,
    facts,
    board: detail.board,
    sequences: detail.sequences,
    lastMove: lastMoveOf(detail.log),
  };
}

/** What goes with the image when it is shared: one line, in the sharer's own words when they won, then where to play. */
export function shareText(summary: ShareSummary, url: string): string {
  if (summary.viewerWon) {
    const what = summary.round !== null ? `round ${summary.round} of a Sequence match` : 'a Sequence match';
    return `I just won ${what}! 🏆 Play at ${url}`;
  }
  return `${summary.headline} at Sequence. Play at ${url}`;
}

/** "sequence-team-green-wins-2026-10-20.png", or "sequence-round-2-team-green-wins-…" for a round. */
export function shareFileName(summary: ShareSummary, now: Date = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  const who = summary.winner === null ? 'draw' : `team-${TEAM_STYLES[summary.winner].name.toLowerCase()}-wins`;
  return `sequence-${summary.round !== null ? `round-${summary.round}-` : ''}${who}-${day}.png`;
}
