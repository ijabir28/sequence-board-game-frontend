import { describe, expect, it } from 'vitest';
import { sameHand, sameNumbers } from './stableValue';

describe('sameHand', () => {
  it('compares cards and dead marks slot by slot', () => {
    const hand = [
      { card: 'A-Spade' as const, dead: false },
      { card: '2-Heart' as const, dead: true },
    ];
    expect(sameHand(hand, hand.map((h) => ({ ...h })))).toBe(true);
    expect(sameHand(hand, [hand[1], hand[0]])).toBe(false);
    expect(sameHand(hand, [hand[0], { ...hand[1], dead: false }])).toBe(false);
    expect(sameHand(hand, [hand[0]])).toBe(false);
  });
});

describe('sameNumbers', () => {
  it('compares in order', () => {
    expect(sameNumbers([0, 1, 2], [0, 1, 2])).toBe(true);
    expect(sameNumbers([0, 1, 2], [0, 2, 1])).toBe(false);
  });
});
