import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoom, isSeated, parseTableCode, sanitizeMyRoom, sanitizeRoom, updateRoom } from './rooms';

describe('sanitizeRoom', () => {
  const raw = {
    administrator: 'jabir',
    teams: [
      { handle: 'TEAM_1', players: [{ handle: 'jabir', name: 'Jabir ibne kamal' }, null] },
      { handle: 'TEAM_2', players: [null, null] },
    ],
  };

  it('keeps seats with handles', () => {
    const room = sanitizeRoom('42', { ...raw, game_started: true });
    expect(room.teams[0].seats).toEqual([{ handle: 'jabir', name: 'Jabir ibne kamal' }, null]);
    expect(room.gameStarted).toBe(true);
    expect(room.teams[1].index).toBe(1);
    expect(room.administrator).toBe('jabir');
  });

  it('finds whether a handle is seated', () => {
    const room = sanitizeRoom('42', raw);
    expect(isSeated(room, 'jabir')).toBe(true);
    expect(isSeated(room, 'sakib')).toBe(false);
  });

  it('tolerates a room created without a session', () => {
    expect(sanitizeRoom('1', { teams: [] }).administrator).toBeNull();
  });

  it('reads the name and settings, with defaults for an older backend', () => {
    const room = sanitizeRoom('friday-k3m9', { ...raw, name: 'Friday', settings: { history: false, highlights: true, auto_draw_dead: true } });
    expect(room.name).toBe('Friday');
    expect(room.settings).toEqual({ history: false, highlights: true, autoDrawDead: true });
    const old = sanitizeRoom('42', raw);
    expect(old.name).toBe('Table 42');
    expect(old.settings).toEqual({ history: true, highlights: true, autoDrawDead: false });
  });
});

describe('sanitizeMyRoom', () => {
  const raw = {
    id: '42',
    created_at: '2026-10-15T05:48:22.696Z',
    administrator: 'jabir',
    team_count: 2,
    players_per_team: 1,
    seats_taken: 2,
    your_team: 1,
    status: 'finished',
    winner_team: 0,
    move_count: 31,
  };

  it('maps the history fields', () => {
    expect(sanitizeMyRoom(raw)).toEqual({
      id: '42',
      name: 'Table 42',
      createdAt: '2026-10-15T05:48:22.696Z',
      administrator: 'jabir',
      teamCount: 2,
      playersPerTeam: 1,
      seatsTaken: 2,
      yourTeam: 1,
      status: 'finished',
      winnerTeam: 0,
      moveCount: 31,
    });
  });

  it('keeps a created-only table and treats an unknown status as open', () => {
    const room = sanitizeMyRoom({ ...raw, your_team: null, winner_team: null, status: 'weird' });
    expect(room.yourTeam).toBeNull();
    expect(room.winnerTeam).toBeNull();
    expect(room.status).toBe('open');
  });
});

describe('createRoom', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the server explanation when it refuses', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'UNSUPPORTED_TABLE', message: "A game can't be dealt for 4 teams of 1." }), { status: 400 }));
    await expect(createRoom(4, 1)).rejects.toMatchObject({ message: "A game can't be dealt for 4 teams of 1.", status: 400 });
  });

  it('returns the new code', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ id: '123' }), { status: 200 }));
    await expect(createRoom(2, 1)).resolves.toBe('123');
  });

  it('sends the name and settings in the backend shape', async () => {
    let sent: unknown;
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: 'friday-k3m9' }), { status: 200 });
    });
    await expect(createRoom(2, 1, { name: ' Friday ', settings: { history: false, autoDrawDead: true } })).resolves.toBe('friday-k3m9');
    expect(sent).toEqual({ number_of_team: 2, number_of_player_in_each_team: 1, name: 'Friday', history: false, auto_draw_dead: true });
  });
});

describe('updateRoom', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('patches the settings and returns the room', async () => {
    let call: { url: string; method?: string } | undefined;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      call = { url, method: init.method };
      return new Response(JSON.stringify({ name: 'Friday', teams: [], settings: { highlights: false } }), { status: 200 });
    });
    const room = await updateRoom('friday-k3m9', { settings: { highlights: false } });
    expect(call).toEqual({ url: '/room/friday-k3m9/settings', method: 'PATCH' });
    expect(room.settings.highlights).toBe(false);
  });

  it("shows the server's reason when only the host may change settings", async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'NOT_HOST', message: 'Only the host can.' }), { status: 403 }));
    await expect(updateRoom('x', { settings: { history: false } })).rejects.toMatchObject({ message: 'Only the host can.' });
  });
});

describe('parseTableCode', () => {
  it('accepts slugs, older numeric codes and table links', () => {
    expect(parseTableCode('  Friday-Night-K3M9 ')).toBe('friday-night-k3m9');
    expect(parseTableCode('731791 746123232')).toBe('731791746123232');
    expect(parseTableCode('http://localhost:5173/table/lucky-otter-ab12/game')).toBe('lucky-otter-ab12');
  });

  it('refuses text that cannot be a code', () => {
    for (const bad of ['', 'friday night!', '-x', 'a--b']) expect(parseTableCode(bad)).toBeNull();
  });
});
