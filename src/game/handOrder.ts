import { cardKind, parseCard, RANKS, SUITS, type CardName } from '../engine/cards';
import { shuffle } from '../engine/setup';

// The order a player sees their hand in, as a permutation: order[slot] is the index of the card in the real
// hand (the index the rules and the server use). Reordering is local to one view and never changes the game.
// A played card's replacement is drawn into the same index, so it appears in the played card's slot.

export type HandOrder = readonly number[];

export function identityOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

/** `order` if it is a permutation of 0..length-1, else the dealt order. */
export function normalizeOrder(order: HandOrder | null | undefined, length: number): number[] {
  if (!order || order.length !== length) return identityOrder(length);
  const seen = new Set(order);
  const valid = seen.size === length && order.every((i) => Number.isInteger(i) && i >= 0 && i < length);
  return valid ? [...order] : identityOrder(length);
}

export function shuffledOrder(order: HandOrder, random: () => number = Math.random): number[] {
  return shuffle(order, random);
}

/** Moves the card in slot `from` to slot `to`, shifting the cards between. */
export function movedOrder(order: HandOrder, from: number, to: number): number[] {
  const next = [...order];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [slot] = next.splice(from, 1);
  next.splice(to, 0, slot);
  return next;
}

/** Normal cards grouped by suit (♣ ♦ ♥ ♠) in rank order, then wild jacks, then one-eyed jacks. */
export function sortedOrder(hand: readonly CardName[]): number[] {
  const weight = (card: CardName) => {
    const kind = cardKind(card);
    if (kind === 'two-eyed-jack') return 1000 + SUITS.indexOf(parseCard(card).suit);
    if (kind === 'one-eyed-jack') return 2000 + SUITS.indexOf(parseCard(card).suit);
    const { rank, suit } = parseCard(card);
    return SUITS.indexOf(suit) * 100 + RANKS.indexOf(rank);
  };
  // Stable for equal cards (two decks), so sorting twice changes nothing.
  return identityOrder(hand.length).sort((a, b) => weight(hand[a]) - weight(hand[b]) || a - b);
}
