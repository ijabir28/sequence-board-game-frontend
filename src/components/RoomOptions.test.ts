import { describe, expect, it } from 'vitest';
import { describeTiming, followDraft } from './RoomOptions';

describe('followDraft', () => {
  it('keeps what was typed when it already reads as the saved number', () => {
    expect(followDraft('045', 45)).toBe('045');
    expect(followDraft('45', 45)).toBe('45');
  });

  it('takes the saved number when the field says something else, or nothing', () => {
    expect(followDraft('4', 45)).toBe('45');
    expect(followDraft('', 0)).toBe('0');
  });
});

describe('describeTiming', () => {
  it('says what the turn timer or the blitz clock does', () => {
    expect(describeTiming({ turnSeconds: 60, clockSeconds: null })).toMatch(/^Each player has 1 min per turn\./);
    expect(describeTiming({ turnSeconds: 60, clockSeconds: 300 })).toMatch(/^Blitz: each team has 5 min for the whole round/);
  });
});
