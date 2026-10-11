// Card names follow the backend exactly: `<rank>-<Suit>` (e.g. `10-Heart`, `J-Spade`),
// plus `Blank` for the four board corners. See backend docs/game-domain.md.

export const SUITS = ['Club', 'Diamond', 'Heart', 'Spade'] as const;
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type CardName = `${Rank}-${Suit}`;
export type BoardCardName = CardName | 'Blank';

export const BLANK = 'Blank' as const;

/** Two-eyed jacks are wild: place a chip on any empty cell. */
export const TWO_EYED_JACKS: readonly CardName[] = ['J-Club', 'J-Diamond'];
/** One-eyed jacks remove an opponent's chip that is not part of a sequence. */
export const ONE_EYED_JACKS: readonly CardName[] = ['J-Spade', 'J-Heart'];

export type CardKind = 'normal' | 'two-eyed-jack' | 'one-eyed-jack';

export function cardKind(name: CardName): CardKind {
  if (TWO_EYED_JACKS.includes(name)) return 'two-eyed-jack';
  if (ONE_EYED_JACKS.includes(name)) return 'one-eyed-jack';
  return 'normal';
}

export function isCardName(value: unknown): value is CardName {
  if (typeof value !== 'string') return false;
  const [rank, suit, ...rest] = value.split('-');
  return rest.length === 0 && (RANKS as readonly string[]).includes(rank) && (SUITS as readonly string[]).includes(suit);
}

export function parseCard(name: CardName): { rank: Rank; suit: Suit } {
  const [rank, suit] = name.split('-') as [Rank, Suit];
  return { rank, suit };
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'Heart' || suit === 'Diamond';
}

export const SUIT_SYMBOL: Record<Suit, string> = { Club: '♣', Diamond: '♦', Heart: '♥', Spade: '♠' };

const RANK_WORD: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace',
};

/** Human-readable name, e.g. "7 of Hearts", "Queen of Spades", "Corner". */
export function cardLabel(name: BoardCardName): string {
  if (name === BLANK) return 'Free corner';
  const { rank, suit } = parseCard(name);
  return `${RANK_WORD[rank]} of ${suit}s`;
}

/** Short label for logs, e.g. "7♥". */
export function cardShort(name: BoardCardName): string {
  if (name === BLANK) return 'corner';
  const { rank, suit } = parseCard(name);
  return `${rank}${SUIT_SYMBOL[suit]}`;
}

/** The draw deck: two standard 52-card decks, no jokers (104 cards). */
export function fullDeck(): CardName[] {
  const deck: CardName[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) for (const rank of RANKS) deck.push(`${rank}-${suit}`);
  }
  return deck;
}

/** Image served by the backend at /images/card_deck/Cards-<name>.svg. */
export function cardImageUrl(name: BoardCardName | 'Reverse'): string {
  return `/images/card_deck/Cards-${name}.svg`;
}
