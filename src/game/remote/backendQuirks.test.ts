import { describe, expect, it } from 'vitest';
import { interpretPlay, teamFromOccupiedBy } from './backendQuirks';

describe('backend quirks', () => {
  it('maps legacy team handles', () => {
    expect(teamFromOccupiedBy('team1')).toBe(0);
    expect(teamFromOccupiedBy('team2')).toBe(1);
    expect(teamFromOccupiedBy('TEAM_3')).toBe(2);
    expect(teamFromOccupiedBy(undefined)).toBeNull();
    expect(teamFromOccupiedBy('nobody')).toBeNull();
  });

  it('interprets /game/play responses', () => {
    expect(interpretPlay(200, '{"verdict":"Valid"}')).toEqual({ kind: 'applied' });
    expect(interpretPlay(404, 'Invalid Move')).toEqual({ kind: 'invalid' });
    expect(interpretPlay(500, '<pre>ReferenceError: current_team is not defined</pre>')).toEqual({ kind: 'known-500' });
    expect(interpretPlay(500, '<html>other</html>')).toEqual({ kind: 'server-error', status: 500 });
  });
});
