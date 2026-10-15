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
    expect(a.getState().settings).toEqual({ mode: 'standard', highlights: false, history: false });
    a.dispose();

    stubFetch(() => ({ status: 200, body: serverView() }));
    const old = adapter();
    await old.refresh();
    expect(old.getState().settings).toEqual({ mode: 'standard', highlights: true, history: true });
    old.dispose();
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
    stubFetch(() => ({ status: 200, body: serverView({ turn_started_at: iso(serverNow - 3000), server_time: iso(serverTime) }) }));
    const a = adapter();
    await a.refresh();
    const started = a.getState().turnStartedAt!;
    expect(Math.abs(started - (now - 3000))).toBeLessThan(200);

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
});
