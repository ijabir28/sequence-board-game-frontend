import { describe, expect, it } from 'vitest';
import type { CardName } from '../engine/cards';
import { seededRandom } from '../engine/setup';
import { identityOrder, movedOrder, normalizeOrder, shuffledOrder, sortedOrder } from './handOrder';

describe('hand order', () => {
  it('falls back to the dealt order when the saved one no longer fits', () => {
    expect(normalizeOrder([2, 0, 1], 3)).toEqual([2, 0, 1]);
    expect(normalizeOrder([2, 0], 3)).toEqual([0, 1, 2]);
    expect(normalizeOrder([0, 0, 1], 3)).toEqual([0, 1, 2]);
    expect(normalizeOrder([0, 1, 5], 3)).toEqual([0, 1, 2]);
    expect(normalizeOrder(null, 2)).toEqual([0, 1]);
  });

  it('moves a card between slots', () => {
    expect(movedOrder([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
    expect(movedOrder([0, 1, 2, 3], 3, 0)).toEqual([3, 0, 1, 2]);
    expect(movedOrder([0, 1, 2], 1, 9)).toEqual([0, 1, 2]);
  });

  it('shuffles into another permutation of the same cards', () => {
    const shuffled = shuffledOrder(identityOrder(7), seededRandom(1));
    expect([...shuffled].sort()).toEqual(identityOrder(7));
    expect(shuffled).not.toEqual(identityOrder(7));
  });

  it('sorts by suit and rank, with jacks last', () => {
    const hand: CardName[] = ['J-Spade', 'K-Heart', '2-Heart', 'J-Club', '10-Club', 'A-Club', '10-Club'];
    expect(sortedOrder(hand).map((i) => hand[i])).toEqual(['10-Club', '10-Club', 'A-Club', '2-Heart', 'K-Heart', 'J-Club', 'J-Spade']);
    expect(sortedOrder(hand)).toEqual([4, 6, 5, 2, 1, 3, 0]);
  });
});
