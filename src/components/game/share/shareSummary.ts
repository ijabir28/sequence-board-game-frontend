import type { Pos } from '../../../engine/board';
import type { Sequence } from '../../../engine/sequences';
import type { TeamIndex } from '../../../engine/setup';
import { TEAM_STYLES, teamName } from '../../../game/teams';
import type { CellView, GameView } from '../../../game/types';
import { describeVerdict, formatDuration } from '../RoundResults';

/** Everything the share image shows of a finished game, worked out from the game's view. */
export interface ShareSummary {
  /** The table's name, or the kind of game ("Hot-seat"). */
  title: string;
  /** "Team Green wins", "Team Green wins round 2", "Team Green wins the match, 2–1" or a draw. */
  headline: string;
  /** The winning team's players, e.g. "Asha & Ben"; null for a draw. */
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
  const headline = series ? describeVerdict(series) : rounds ? `${teamName(view.winner)} wins round ${rounds.round}` : `${teamName(view.winner)} wins`;

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

  // The winning move: the last chip placed or removed.
  let lastMove: Pos | null = null;
  for (let i = view.log.length - 1; i >= 0 && lastMove === null; i--) {
    const entry = view.log[i];
    if (entry.kind === 'place' || entry.kind === 'remove') lastMove = entry.pos;
  }

  return {
    title: view.title ?? options.modeLabel,
    headline,
    subline: winner === null ? null : names(playersOf(winner)) || null,
    winner,
    viewerWon: !options.hotSeat && view.viewer !== null && winner !== null && view.viewer.team === winner,
    round: rounds && !series ? rounds.round : null,
    teams,
    facts,
    board: view.board,
    sequences: view.sequences,
    lastMove,
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

/** "sequence-team-green-wins-2026-10-20.png". */
export function shareFileName(summary: ShareSummary, now: Date = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  const who = summary.winner === null ? 'draw' : `team-${TEAM_STYLES[summary.winner].name.toLowerCase()}-wins`;
  return `sequence-${who}-${day}.png`;
}
