import { describe, expect, it } from 'vitest';
import { movedOrder, normalizeOrder } from './handOrder';

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
});
