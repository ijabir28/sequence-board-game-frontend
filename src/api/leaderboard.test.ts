import { afterEach, describe, expect, it, vi } from 'vitest';
import { SERVER_ERROR } from './http';
import { getLeaderboard, sanitizeEntry, sanitizeLeaderboard } from './leaderboard';

const ENTRY = {
  rank: 2,
  position: 3,
  handle: 'jabir',
  name: 'Jabir',
  image: null,
  score: 1216,
  rating: 1216,
  rating_change: 16,
  played: 4,
  won: 3,
  lost: 1,
  win_rate: 0.75,
};

describe('sanitizeEntry', () => {
  it('maps the fields', () => {
    expect(sanitizeEntry(ENTRY)).toEqual({
      rank: 2,
      position: 3,
      handle: 'jabir',
      name: 'Jabir',
      image: null,
      score: 1216,
      rating: 1216,
      ratingChange: 16,
      played: 4,
      won: 3,
      lost: 1,
      winRate: 0.75,
    });
  });

  it('fills in what is missing or out of range', () => {
    const entry = sanitizeEntry({ handle: 'sakib', played: 2, won: 5 });
    expect(entry).toMatchObject({ name: 'sakib', rating: 1200, score: 1200, won: 2, lost: 0, winRate: 1, rank: 1 });
  });
});

describe('sanitizeLeaderboard', () => {
  it('keeps the page, the totals and your entry', () => {
    const page = sanitizeLeaderboard(
      { period: 'week', players: [ENTRY], you: { ...ENTRY, page: 2 }, page: 1, per_page: 1, total: 3, pages: 3 },
      'all',
    );
    expect(page).toMatchObject({ period: 'week', page: 1, perPage: 1, total: 3, pages: 3 });
    expect(page.players).toHaveLength(1);
    expect(page.you).toMatchObject({ handle: 'jabir', page: 2 });
  });

  it('reads the scope and which scopes the server offers, friends always among them', () => {
    expect(sanitizeLeaderboard({ scope: 'global', scopes: ['friends', 'global'] }, 'all')).toMatchObject({
      scope: 'global',
      scopes: ['friends', 'global'],
    });
    expect(sanitizeLeaderboard({ scope: 'nobody', scopes: ['global', 'other'] }, 'all', 'global')).toMatchObject({
      scope: 'global',
      scopes: ['friends', 'global'],
    });
  });

  it('copes with an empty board', () => {
    expect(sanitizeLeaderboard({ players: [], you: null }, 'day')).toEqual({
      scope: 'friends',
      scopes: ['friends'],
      period: 'day',
      players: [],
      you: null,
      page: 1,
      perPage: 20,
      total: 0,
      pages: 1,
    });
  });
});

describe('getLeaderboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the period and page', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ period: 'day', players: [], you: null, page: 2, per_page: 10, total: 0, pages: 1 })));
    vi.stubGlobal('fetch', fetch);
    const page = await getLeaderboard('day', 2, 10);
    expect(fetch).toHaveBeenCalledWith('/user/leaderboard?scope=friends&period=day&page=2&per_page=10', expect.anything());
    expect(page.period).toBe('day');
  });

  it('reports a server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 500 })));
    await expect(getLeaderboard('all')).rejects.toThrow(SERVER_ERROR);
  });
});
