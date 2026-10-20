import { ApiError, UNREADABLE_RESPONSE, readJson, request } from './http';

// The leaderboard, GET /user/leaderboard on the backend (see its docs/api.md). Ratings are team Elo from 1200, changed
// by every round won; the weekly and daily boards rank by the rating gained in the last 7 days / 24 hours.

export type LeaderboardPeriod = 'all' | 'week' | 'day';

export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = ['all', 'week', 'day'];

export interface LeaderboardEntry {
  /** Shared by players tied on score. */
  rank: number;
  /** 1, 2, 3… down the board, ties included. */
  position: number;
  handle: string;
  name: string;
  image: string | null;
  /** What the board ranks by: the rating all time, the rating gained in the period otherwise. */
  score: number;
  rating: number;
  /** Since the starting 1200 all time; gained in the period otherwise. */
  ratingChange: number;
  played: number;
  won: number;
  lost: number;
  /** won / played, 0 to 1. */
  winRate: number;
}

export interface LeaderboardPage {
  period: LeaderboardPeriod;
  players: LeaderboardEntry[];
  /** The signed-in player's entry and the page it is on, or null when they aren't on this board. */
  you: (LeaderboardEntry & { page: number }) | null;
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

function int(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

export function sanitizeEntry(raw: Record<string, unknown>): LeaderboardEntry {
  const played = Math.max(0, int(raw.played));
  const won = Math.min(played, Math.max(0, int(raw.won)));
  const rating = int(raw.rating, 1200);
  const winRate = typeof raw.win_rate === 'number' && Number.isFinite(raw.win_rate) ? raw.win_rate : played ? won / played : 0;
  return {
    rank: Math.max(1, int(raw.rank, 1)),
    position: Math.max(1, int(raw.position, 1)),
    handle: String(raw.handle ?? ''),
    name: typeof raw.name === 'string' && raw.name ? raw.name : String(raw.handle ?? ''),
    image: typeof raw.image === 'string' ? raw.image : null,
    score: int(raw.score, rating),
    rating,
    ratingChange: int(raw.rating_change),
    played,
    won,
    lost: played - won,
    winRate: Math.min(1, Math.max(0, winRate)),
  };
}

export function sanitizeLeaderboard(raw: Record<string, unknown>, period: LeaderboardPeriod): LeaderboardPage {
  const players = Array.isArray(raw.players) ? (raw.players as Record<string, unknown>[]).map(sanitizeEntry) : [];
  const you = raw.you && typeof raw.you === 'object' ? (raw.you as Record<string, unknown>) : null;
  const pages = Math.max(1, int(raw.pages, 1));
  return {
    period: LEADERBOARD_PERIODS.includes(raw.period as LeaderboardPeriod) ? (raw.period as LeaderboardPeriod) : period,
    players,
    you: you ? { ...sanitizeEntry(you), page: Math.min(pages, Math.max(1, int(you.page, 1))) } : null,
    page: Math.max(1, int(raw.page, 1)),
    perPage: Math.max(1, int(raw.per_page, players.length || 20)),
    total: Math.max(0, int(raw.total, players.length)),
    pages,
  };
}

/** One page of the board for `period`, best first, with where the signed-in player stands. */
export async function getLeaderboard(period: LeaderboardPeriod, page = 1, perPage = 20): Promise<LeaderboardPage> {
  const query = new URLSearchParams({ period, page: String(page), per_page: String(perPage) });
  const body = await readJson<Record<string, unknown>>(await request(`/user/leaderboard?${query}`));
  if (!body) throw new ApiError('unexpected', UNREADABLE_RESPONSE);
  return sanitizeLeaderboard(body, period);
}
