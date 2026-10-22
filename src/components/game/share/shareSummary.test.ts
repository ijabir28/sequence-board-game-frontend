import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAY_SETTINGS, type GameView, type RoundsView } from '../../../game/types';
import { buildRoundShareSummary, buildShareSummary, shareFileName, shareText } from './shareSummary';

const NOW = new Date(2026, 9, 20);

function view(overrides: Partial<GameView> = {}): GameView {
  return {
    status: 'ready',
    board: [],
    teams: [
      { index: 0, sequences: 2 },
      { index: 1, sequences: 1 },
    ],
    sequencesToWin: 2,
    players: [
      { id: 'a', name: 'Asha', team: 0 },
      { id: 'b', name: 'Ben', team: 1 },
      { id: 'c', name: 'Cleo', team: 0 },
      { id: 'd', name: 'Dev', team: 1 },
    ],
    currentPlayerId: null,
    viewer: null,
    hand: [],
    canExchange: false,
    exchangesLeft: null,
    canPass: false,
    deckCount: null,
    sequences: [],
    log: [
      { kind: 'place', turn: 1, player: 'a', team: 0, card: '2-Heart', pos: { row: 1, column: 1 }, wild: false },
      { kind: 'place', turn: 2, player: 'b', team: 1, card: '3-Heart', pos: { row: 4, column: 5 }, wild: false },
      { kind: 'sequence', turn: 2, team: 0, cells: [] },
      { kind: 'win', turn: 2, team: 0 },
    ],
    winner: 0,
    turn: 42,
    settings: DEFAULT_PLAY_SETTINGS,
    hint: null,
    turnStartedAt: null,
    turnDeadline: null,
    turnPaused: false,
    turnTimeLeft: null,
    away: [],
    ...overrides,
  };
}

function rounds(overrides: Partial<RoundsView> = {}): RoundsView {
  return {
    round: 2,
    over: false,
    results: [
      { round: 1, winner: 1, durationMs: 10 * 60_000, stats: null },
      { round: 2, winner: 0, durationMs: 15 * 60_000, stats: null },
    ],
    summary: null,
    hostId: 'a',
    isHost: true,
    ...overrides,
  };
}

describe('buildShareSummary', () => {
  it('has nothing to share before the game is won', () => {
    expect(buildShareSummary(view({ winner: null }), { modeLabel: 'Hot-seat' })).toBeNull();
  });

  it('shares a single game: the winners, sequences per team and how long it took', () => {
    const summary = buildShareSummary(view(), { modeLabel: 'Hot-seat', playedMs: 12 * 60_000, now: NOW })!;
    expect(summary.title).toBe('Hot-seat');
    expect(summary.headline).toBe('Team Green wins');
    expect(summary.subline).toBe('Asha & Cleo');
    expect(summary.teams.map((t) => [t.name, t.score, t.scoreLabel, t.won])).toEqual([
      ['Team Green', 2, 'sequences', true],
      ['Team Blue', 1, 'sequence', false],
    ]);
    expect(summary.facts).toEqual([
      { label: 'Turns', value: '42' },
      { label: 'Duration', value: '12 min' },
      { label: 'Played', value: '20 Oct 2026' },
    ]);
    expect(summary.lastMove).toEqual({ row: 4, column: 5 });
  });

  it('leaves out a duration nobody measured', () => {
    const summary = buildShareSummary(view(), { modeLabel: 'Server game', now: NOW })!;
    expect(summary.facts.map((f) => f.label)).toEqual(['Turns', 'Played']);
  });

  it('shares a round just won, with its own time', () => {
    const summary = buildShareSummary(view({ title: 'Friday table', rounds: rounds() }), { modeLabel: 'Table', now: NOW })!;
    expect(summary.title).toBe('Friday table');
    expect(summary.headline).toBe('Team Green wins round 2');
    expect(summary.facts.slice(0, 2)).toEqual([
      { label: 'Round', value: '2' },
      { label: 'Turns', value: '42' },
    ]);
    expect(summary.facts[2]).toEqual({ label: 'Duration', value: '15 min' });
  });

  it('shares the whole match once the rounds are over', () => {
    const over = rounds({
      over: true,
      summary: {
        roundsPlayed: 3,
        turns: 120,
        teams: [
          { team: 0, roundsWon: 2, sequences: 4, placed: 0, removed: 0 },
          { team: 1, roundsWon: 1, sequences: 2, placed: 0, removed: 0 },
        ],
        players: [],
        winner: 0,
        leaders: [0],
      },
    });
    const summary = buildShareSummary(view({ rounds: over }), { modeLabel: 'Table', now: NOW })!;
    expect(summary.headline).toBe('Team Green wins the match, 2–1');
    expect(summary.teams.map((t) => [t.score, t.scoreLabel])).toEqual([
      [2, 'rounds won'],
      [1, 'round won'],
    ]);
    expect(summary.facts).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Turns', value: '120' },
      { label: 'Duration', value: '25 min' },
      { label: 'Played', value: '20 Oct 2026' },
    ]);
  });

  it('calls a drawn match a draw, with no winners named', () => {
    const drawn = rounds({
      over: true,
      summary: {
        roundsPlayed: 2,
        turns: 80,
        teams: [
          { team: 0, roundsWon: 1, sequences: 2, placed: 0, removed: 0 },
          { team: 1, roundsWon: 1, sequences: 2, placed: 0, removed: 0 },
        ],
        players: [],
        winner: null,
        leaders: [0, 1],
      },
    });
    const summary = buildShareSummary(view({ rounds: drawn }), { modeLabel: 'Table', now: NOW })!;
    expect(summary.winner).toBeNull();
    expect(summary.subline).toBeNull();
    expect(summary.teams.every((t) => !t.won)).toBe(true);
    expect(shareFileName(summary, NOW)).toBe('sequence-draw-2026-10-20.png');
  });
});

