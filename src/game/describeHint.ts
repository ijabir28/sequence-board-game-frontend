import { BOARD_LAYOUT } from '../engine/board';
import { cardKind, cardShort, type CardName, type CardNotation } from '../engine/cards';
import type { Hint } from '../engine/hints';
import { teamName } from './teams';

/** A training hint in plain language, e.g. "Play 7♥ on 7♥: it blocks Team Blue's line of 4." */
export function describeHint(hint: Hint, hand: readonly CardName[], notation: CardNotation = 'suits'): string {
  if (hint.type === 'pass') return 'No card in your hand can be played. Pass your turn.';
  const card = hand[hint.handIndex];
  const name = card ? cardShort(card, notation) : 'that card';
  if (hint.type === 'exchange') return `${name} is dead: both of its cells are taken. Exchange it for a new card first.`;

  const cell = cardShort(BOARD_LAYOUT[hint.target.row][hint.target.column], notation);
  const reason = hint.reason;
  if (reason.kind === 'break') {
    return `Use ${name} to remove ${teamName(reason.team)}'s chip on ${cell}. It breaks up their line of ${reason.length}.`;
  }
  const play = card && cardKind(card) === 'two-eyed-jack' ? `Play ${notation === 'numbers' ? name : `wild ${name}`} on ${cell}` : `Play ${name} on ${cell}`;
  switch (reason.kind) {
    case 'sequence':
      return `${play}: it completes a sequence.`;
    case 'block':
      return reason.length >= 5
        ? `${play}: otherwise ${teamName(reason.team)} can complete a sequence there.`
        : `${play}: it blocks ${teamName(reason.team)}'s line of ${reason.length}.`;
    case 'extend':
      return reason.length > 1 ? `${play}: it builds your line to ${reason.length}.` : `${play}: nothing better is open, so start a new line.`;
    default:
      return `${play}.`;
  }
}
