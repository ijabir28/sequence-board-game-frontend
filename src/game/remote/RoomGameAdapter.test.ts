import { afterEach, describe, expect, it, vi } from 'vitest';
import layout from '../../engine/board-layout.json';
import type { RoomGameView } from '../../api/roomGame';
import { RoomGameAdapter } from './RoomGameAdapter';

function serverView(overrides: Partial<RoomGameView> = {}): RoomGameView {
  return {
    team_count: 2,
    sequences_to_win: 2,
    players: [
      { handle: 'jabir', name: 'Jabir', team: 0, hand_count: 7 },
      { handle: 'sakib', name: 'Sakib', team: 1, hand_count: 7 },
    ],
    current_player: 'jabir',
    turn: 1,
    board: layout.map((row) => row.map((cell) => ({ name: cell.name, team: null }))),
    viewer: 'jabir',
    hand: ['6-Diamond', 'J-Club', 'J-Spade'],
    can_exchange: false,
    can_pass: false,
    deck_count: 90,
    sequences: [],
    winner: null,
    log: [],
    ...overrides,
  };
}

type Handler = (url: URL, init?: RequestInit) => { status: number; body: unknown };

function stubFetch(handler: Handler) {
  const calls: { path: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    calls.push({ path: url.pathname, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}

function adapter() {
  return new RoomGameAdapter({ roomId: '42', subscribeUpdates: () => () => {}, pollIntervalMs: 60_000 });
}

afterEach(() => vi.unstubAllGlobals());

describe('RoomGameAdapter', () => {
  it("maps the table's rounds, and only the host may deal the next one or end them", async () => {
    const player = { handle: 'jabir', name: 'Jabir', team: 0 as const, plays: 3, wilds: 1, removals: 0, exchanges: 0, passes: 0, timed_out: 1 };
    const rounds = {
      round: 1,
      over: false,
      results: [
        {
          round: 1,
          winner: 0 as const,
          started_at: '2026-10-17T10:00:00.000Z',
          finished_at: '2026-10-17T10:12:00.000Z',
          stats: {
            winner: 0 as const,
            turns: 5,
            first_player: 'sakib',
            teams: [{ team: 0 as const, sequences: 2, chips: 3, placed: 3, removed: 0 }],
            players: [player],
          },
        },
      ],
      summary: null,
    };
    const calls = stubFetch((url) => ({
      status: 200,
      body: serverView({ host: 'jabir', winner: 0, rounds: url.pathname.endsWith('/rounds/next') ? { ...rounds, round: 2, results: rounds.results } : rounds }),
    }));
    const a = adapter();
    await a.refresh();
    expect(a.getState().rounds).toEqual({
      round: 1,
      over: false,
      hostId: 'jabir',
      isHost: true,
      summary: null,
      results: [
        {
          round: 1,
          winner: 0,
          durationMs: 12 * 60_000,
          stats: {
            turns: 5,
            firstPlayerId: 'sakib',
            teams: [{ team: 0, sequences: 2, chips: 3, placed: 3, removed: 0 }],
            players: [{ id: 'jabir', name: 'Jabir', team: 0, plays: 3, wilds: 1, removals: 0, exchanges: 0, passes: 0, timedOut: 1 }],
          },
        },
      ],
    });
    expect(await a.nextRound()).toEqual({ ok: true });
    expect(calls.at(-1)).toMatchObject({ path: '/room/42/rounds/next', method: 'POST' });
    expect(a.getState().rounds?.round).toBe(2);
    a.dispose();

    stubFetch(() => ({ status: 200, body: serverView({ host: 'sakib', rounds }) }));
    const guest = adapter();
    await guest.refresh();
    expect(guest.getState().rounds?.isHost).toBe(false);
    guest.dispose();

    stubFetch(() => ({ status: 200, body: serverView() }));
    const old = adapter();
    await old.refresh();
    expect(old.getState().rounds).toBeNull();
    old.dispose();
  });

  it("loads a won round's details: statistics, final board and move log", async () => {
    const board = layout.map((row) => row.map((cell) => ({ name: cell.name, team: null as 0 | 1 | null })));
    board[0][1] = { name: '6-Diamond', team: 0 };
    const log = [{ kind: 'place' as const, turn: 1, player: 'Jabir', team: 0 as const, card: '6-Diamond' as const, pos: { row: 0, column: 1 }, wild: false }];
    const calls = stubFetch((url) =>
      url.pathname === '/room/42/rounds/9'
        ? { status: 404, body: { error: 'ROUND_NOT_FOUND', message: 'This table has no round 9.' } }
        : {
            status: 200,
            body: {
              round: 2, winner: 0, started_at: '2026-10-17T10:00:00.000Z', finished_at: '2026-10-17T10:01:00.000Z', stats: null,
              team_count: 2, players: [{ handle: 'jabir', name: 'Jabir', team: 0 }], board, sequences: [], log,
            },
          },
    );
    const a = adapter();
    const detail = await a.roundDetail(2);
    expect(calls.at(-1)).toMatchObject({ path: '/room/42/rounds/2', method: 'GET' });
    expect(detail.result).toEqual({ round: 2, winner: 0, durationMs: 60_000, stats: null });
    expect(detail.board[0][1]).toEqual({ row: 0, column: 1, card: '6-Diamond', chip: 0, locked: false });
    expect(detail.log).toEqual(log);
    await expect(a.roundDetail(9)).rejects.toThrow('This table has no round 9.');
    a.dispose();
  });

  it('ends the rounds with the final summary, and reports a refusal', async () => {
    const summary = {
      rounds_played: 2,
      turns: 40,
      teams: [
        { team: 0 as const, rounds_won: 1, sequences: 3, placed: 30, removed: 2 },
        { team: 1 as const, rounds_won: 1, sequences: 3, placed: 28, removed: 4 },
      ],
      players: [],
      verdict: { winner: null, leaders: [0 as const, 1 as const] },
    };
    stubFetch((url) =>
      url.pathname.endsWith('/rounds/end')
        ? { status: 200, body: serverView({ host: 'jabir', winner: 1, rounds: { round: 2, over: true, results: [], summary } }) }
        : { status: 200, body: serverView({ host: 'jabir', winner: 1, rounds: { round: 2, over: false, results: [], summary: null } }) },
    );
    const a = adapter();
    await a.refresh();
    expect(await a.endRounds()).toEqual({ ok: true });
    expect(a.getState().rounds).toMatchObject({
      over: true,
      summary: { roundsPlayed: 2, turns: 40, winner: null, leaders: [0, 1], teams: [{ team: 0, roundsWon: 1 }, { team: 1, roundsWon: 1 }] },
    });
    a.dispose();

    stubFetch(() => ({ status: 409, body: { error: 'ROUND_IN_PROGRESS', message: 'This round is still being played.' } }));
    const early = adapter();
    expect(await early.nextRound()).toEqual({ ok: false, message: 'This round is still being played.' });
    early.dispose();
  });

  it('maps the server view, including turn order and the viewer', async () => {
    stubFetch(() => ({ status: 200, body: serverView() }));
    const a = adapter();
    await a.refresh();
    const view = a.getState();
    expect(view.status).toBe('ready');
    expect(view.currentPlayerId).toBe('jabir');
    expect(view.viewer).toMatchObject({ id: 'jabir', team: 0 });
    expect(view.players).toHaveLength(2);
    expect(view.hand.map((h) => h.card)).toEqual(['6-Diamond', 'J-Club', 'J-Spade']);
    expect(view.deckCount).toBe(90);
    expect(a.legalTargets(0)).toHaveLength(2);
    a.dispose();
  });

  it("takes the table's name and display settings from the server, defaulting for older backends", async () => {
    stubFetch(() => ({ status: 200, body: serverView({ name: 'Friday', settings: { history: false, highlights: false, auto_draw_dead: true } }) }));
    const a = adapter();
    await a.refresh();
    expect(a.getState().title).toBe('Friday');
    expect(a.getState().settings).toEqual({ mode: 'standard', highlights: false, history: false, deadCards: 'indicator' });
    a.dispose();

    stubFetch(() => ({ status: 200, body: serverView() }));
    const old = adapter();
    await old.refresh();
    expect(old.getState().settings).toEqual({ mode: 'standard', highlights: false, history: false, deadCards: 'indicator' });
    old.dispose();
  });

  it('marks dead cards only when the table marks them, and passes the exchanges left on', async () => {
    // Both 6-Diamond cells are covered, so the 6-Diamond in the hand is dead.
    const board = serverView().board.map((row) => row.map((cell) => ({ ...cell, team: cell.name === '6-Diamond' ? (1 as const) : null })));
    stubFetch(() => ({ status: 200, body: serverView({ board, settings: { dead_cards: 'indicator' }, can_exchange: true, exchanges_left: 2 }) }));
    const marked = adapter();
    await marked.refresh();
    expect(marked.getState().hand[0]).toEqual({ card: '6-Diamond', dead: true });
    expect(marked.getState().exchangesLeft).toBe(2);
    marked.dispose();

    stubFetch(() => ({ status: 200, body: serverView({ board, settings: { dead_cards: 'manual' }, can_exchange: true, exchanges_left: null }) }));
    const manual = adapter();
    await manual.refresh();
    expect(manual.getState().hand[0]).toEqual({ card: '6-Diamond', dead: false });
    expect(manual.getState().settings.deadCards).toBe('manual');
    expect(manual.getState().exchangesLeft).toBeNull();
    manual.dispose();
  });

  it("maps a training game's hint, and ignores a hint outside training", async () => {
    const hint = { type: 'play' as const, hand_index: 0, target: { row: 0, column: 1 }, reason: { kind: 'extend' as const, length: 2 } };
    stubFetch(() => ({ status: 200, body: serverView({ settings: { mode: 'training' }, hint }) }));
    const a = adapter();
    await a.refresh();
    expect(a.getState().hint).toEqual({ type: 'play', handIndex: 0, target: { row: 0, column: 1 }, reason: { kind: 'extend', length: 2 } });
    a.dispose();

    stubFetch(() => ({ status: 200, body: serverView({ settings: { mode: 'standard' }, hint }) }));
    const standard = adapter();
    await standard.refresh();
    expect(standard.getState().hint).toBeNull();
    standard.dispose();
  });

  it("runs the turn clock on this device's time, measured once", async () => {
    // The server's clock is 10 s behind ours; the turn started 3 s before its reading.
    const now = Date.now();
    const serverNow = now - 10_000;
    const iso = (ms: number) => new Date(ms).toISOString();
    let serverTime = serverNow;
    stubFetch(() => ({
      status: 200,
      body: serverView({ turn_started_at: iso(serverNow - 3000), turn_deadline: iso(serverNow + 87_000), server_time: iso(serverTime) }),
    }));
    const a = adapter();
    await a.refresh();
    const started = a.getState().turnStartedAt!;
    expect(Math.abs(started - (now - 3000))).toBeLessThan(200);
    expect(a.getState().turnDeadline! - started).toBe(90_000);

    // A later refresh with a later server reading must not move the start (that would re-render for nothing).
    serverTime += 5000;
    const listener = vi.fn();
    a.subscribe(listener);
    await a.refresh();
    expect(a.getState().turnStartedAt).toBe(started);
    a.dispose();
  });

  it('posts a move and shows the board the server sends back', async () => {
    const board = serverView().board;
    board[0][1] = { name: board[0][1].name, team: 0 };
    const calls = stubFetch((url) =>
      url.pathname.endsWith('/play')
        ? { status: 200, body: serverView({ board, current_player: 'sakib', turn: 2 }) }
        : { status: 200, body: serverView() },
    );
    const a = adapter();
    await a.refresh();
    const result = await a.playCard(0, { row: 0, column: 1 });
    expect(result.ok).toBe(true);
    expect(calls.at(-1)).toEqual({ path: '/room/42/game/play', method: 'POST', body: { hand_index: 0, row: 0, column: 1 } });
    expect(a.getState().board[0][1].chip).toBe(0);
    expect(a.getState().currentPlayerId).toBe('sakib');
    a.dispose();
  });

  it("passes the server's reason through when a move is refused", async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/play')
        ? { status: 409, body: { error: 'NOT_YOUR_TURN', message: "It's Sakib's turn." } }
        : { status: 200, body: serverView({ current_player: 'sakib' }) },
    );
    const a = adapter();
    await a.refresh();
    const result = await a.playCard(0, { row: 0, column: 1 });
    expect(!result.ok && result.message).toBe("It's Sakib's turn.");
    a.dispose();
  });

  it('shows the error when the game has not started', async () => {
    stubFetch(() => ({ status: 404, body: { error: 'GAME_NOT_FOUND', message: "This table's game hasn't started yet." } }));
    const a = adapter();
    await a.refresh();
    expect(a.getState().status).toBe('error');
    expect(a.getState().error).toMatch(/hasn't started/);
    a.dispose();
  });

  it('marks spectators', async () => {
    stubFetch(() => ({ status: 200, body: serverView({ viewer: null, hand: [] }) }));
    const a = adapter();
    await a.refresh();
    expect(a.getState().viewer).toBeNull();
    expect(a.getState().notice).toMatch(/watching/);
    a.dispose();
  });

  it('shows a paused turn and who is away', async () => {
    stubFetch(() => ({
      status: 200,
      body: serverView({ current_player: 'sakib', turn_deadline: null, turn_paused: true, turn_time_left_ms: 42_000, away: ['sakib'] }),
    }));
    const a = adapter();
    await a.refresh();
    expect(a.getState()).toMatchObject({ turnPaused: true, turnTimeLeft: 42_000, turnDeadline: null, away: ['sakib'] });
    a.dispose();
  });

  it('says the viewer is at the table while the game is open, and that they left when it closes', async () => {
    stubFetch(() => ({ status: 200, body: serverView({ presence_token: 'tok' }) }));
    const leave = vi.fn();
    const announcePresence = vi.fn(() => leave);
    const a = new RoomGameAdapter({ roomId: '42', subscribeUpdates: () => () => {}, pollIntervalMs: 60_000, announcePresence });
    const unsubscribe = a.subscribe(() => {});
    await a.refresh();
    await a.refresh();
    expect(announcePresence).toHaveBeenCalledTimes(1);
    expect(announcePresence).toHaveBeenCalledWith('jabir', 'tok');
    unsubscribe();
    expect(leave).toHaveBeenCalledTimes(1);
    a.dispose();
  });

  it('never announces a spectator', async () => {
    stubFetch(() => ({ status: 200, body: serverView({ viewer: null, hand: [], presence_token: null }) }));
    const announcePresence = vi.fn(() => () => {});
    const a = new RoomGameAdapter({ roomId: '42', subscribeUpdates: () => () => {}, pollIntervalMs: 60_000, announcePresence });
    const unsubscribe = a.subscribe(() => {});
    await a.refresh();
    expect(announcePresence).not.toHaveBeenCalled();
    unsubscribe();
    a.dispose();
  });

  it('counts the viewer as away while they step away, and back when they return', async () => {
    stubFetch(() => ({ status: 200, body: serverView({ presence_token: 'tok' }) }));
    const leave = vi.fn();
    const announcePresence = vi.fn(() => leave);
    const a = new RoomGameAdapter({ roomId: '42', subscribeUpdates: () => () => {}, pollIntervalMs: 60_000, announcePresence });
    const unsubscribe = a.subscribe(() => {});
    await a.refresh();
    expect(announcePresence).toHaveBeenCalledTimes(1);

    a.stepAway(true);
    expect(leave).toHaveBeenCalledTimes(1);
    // A refresh while away must not announce the viewer again.
    await a.refresh();
    expect(announcePresence).toHaveBeenCalledTimes(1);

    a.stepAway(false);
    expect(announcePresence).toHaveBeenCalledTimes(2);
    unsubscribe();
    a.dispose();
  });
});