describe('shareFileName and shareText', () => {
  it('names the file after the winner and the day', () => {
    const summary = buildShareSummary(view(), { modeLabel: 'Hot-seat', now: NOW })!;
    expect(shareFileName(summary, NOW)).toBe('sequence-team-green-wins-2026-10-20.png');
    expect(shareText(summary, 'https://sequence.fifteens.app')).toBe('Team Green wins at Sequence. Play at https://sequence.fifteens.app');
  });

  it('speaks for the sharer when their team won', () => {
    const asha = { id: 'a', name: 'Asha', team: 0 as const };
    const won = buildShareSummary(view({ viewer: asha }), { modeLabel: 'Server game', now: NOW })!;
    expect(shareText(won, 'https://sequence.fifteens.app')).toBe('I just won a Sequence match! 🏆 Play at https://sequence.fifteens.app');
    const round = buildShareSummary(view({ viewer: asha, rounds: rounds() }), { modeLabel: 'Table', now: NOW })!;
    expect(shareText(round, 'https://x.test')).toBe('I just won round 2 of a Sequence match! 🏆 Play at https://x.test');
  });

  it('keeps the team headline for a loser, and in hot-seat play', () => {
    const ben = { id: 'b', name: 'Ben', team: 1 as const };
    const lost = buildShareSummary(view({ viewer: ben }), { modeLabel: 'Server game', now: NOW })!;
    expect(shareText(lost, 'https://x.test')).toBe('Team Green wins at Sequence. Play at https://x.test');
    const asha = { id: 'a', name: 'Asha', team: 0 as const };
    const hotSeat = buildShareSummary(view({ viewer: asha }), { modeLabel: 'Hot-seat', hotSeat: true, now: NOW })!;
    expect(hotSeat.viewerWon).toBe(false);
  });
});

describe('the headline when the sharer won', () => {
  const asha = { id: 'a', name: 'Asha', team: 0 as const };

  it('says "I won" on the card, with the team and teammates under it', () => {
    const summary = buildShareSummary(view({ viewer: asha }), { modeLabel: 'Server game', now: NOW })!;
    expect(summary.headline).toBe('I just won a Sequence match!');
    expect(summary.subline).toBe('Team Green · Asha & Cleo');
  });

  it('names the round for a round just won', () => {
    const summary = buildShareSummary(view({ viewer: asha, rounds: rounds() }), { modeLabel: 'Table', now: NOW })!;
    expect(summary.headline).toBe('I just won round 2!');
    expect(shareFileName(summary, NOW)).toBe('sequence-round-2-team-green-wins-2026-10-20.png');
  });

  it('keeps the team headline in hot-seat play', () => {
    const summary = buildShareSummary(view({ viewer: asha }), { modeLabel: 'Hot-seat', hotSeat: true, now: NOW })!;
    expect(summary.headline).toBe('Team Green wins');
  });
});

describe('buildRoundShareSummary', () => {
  const players = view().players;
  const detail = {
    result: {
      round: 1,
      winner: 1 as const,
      durationMs: 8 * 60_000,
      stats: {
        turns: 50,
        firstPlayerId: 'a',
        teams: [
          { team: 0 as const, sequences: 1, chips: 0, placed: 0, removed: 0 },
          { team: 1 as const, sequences: 2, chips: 0, placed: 0, removed: 0 },
        ],
        players: [],
      },
    },
    board: [],
    sequences: [],
    log: [{ kind: 'place' as const, turn: 50, player: 'b', team: 1 as const, card: '2-Heart' as const, pos: { row: 3, column: 3 }, wild: false }],
  };

  it("shares one round's own result, without a date it doesn't know", () => {
    const summary = buildRoundShareSummary(detail, { title: 'Friday table', players, viewer: null });
    expect(summary.headline).toBe('Team Blue wins round 1');
    expect(summary.subline).toBe('Ben & Dev');
    expect(summary.teams.map((t) => [t.name, t.score, t.won])).toEqual([
      ['Team Green', 1, false],
      ['Team Blue', 2, true],
    ]);
    expect(summary.facts).toEqual([
      { label: 'Round', value: '1' },
      { label: 'Turns', value: '50' },
      { label: 'Duration', value: '8 min' },
    ]);
    expect(summary.lastMove).toEqual({ row: 3, column: 3 });
  });

  it('speaks for a sharer whose team won that round', () => {
    const summary = buildRoundShareSummary(detail, { title: 'Friday table', players, viewer: players[1] });
    expect(summary.headline).toBe('I just won round 1!');
    expect(shareText(summary, 'https://x.test')).toBe('I just won round 1 of a Sequence match! 🏆 Play at https://x.test');
  });
});
