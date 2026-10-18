import { BOARD_LAYOUT, type Pos } from '../engine/board';
import { cardKind, cardShort, type CardName, type CardNotation } from '../engine/cards';
import type { HandCardView } from './types';

/**
 * A move drafted while it is someone else's turn: it is played for the viewer as soon as their turn comes, unless a
 * move in the meantime rules it out. Only ever on this device; the server never sees a draft.
 */
export interface Draft {
  handIndex: number;
  /** The card at handIndex when the move was drafted, to notice if the hand changed under it. */
  card: CardName;
  target: Pos;
}

export type DraftProblem = 'card-gone' | 'cell-unavailable';

/**
 * Why `draft` can no longer be played, or null if it still can. `targets` are the cells its card may target now
 * (the rules engine's legal targets for draft.handIndex on the current board).
 */
export function draftProblem(draft: Draft, hand: readonly HandCardView[], targets: readonly Pos[]): DraftProblem | null {
  if (hand[draft.handIndex]?.card !== draft.card) return 'card-gone';
  return targets.some((t) => t.row === draft.target.row && t.column === draft.target.column) ? null : 'cell-unavailable';
}

/** "9♥ on 9♥", "J♣ on 7♦": the card, and the cell (by the card printed on it). */
export function describeDraft(draft: Draft, notation: CardNotation = 'suits'): string {
  return `${cardShort(draft.card, notation)} on ${cardShort(BOARD_LAYOUT[draft.target.row][draft.target.column], notation)}`;
}

/** What to tell the player when another move rules their draft out. */
export function draftLostMessage(draft: Draft, problem: DraftProblem, notation: CardNotation = 'suits'): string {
  const cell = cardShort(BOARD_LAYOUT[draft.target.row][draft.target.column], notation);
  const why =
    problem === 'card-gone'
      ? `${cardShort(draft.card, notation)} is no longer in your hand`
      : cardKind(draft.card) === 'one-eyed-jack'
        ? `the chip on ${cell} can't be removed any more`
        : `${cell} has been taken`;
  return `Your drafted move (${describeDraft(draft, notation)}) can't be played: ${why}. Draft another move.`;
}
