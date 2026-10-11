import { describe, expect, it } from 'vitest';
import { BOARD_LAYOUT, BOARD_SIZE, isCorner, positionsOf } from './board';
import { RANKS, SUITS, cardKind, cardLabel, fullDeck, isCardName, type CardName } from './cards';

describe('board layout', () => {
  it('is 10×10 with Blank in the four corners', () => {
    expect(BOARD_LAYOUT).toHaveLength(BOARD_SIZE);
    BOARD_LAYOUT.forEach((row) => expect(row).toHaveLength(BOARD_SIZE));
    for (const [row, column] of [[0, 0], [0, 9], [9, 0], [9, 9]]) expect(isCorner({ row, column })).toBe(true);
  });

  it('matches game-domain.md spot checks', () => {
    expect(BOARD_LAYOUT[0][1]).toBe('6-Diamond');
    expect(BOARD_LAYOUT[1][9]).toBe('A-Club');
    expect(BOARD_LAYOUT[5][0]).toBe('A-Spade');
    expect(BOARD_LAYOUT[9][8]).toBe('2-Spade');
  });

  it('has every non-jack card exactly twice and no jacks', () => {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const card = `${rank}-${suit}` as CardName;
        expect(positionsOf(card)).toHaveLength(rank === 'J' ? 0 : 2);
      }
    }
  });
});

describe('cards', () => {
  it('builds a 104-card deck with every card twice', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(104);
    expect(deck.filter((c) => c === '10-Heart')).toHaveLength(2);
  });

  it('classifies jacks', () => {
    expect(cardKind('J-Club')).toBe('two-eyed-jack');
    expect(cardKind('J-Diamond')).toBe('two-eyed-jack');
    expect(cardKind('J-Spade')).toBe('one-eyed-jack');
    expect(cardKind('J-Heart')).toBe('one-eyed-jack');
    expect(cardKind('Q-Heart')).toBe('normal');
  });

  it('parses and labels names', () => {
    expect(isCardName('10-Heart')).toBe(true);
    expect(isCardName('Blank')).toBe(false);
    expect(isCardName('11-Heart')).toBe(false);
    expect(cardLabel('7-Heart')).toBe('7 of Hearts');
    expect(cardLabel('Q-Spade')).toBe('Queen of Spades');
  });
});
