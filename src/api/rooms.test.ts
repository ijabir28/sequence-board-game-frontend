import { describe, expect, it } from 'vitest';
import { isSeated, sanitizeRoom } from './rooms';

describe('sanitizeRoom', () => {
  const raw = {
    administrator: 'jabir',
    teams: [
      { handle: 'TEAM_1', players: [{ name: 'Jabir ibne kamal', password: '1' }, null] },
      { handle: 'TEAM_2', players: [null, null] },
    ],
  };

  it('drops passwords and keeps seats', () => {
    const room = sanitizeRoom('42', raw);
    expect(JSON.stringify(room)).not.toContain('password');
    expect(room.teams[0].seats).toEqual([{ name: 'Jabir ibne kamal' }, null]);
    expect(room.teams[1].index).toBe(1);
    expect(room.administrator).toBe('jabir');
  });

  it('finds whether a name is seated', () => {
    const room = sanitizeRoom('42', raw);
    expect(isSeated(room, 'Jabir ibne kamal')).toBe(true);
    expect(isSeated(room, 'Sakib')).toBe(false);
  });

  it('tolerates a room created without a session', () => {
    expect(sanitizeRoom('1', { teams: [] }).administrator).toBeNull();
  });
});
