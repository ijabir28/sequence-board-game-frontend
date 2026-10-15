import { describe, expect, it } from 'vitest';
import { isSeated, sanitizeRoom } from './rooms';

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
