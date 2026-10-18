import { describe, expect, it } from 'vitest';
import { RANKS, SUITS, cardLabel, cardNumber, cardShort, numberedLabel, type CardName } from './cards';

describe('numbered deck', () => {
  it('counts hearts, clubs, diamonds then spades, 2 to Ace', () => {
    expect(cardNumber('2-Heart')).toBe(1);
    expect(cardNumber('A-Heart')).toBe(12);
    expect(cardNumber('2-Club')).toBe(13);
    expect(cardNumber('A-Club')).toBe(24);
    expect(cardNumber('2-Diamond')).toBe(25);
    expect(cardNumber('A-Diamond')).toBe(36);
    expect(cardNumber('2-Spade')).toBe(37);
    expect(cardNumber('A-Spade')).toBe(48);
    expect(cardNumber('10-Heart')).toBe(9);
    expect(cardNumber('Q-Heart')).toBe(10);
  });

  it('gives the 48 non-jack cards the numbers 1 to 48 once each', () => {
    const numbers = SUITS.flatMap((suit) => RANKS.filter((rank) => rank !== 'J').map((rank) => cardNumber(`${rank}-${suit}` as CardName)));
    expect([...numbers].sort((a, b) => a! - b!)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
  });

  it('names the jacks after what they do', () => {
    for (const suit of SUITS) expect(cardNumber(`J-${suit}`)).toBeNull();
    expect(numberedLabel('J-Club')).toBe('Wild');
    expect(numberedLabel('J-Diamond')).toBe('Wild');
    expect(numberedLabel('J-Heart')).toBe('Remove');
    expect(numberedLabel('J-Spade')).toBe('Remove');
    expect(numberedLabel('2-Diamond')).toBe('25');
  });

  it('labels cards in either notation', () => {
    expect(cardShort('2-Diamond')).toBe('2♦');
    expect(cardShort('2-Diamond', 'numbers')).toBe('#25');
    expect(cardShort('J-Club', 'numbers')).toBe('Wild card');
    expect(cardShort('Blank', 'numbers')).toBe('corner');
    expect(cardLabel('A-Spade', 'numbers')).toBe('Card 48');
    expect(cardLabel('J-Heart', 'numbers')).toBe('Remove jack');
  });
});
