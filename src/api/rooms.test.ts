import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoom, isSeated, sanitizeMyRoom, sanitizeRoom } from './rooms';

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
});
