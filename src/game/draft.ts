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

function draftCell(draft: Draft, notation: CardNotation): string {
  return cardShort(BOARD_LAYOUT[draft.target.row][draft.target.column], notation);
}

/**
 * "6♦", "J♣ on 7♦": the drafted card, and its cell only for a jack. A normal card's cell carries the same name, and
 * every card is on the board twice, so naming it would say nothing.
 */
export function describeDraft(draft: Draft, notation: CardNotation = 'suits'): string {
  const card = cardShort(draft.card, notation);
  return cardKind(draft.card) === 'normal' ? card : `${card} on ${draftCell(draft, notation)}`;
}

/**
 * The prompt while a draft waits, kept to two lines on a phone. It points at the cell the board rings rather than
 * naming it, and at the hand card tagged "Queued".
 */
export function draftQueuedMessage(draft: Draft, notation: CardNotation = 'suits'): string {
  const card = cardShort(draft.card, notation);
  const kind = cardKind(draft.card);
  const move =
    kind === 'normal'
      ? `${card} goes on the marked cell`
      : kind === 'two-eyed-jack'
        ? `${card} goes on the marked ${draftCell(draft, notation)}`
        : `${card} removes the marked ${draftCell(draft, notation)} chip`;
  return `Next turn: ${move}. Tap the Queued card to cancel.`;
}

/** What to tell the player when another move rules their draft out. */
export function draftLostMessage(draft: Draft, problem: DraftProblem, notation: CardNotation = 'suits'): string {
  const why =
    problem === 'card-gone'
      ? `${cardShort(draft.card, notation)} is no longer in your hand`
      : cardKind(draft.card) === 'one-eyed-jack'
        ? "that chip can't be removed any more"
        : 'that cell has been taken';
  return `Your drafted move (${describeDraft(draft, notation)}) can't be played: ${why}. Draft another move.`;
}
