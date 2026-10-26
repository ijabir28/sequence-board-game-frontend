import { afterEach, describe, expect, it, vi } from 'vitest';
import { enterRoom, declineRejoin, getRejoinStatus, listRemoved, readmitPlayer, requestRejoin, createRoom, formatTableCode, isSeated, kickPlayer, leaveSeat, seatPlayer, shuffleSeats, uninvitePlayer, unseatPlayer, isValidTurnSeconds, listMyRooms, parseTableCode, sanitizeMyRoom, sanitizeRoom, updateRoom, changedSettings, DEFAULT_ROOM_SETTINGS } from './rooms';

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

  it("names the host by display name, falling back to the handle from an older backend", () => {
    expect(sanitizeRoom('1', { ...raw, administrator_name: 'Jabir ibne kamal' }).administratorName).toBe('Jabir ibne kamal');
    expect(sanitizeRoom('1', raw).administratorName).toBe('jabir');
  });

  it('tolerates a room created without a session', () => {
    expect(sanitizeRoom('1', { teams: [] }).administrator).toBeNull();
  });

  it('reads the name and settings, with defaults for an older backend', () => {
    const room = sanitizeRoom('friday-k3m9', { ...raw, name: 'Friday', settings: { history: false, highlights: true, auto_draw_dead: true } });
    expect(room.name).toBe('Friday');
    // A backend without the dead card settings marks dead cards and allows one exchange per turn.
    expect(room.settings).toEqual({
      history: false,
      highlights: true,
      autoDrawDead: true,
      turnSeconds: 90,
      clockSeconds: null,
      deadCards: 'indicator',
      exchangesPerTurn: 1,
    });
    const old = sanitizeRoom('42', raw);
    expect(old.name).toBe('Table 42');
    expect(old.settings).toMatchObject({ history: false, highlights: false, autoDrawDead: false, turnSeconds: 90 });
    const current = sanitizeRoom('x', { ...raw, settings: { dead_cards: 'manual', exchanges_per_turn: null } }).settings;
    expect(current).toMatchObject({ deadCards: 'manual', exchangesPerTurn: null });
    // Blitz: a chess-style clock for the whole round.
    expect(sanitizeRoom('x', { ...raw, settings: { clock_seconds: 300 } }).settings.clockSeconds).toBe(300);
    expect(sanitizeRoom('x', { ...raw, settings: { clock_seconds: null } }).settings.clockSeconds).toBe(null);
    expect(sanitizeRoom('x', { ...raw, settings: { exchanges_per_turn: 4 } }).settings.exchangesPerTurn).toBe(4);
    expect(sanitizeRoom('x', { ...raw, settings: { turn_seconds: 45 } }).settings.turnSeconds).toBe(45);
    // An older backend's retired game mode is dropped.
    expect(sanitizeRoom('x', { ...raw, settings: { mode: 'training' } as never }).settings).not.toHaveProperty('mode');
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
      lastMoveAt: null,
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
    // Unlimited exchanges go to the backend as null.
    await createRoom(2, 1, { settings: { deadCards: 'manual', exchangesPerTurn: null } });
    expect(sent).toMatchObject({ dead_cards: 'manual', exchanges_per_turn: null });
  });
});

describe('changedSettings', () => {
  it('keeps only the settings that differ', () => {
    expect(changedSettings(DEFAULT_ROOM_SETTINGS, { ...DEFAULT_ROOM_SETTINGS, highlights: true, exchangesPerTurn: 2 })).toEqual({ highlights: true, exchangesPerTurn: 2 });
    expect(changedSettings(DEFAULT_ROOM_SETTINGS, DEFAULT_ROOM_SETTINGS)).toEqual({});
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

  it('sends a new table size as the backend names it', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ name: 'Friday', teams: [] }), { status: 200 });
    });
    await updateRoom('friday-k3m9', { size: { teamCount: 3, playersPerTeam: 2 } });
    expect(body).toEqual({ number_of_team: 3, number_of_player_in_each_team: 2 });
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
    // The table page's copy icon copies the full link; pasted under Join a table it becomes the code.
    expect(parseTableCode('https://sequence.fifteens.app/table/friday-night-k3m9')).toBe('friday-night-k3m9');
  });

  it('forgives spaces, stray hyphens and punctuation', () => {
    expect(parseTableCode('friday night k3m9!')).toBe('friday-night-k3m9');
    expect(parseTableCode('-friday--night_k3m9-')).toBe('friday-night-k3m9');
    expect(parseTableCode('Café Night-ab12')).toBe('cafe-night-ab12');
  });

  it('refuses text that cannot be a code', () => {
    for (const bad of ['', '   ', '!?', '---']) expect(parseTableCode(bad)).toBeNull();
  });
});

describe('formatTableCode', () => {
  it('hyphenates as the player types', () => {
    expect(formatTableCode('Friday ')).toBe('friday-');
    expect(formatTableCode('friday  night_')).toBe('friday-night-');
    expect(formatTableCode('friday--night.k3m9')).toBe('friday-night-k3m9');
    expect(formatTableCode(' -friday')).toBe('friday');
  });

  it('drops the trailing hyphen once the player is done', () => {
    expect(formatTableCode('friday-night-', true)).toBe('friday-night');
  });

  it('turns a pasted table link into its code', () => {
    expect(formatTableCode('https://sequence.fifteens.app/table/lucky-otter-ab12/game')).toBe('lucky-otter-ab12');
  });
});

