import { afterEach, describe, expect, it, vi } from 'vitest';
import layout from '../../engine/board-layout.json';
import { RemoteGameAdapter } from './RemoteGameAdapter';

type Handler = (url: URL) => { status: number; body: string } | 'network-error';

function stubFetch(handler: Handler) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input, 'http://localhost');
    calls.push(url.pathname + url.search);
    const result = handler(url);
    if (result === 'network-error') throw new TypeError('Failed to fetch');
    return new Response(result.body, { status: result.status });
  });
  return calls;
}

function deckWith(chips: Record<string, string> = {}) {
  return layout.map((row, r) => row.map((cell, c) => ({ ...cell, ...(chips[`${r},${c}`] ? { occupied_by: chips[`${r},${c}`] } : {}) })));
}

const HAND = { cards_in_hand: [{ name: '4-Club' }, { name: 'Q-Diamond' }, { name: 'J-Spade' }] };

function backend(overrides: Partial<Record<string, (url: URL) => { status: number; body: string }>> = {}, chips = { '0,1': 'team2' }): Handler {
  return (url) => {
    const custom = overrides[url.pathname];
    if (custom) return custom(url);
    if (url.pathname === '/board/deck') return { status: 200, body: JSON.stringify({ deck: deckWith(chips) }) };
    if (url.pathname === '/game/hand_cards') return { status: 200, body: JSON.stringify(HAND) };
    return { status: 404, body: 'Not Found' };
  };
}

async function ready(adapter: RemoteGameAdapter) {
  const unsubscribe = adapter.subscribe(() => {});
  await adapter.refresh();
  return unsubscribe;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RemoteGameAdapter', () => {
  it('loads the board and hand and maps legacy team handles', async () => {
    stubFetch(backend());
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    const stop = await ready(adapter);
    const view = adapter.getState();
    expect(view.status).toBe('ready');
    expect(view.board[0][1]).toMatchObject({ card: '6-Diamond', chip: 1 });
    expect(view.hand.map((h) => h.card)).toEqual(['4-Club', 'Q-Diamond', 'J-Spade']);
    expect(view.viewer).toMatchObject({ id: 'jabir', team: 0 });
    expect(view.currentPlayerId).toBeNull();
    expect(view.notice).toBeTruthy();
    stop();
    adapter.dispose();
  });

  it('computes legal targets on the server board, including one-eyed jack removals', async () => {
    stubFetch(backend());
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    await ready(adapter);
    expect(adapter.legalTargets(1)).toEqual([{ row: 0, column: 6 }, { row: 3, column: 2 }]);
    expect(adapter.legalTargets(2)).toEqual([{ row: 0, column: 1 }]);
    adapter.dispose();
  });

  it('sends board_card_index as URL-encoded JSON and explains the known 500', async () => {
    const calls = stubFetch(
      backend({
        '/game/play': () => ({ status: 500, body: '<pre>ReferenceError: current_team is not defined</pre>' }),
      }),
    );
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    await ready(adapter);
    const result = await adapter.playCard(1, { row: 0, column: 6 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/known backend bug/);
    const play = calls.find((c) => c.startsWith('/game/play'))!;
    const params = new URLSearchParams(play.split('?')[1]);
    expect(params.get('player_handler')).toBe('jabir');
    expect(params.get('hand_card_index')).toBe('1');
    expect(JSON.parse(params.get('board_card_index')!)).toEqual({ row: 0, column: 6 });
    expect(play).toContain('board_card_index=%7B%22row%22%3A0%2C%22column%22%3A6%7D');
    adapter.dispose();
  });

  it('reports a 404 Invalid Move as a rejected move', async () => {
    stubFetch(backend({ '/game/play': () => ({ status: 404, body: 'Invalid Move' }) }));
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    await ready(adapter);
    const result = await adapter.playCard(0, { row: 0, column: 0 });
    expect(!result.ok && result.message).toMatch(/rejected/);
    adapter.dispose();
  });

  it('shows a readable error when the server is down, and recovers on retry', async () => {
    let down = true;
    stubFetch((url) => (down ? 'network-error' : backend()(url)));
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    await ready(adapter);
    expect(adapter.getState().status).toBe('error');
    expect(adapter.getState().error).toMatch(/port 3000/);
    down = false;
    await adapter.refresh();
    expect(adapter.getState().status).toBe('ready');
    adapter.dispose();
  });

  it('keeps the same snapshot when a poll finds no change', async () => {
    stubFetch(backend());
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    const listener = vi.fn();
    adapter.subscribe(listener);
    await adapter.refresh();
    const first = adapter.getState();
    const calls = listener.mock.calls.length;
    await adapter.refresh();
    expect(adapter.getState()).toBe(first);
    expect(listener.mock.calls.length).toBe(calls);
    adapter.dispose();
  });

  it('explains which handles the legacy game supports', async () => {
    stubFetch(backend());
    const adapter = new RemoteGameAdapter({ handle: 'zara', displayName: 'Zara', pollIntervalMs: 60_000 });
    await ready(adapter);
    expect(adapter.getState().status).toBe('error');
    expect(adapter.getState().error).toMatch(/jabir, sakib/);
    adapter.dispose();
  });

  it('does not support dead-card exchange or passing yet', async () => {
    stubFetch(backend());
    const adapter = new RemoteGameAdapter({ handle: 'jabir', displayName: 'Jabir', pollIntervalMs: 60_000 });
    expect((await adapter.exchangeDeadCard()).ok).toBe(false);
    expect((await adapter.pass()).ok).toBe(false);
    adapter.dispose();
  });
});
