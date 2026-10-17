import { describe, expect, it } from 'vitest';
import { describeDraft, draftLostMessage, draftProblem, type Draft } from './draft';

// Row 0, column 1 is 6♦ on the board.
const draft: Draft = { handIndex: 1, card: '6-Diamond', target: { row: 0, column: 1 } };
const hand = [
  { card: 'A-Heart' as const, dead: false },
  { card: '6-Diamond' as const, dead: false },
];

describe('draftProblem', () => {
  it('is fine while the card is in hand and the cell is still a legal target', () => {
    expect(draftProblem(draft, hand, [{ row: 0, column: 1 }, { row: 5, column: 5 }])).toBeNull();
  });

  it('notices the cell is no longer a legal target', () => {
    expect(draftProblem(draft, hand, [{ row: 5, column: 5 }])).toBe('cell-unavailable');
  });

  it('notices the card is no longer at its place in the hand', () => {
    expect(draftProblem(draft, [hand[1], hand[0]], [{ row: 0, column: 1 }])).toBe('card-gone');
  });
});

describe('draft messages', () => {
  it('name the card and the cell', () => {
    expect(describeDraft(draft)).toBe('6♦ on 6♦');
    expect(draftLostMessage(draft, 'cell-unavailable')).toBe("Your drafted move (6♦ on 6♦) can't be played: 6♦ has been taken. Draft another move.");
    expect(draftLostMessage({ ...draft, card: 'J-Spade' }, 'cell-unavailable')).toContain("the chip on 6♦ can't be removed any more");
  });
});
