import { describe, expect, it } from 'vitest';
import { avatarTeam, initials } from './Avatar';

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Jabir ibne kamal')).toBe('JI');
    expect(initials('  sakib ')).toBe('S');
    expect(initials('')).toBe('');
  });

  it('keeps letters outside the basic plane whole', () => {
    expect(initials('😀 smile')).toBe('😀S');
  });
});

describe('avatarTeam', () => {
  it('is the same team colour for the same handle', () => {
    expect(avatarTeam('jabir')).toBe(avatarTeam('jabir'));
    expect([0, 1, 2]).toContain(avatarTeam('jabir'));
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(avatarTeam)).size).toBeGreaterThan(1);
  });
});
