import { describe, expect, it } from 'vitest';
import { describeDraft, draftLostMessage, draftProblem, draftQueuedMessage, type Draft } from './draft';

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
  it('name a normal card alone, since its cell has the same name and is on the board twice', () => {
    expect(describeDraft(draft)).toBe('6♦');
    expect(describeDraft(draft, 'numbers')).toBe('#29');
    expect(draftQueuedMessage(draft, 'numbers')).toBe('Next turn: #29 goes on the marked cell. Tap the Queued card to cancel.');
  });

  it('name the cell for a jack', () => {
    expect(describeDraft({ ...draft, card: 'J-Club' })).toBe('J♣ on 6♦');
    expect(draftQueuedMessage({ ...draft, card: 'J-Club' })).toBe('Next turn: J♣ goes on the marked 6♦. Tap the Queued card to cancel.');
    expect(draftQueuedMessage({ ...draft, card: 'J-Spade' })).toBe('Next turn: J♠ removes the marked 6♦ chip. Tap the Queued card to cancel.');
  });

  it('say why a draft was lost', () => {
    expect(draftLostMessage(draft, 'cell-unavailable')).toBe("Your drafted move (6♦) can't be played: that cell has been taken. Draft another move.");
    expect(draftLostMessage({ ...draft, card: 'J-Spade' }, 'cell-unavailable')).toContain("that chip can't be removed any more");
  });
});
