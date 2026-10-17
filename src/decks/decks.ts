import { useSyncExternalStore } from 'react';
import { cardImageUrl, type CardName } from '../engine/cards';

/*
 * The designs a player can pick for the cards in their hand. Each deck is a folder of SVGs in public/decks/<id>/
 * named after the cards (see public/decks/README.md for where each one comes from), except the original deck, which
 * the backend serves, and the drawn deck, which has no images at all.
 * The choice is remembered on this device and can be changed at any time, also in the middle of a game.
 */

export type DeckId = 'original' | 'classic' | 'jumbo' | 'four-colour' | 'drawn';

export interface Deck {
  id: DeckId;
  name: string;
  /** One line for the picker. */
  description: string;
  /** Who made the artwork. */
  credit: string;
  /** Width over height of its cards, so they are never cropped. */
  aspect: number;
  /** The face of `card` (or the back), or null for the drawn deck. */
  image: ((card: CardName | 'back') => string) | null;
}

function folder(id: DeckId) {
  return (card: CardName | 'back') => `/decks/${id}/${card}.svg`;
}

export const DECKS: readonly Deck[] = [
  {
    id: 'original',
    name: 'Original',
    description: 'The deck the game has always used.',
    credit: 'Served by the game server',
    aspect: 5 / 7,
    image: (card) => cardImageUrl(card === 'back' ? 'Reverse' : card),
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional faces with detailed court cards.',
    credit: 'Byron Knoll, public domain (via MattCain/svg-playing-cards)',
    aspect: 167.09 / 242.67,
    image: folder('classic'),
  },
  {
    id: 'jumbo',
    name: 'Jumbo index',
    description: 'Big corner letters, easy to read on a small screen.',
    credit: 'saulspatz/SVGCards, public domain',
    aspect: 2 / 3,
    image: folder('jumbo'),
  },
  {
    id: 'four-colour',
    name: 'Four colour',
    description: 'Jumbo index with a colour per suit: black spades, red hearts, blue diamonds, green clubs.',
    credit: 'saulspatz/SVGCards (Accessible set), public domain',
    aspect: 2 / 3,
    image: folder('four-colour'),
  },
  {
    id: 'drawn',
    name: 'Minimal',
    description: 'Clean flat cards drawn by the app, matching the board. Nothing to download.',
    credit: 'Drawn by this app',
    aspect: 5 / 7,
    image: null,
  },
];

export const DEFAULT_DECK: DeckId = 'original';

export function deckById(id: string | null | undefined): Deck {
  return DECKS.find((deck) => deck.id === id) ?? DECKS.find((deck) => deck.id === DEFAULT_DECK)!;
}

const STORAGE_KEY = 'sequence:deck';

let current: DeckId = load();
const listeners = new Set<() => void>();

function load(): DeckId {
  try {
    return deckById(window.localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_DECK;
  }
}

export function currentDeck(): DeckId {
  return current;
}

export function setDeck(next: DeckId) {
  current = deckById(next).id;
  try {
    window.localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Private mode or full storage: the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changing the deck changes it here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = deckById(event.newValue).id;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** The deck chosen on this device, and a way to change it. Every card on screen follows a change at once. */
export function useDeck(): [Deck, (id: DeckId) => void] {
  return [deckById(useSyncExternalStore(subscribe, currentDeck)), setDeck];
}
