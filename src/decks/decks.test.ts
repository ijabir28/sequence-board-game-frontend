import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RANKS, SUITS, type CardName } from '../engine/cards';
import { DECKS, DEFAULT_DECK, deckById } from './decks';

const PUBLIC = join(__dirname, '..', '..', 'public');

describe('deckById', () => {
  it('finds a deck by its id', () => {
    expect(deckById('jumbo').name).toBe('Jumbo index');
  });

  it('falls back to the default deck for an unknown or missing id', () => {
    expect(deckById('no-such-deck').id).toBe(DEFAULT_DECK);
    expect(deckById(null).id).toBe(DEFAULT_DECK);
  });
});

describe('DECKS', () => {
  it('has unique ids', () => {
    expect(new Set(DECKS.map((deck) => deck.id)).size).toBe(DECKS.length);
  });

  // The original deck comes from the backend; every other image deck must ship all 52 faces and a back.
  it.each(DECKS.filter((deck) => deck.image && deck.id !== 'original').map((deck) => [deck.id, deck]))('%s has every card', (_, deck) => {
    const cards: (CardName | 'back')[] = ['back'];
    for (const suit of SUITS) for (const rank of RANKS) cards.push(`${rank}-${suit}`);
    const missing = cards.filter((card) => !existsSync(join(PUBLIC, deck.image!(card))));
    expect(missing).toEqual([]);
  });
});
