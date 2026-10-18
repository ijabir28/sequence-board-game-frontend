import { useSyncExternalStore } from 'react';
import { cardImageUrl, type CardName } from '../engine/cards';

/*
 * The designs a player can pick for the cards in their hand. Each deck is a folder of SVGs in public/decks/<id>/
 * named after the cards (see public/decks/README.md for where each one comes from), except the original deck, which
 * the backend serves, and the drawn deck, which has no images at all.
 * The choice is remembered on this device, and on the account of a signed-in player (useAccountChoice.ts). It can be
 * changed at any time, also in the middle of a game.
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
  /** Its suit colours, which the board's cells follow: red and black, or a colour per suit. */
  suits: 'two' | 'four';
  /** The colour of its card faces, which the board's light cells take on. */
  face: string;
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
    suits: 'two',
    face: '#ffffff',
    image: (card) => cardImageUrl(card === 'back' ? 'Reverse' : card),
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional faces with detailed court cards.',
    credit: 'Byron Knoll, public domain (via MattCain/svg-playing-cards)',
    aspect: 167.09 / 242.67,
    suits: 'two',
    face: '#ffffff',
    image: folder('classic'),
  },
  {
    id: 'jumbo',
    name: 'Jumbo index',
    description: 'Big corner letters, easy to read on a small screen.',
    credit: 'saulspatz/SVGCards, public domain',
    aspect: 2 / 3,
    suits: 'two',
    face: '#fdfeee',
    image: folder('jumbo'),
  },
  {
    id: 'four-colour',
    name: 'Four colour',
    description: 'Jumbo index with a colour per suit: black spades, red hearts, blue diamonds, green clubs.',
    credit: 'saulspatz/SVGCards (Accessible set), public domain',
    aspect: 2 / 3,
    suits: 'four',
    face: '#fdfeee',
    image: folder('four-colour'),
  },
  {
    id: 'drawn',
    name: 'Minimal',
    description: 'Clean flat cards drawn by the app, matching the board. Nothing to download.',
    credit: 'Drawn by this app',
    aspect: 5 / 7,
    suits: 'two',
    face: '#ffffff',
    image: null,
  },
];

export const DEFAULT_DECK: DeckId = 'original';

export function deckById(id: string | null | undefined): Deck {
  return DECKS.find((deck) => deck.id === id) ?? DECKS.find((deck) => deck.id === DEFAULT_DECK)!;
}

/**
 * A choice remembered on this device. Every component reading it follows a change at once, also one made in another
 * tab.
 */
function preference<T extends string>(storageKey: string, parse: (saved: string | null) => T) {
  let value = load();
  const listeners = new Set<() => void>();

  function load(): T {
    try {
      return parse(window.localStorage.getItem(storageKey));
    } catch {
      return parse(null);
    }
  }

  function get(): T {
    return value;
  }

  function set(next: T) {
    value = parse(next);
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Private mode or full storage: the choice still holds for this visit.
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      value = parse(event.newValue);
      listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  return { get, set, subscribe, use: (): T => useSyncExternalStore(subscribe, get) };
}

const deckChoice = preference<DeckId>('sequence:deck', (saved) => deckById(saved).id);

export const currentDeck = deckChoice.get;
export const setDeck = deckChoice.set;
/** Calls `listener` whenever the deck changes; returns a function that stops it. */
export const onDeckChange = deckChoice.subscribe;

export function isDeckId(id: string | null | undefined): id is DeckId {
  return DECKS.some((deck) => deck.id === id);
}

/** The deck chosen on this device, and a way to change it. Every card on screen follows a change at once. */
export function useDeck(): [Deck, (id: DeckId) => void] {
  return [deckById(deckChoice.use()), setDeck];
}

/**
 * How the board's cells look: dark tiles on the felt (the default), or light card faces in the chosen deck's colours,
 * like a printed Sequence board. Remembered like the deck: on this device, and on a signed-in player's account.
 */
export type BoardStyle = 'dark' | 'cards';

export const BOARD_STYLES: readonly { id: BoardStyle; name: string; description: string }[] = [
  { id: 'dark', name: 'Dark tiles', description: 'Light letters on dark cells, easy on the eyes.' },
  { id: 'cards', name: 'Card faces', description: "Light cells like little cards, in your deck's colours." },
];

export const DEFAULT_BOARD_STYLE: BoardStyle = 'dark';

export function isBoardStyle(id: string | null | undefined): id is BoardStyle {
  return BOARD_STYLES.some((style) => style.id === id);
}

const boardChoice = preference<BoardStyle>('sequence:board-style', (saved) => (isBoardStyle(saved) ? saved : DEFAULT_BOARD_STYLE));

export const currentBoardStyle = boardChoice.get;
export const setBoardStyle = boardChoice.set;
/** Calls `listener` whenever the board style changes; returns a function that stops it. */
export const onBoardStyleChange = boardChoice.subscribe;

export function useBoardStyle(): [BoardStyle, (style: BoardStyle) => void] {
  return [boardChoice.use(), setBoardStyle];
}
