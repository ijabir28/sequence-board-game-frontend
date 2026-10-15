import { describe, expect, it } from 'vitest';
import { sanitizeRoom } from '../api/rooms';
import { describeShuffle, describeTeams } from './teamNotice';

const room = sanitizeRoom('t', {
  teams: [
    { handle: 'TEAM_1', players: [{ handle: 'ana', name: 'Ana' }, { handle: 'ben', name: 'Ben' }] },
    { handle: 'TEAM_2', players: [{ handle: 'cy', name: 'Cy' }, null] },
    { handle: 'TEAM_3', players: [null, null] },
  ],
});

describe('team notices', () => {
  it("lists who is on each team, leaving out empty ones", () => {
    expect(describeTeams(room)).toBe('Green: Ana, Ben · Blue: Cy');
  });

  it('tells a seated player their new team, by display name', () => {
    expect(describeShuffle(room, 'Jabir', 'cy')).toBe("Jabir shuffled the teams. You're now on Team Blue. Green: Ana, Ben · Blue: Cy.");
    expect(describeShuffle(room, 'Jabir', 'zed')).toBe('Jabir shuffled the teams. Green: Ana, Ben · Blue: Cy.');
  });
});