describe('turn timer', () => {
  it('accepts whole seconds from 15 to 600', () => {
    expect([15, 90, 600].every(isValidTurnSeconds)).toBe(true);
    expect([14, 601, 30.5, NaN].some(isValidTurnSeconds)).toBe(false);
  });
});

describe('listMyRooms', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for a page and reads the totals', async () => {
    let url = '';
    vi.stubGlobal('fetch', async (input: string) => {
      url = input;
      return new Response(JSON.stringify({ rooms: [], page: 2, per_page: 5, total: 7, pages: 2 }), { status: 200 });
    });
    await expect(listMyRooms(2, 5)).resolves.toEqual({ rooms: [], page: 2, perPage: 5, total: 7, pages: 2 });
    expect(url).toBe('/user/rooms?page=2&per_page=5');
  });
});

describe('seat actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stands up and shuffles, returning the updated room', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      return new Response(JSON.stringify({ teams: [{ handle: 'TEAM_1', players: [null] }] }), { status: 200 });
    });
    expect((await leaveSeat('t')).teams[0].seats).toEqual([null]);
    await shuffleSeats('t');
    expect(calls).toEqual(['POST /room/t/leave', 'POST /room/t/shuffle']);
  });

  it("sends the host's seating to the server, and reads who is standing or invited", async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url} ${init.body ?? ''}`.trim());
      return new Response(
        JSON.stringify({ teams: [{ handle: 'TEAM_1', players: [null] }], standing: [{ handle: 'ann', name: 'Ann' }], invited: [{ handle: 'ben', name: 'Ben', invited_by: 'host' }] }),
        { status: 200 },
      );
    });
    const room = await seatPlayer('t', 'ann', { handle: 'TEAM_2', index: 1, seats: [null] }, 0);
    expect(room.standing).toEqual([{ handle: 'ann', name: 'Ann' }]);
    expect(room.invited).toEqual([{ handle: 'ben', name: 'Ben' }]);
    await unseatPlayer('t', 'ann');
    await kickPlayer('t', 'ann');
    await uninvitePlayer('t', 'b en');
    expect(calls).toEqual([
      'POST /room/t/seat {"handle":"ann","team_handle":"TEAM_2","seat":0}',
      'POST /room/t/unseat {"handle":"ann"}',
      'POST /room/t/kick {"handle":"ann"}',
      'DELETE /room/t/invitations/b%20en',
    ]);
  });

  it("passes the server's reason through", async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'NOT_SEATED', message: "You don't have a seat at this table." }), { status: 409 }));
    await expect(leaveSeat('t')).rejects.toMatchObject({ message: "You don't have a seat at this table." });
  });

  it('asks to rejoin, and lets the host answer', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push(`${init.method ?? 'GET'} ${url}`);
      if (url.endsWith('/removed')) {
        return new Response(
          JSON.stringify({
            removed: [
              { handle: 'ann', name: 'Ann', rejoin_requested_at: null, rejoin_declined: false },
              { handle: 'dan', name: 'Dan', rejoin_requested_at: '2026-10-25T10:00:00Z', rejoin_declined: false },
              { handle: 'eve', name: 'Eve', rejoin_requested_at: '2026-10-25T09:00:00Z', rejoin_declined: true },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/rejoin/dan')) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ removed: true, requested: true, declined: false, teams: [] }), { status: 200 });
    });
    expect(await getRejoinStatus('t')).toEqual({ removed: true, requested: true, declined: false });
    await requestRejoin('t');
    // Whoever is asking comes first.
    expect(await listRemoved('t')).toEqual([
      { handle: 'dan', name: 'Dan', asking: true, declined: false },
      { handle: 'ann', name: 'Ann', asking: false, declined: false },
      { handle: 'eve', name: 'Eve', asking: false, declined: true },
    ]);
    await readmitPlayer('t', 'dan');
    await declineRejoin('t', 'dan');
    expect(calls).toEqual(['GET /room/t/rejoin', 'POST /room/t/rejoin', 'GET /room/t/removed', 'POST /room/t/readmit', 'DELETE /room/t/rejoin/dan']);
  });

  it('says when asking to rejoin took an invitation back to the table', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ removed: false, requested: false, declined: false, joined: true }), { status: 200 }));
    expect(await requestRejoin('t')).toEqual({ removed: false, requested: false, declined: false, joined: true });
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ removed: true, requested: true, declined: false }), { status: 200 }));
    expect(await requestRejoin('t')).toEqual({ removed: true, requested: true, declined: false, joined: false });
  });

  it('counts a signed-out rejoin check as not removed', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'NOT_SIGNED_IN' }), { status: 401 }));
    expect(await getRejoinStatus('t')).toEqual({ removed: false, requested: false, declined: false });
  });

  it('enters a table, and copes when it can\'t', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      return new Response(JSON.stringify({ member: false, removed: true }), { status: 200 });
    });
    expect(await enterRoom('t')).toEqual({ removed: true });
    expect(calls).toEqual(['POST /room/t/enter']);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'NOT_SIGNED_IN' }), { status: 401 }));
    expect(await enterRoom('t')).toEqual({ removed: false });
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    expect(await enterRoom('t')).toEqual({ removed: false });
  });
});
