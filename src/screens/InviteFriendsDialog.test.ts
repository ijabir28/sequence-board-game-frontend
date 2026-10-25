import { describe, expect, it } from 'vitest';
import { waitLabel } from './InviteFriendsDialog';

describe('waitLabel', () => {
  const at = (ms: number) => new Date(ms).toISOString();

  it('counts the short waits in seconds, and the rest in minutes and hours, rounded up', () => {
    expect(waitLabel(at(10_000), 0)).toBe('10 s');
    expect(waitLabel(at(29_001), 0)).toBe('30 s');
    expect(waitLabel(at(59_000), 0)).toBe('59 s');
    expect(waitLabel(at(60_000), 0)).toBe('1 min');
    expect(waitLabel(at(179_000), 0)).toBe('3 min');
    expect(waitLabel(at(80 * 60_000), 0)).toBe('1 h 20 min');
    expect(waitLabel(at(0), 1000)).toBe('1 s');
  });
});
