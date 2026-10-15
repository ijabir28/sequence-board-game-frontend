import { inBounds, type Pos } from './board';
import { cardKind } from './cards';
import { canExchange, isDeadCard, legalTargets, type GameState } from './game';
import { countsFor, DIRECTIONS, findNewSequences, type ChipGrid } from './sequences';
import type { TeamIndex } from './setup';

// Hints for training games: one suggested move for the current player, and why. Matches the backend's
// entity/hints.js, so hot-seat training games hint the same way tables do.

export type HintReason =
  | { kind: 'sequence' }
  | { kind: 'extend'; length: number }
  | { kind: 'block'; length: number; team: TeamIndex }
  | { kind: 'break'; length: number; team: TeamIndex }
  | { kind: 'dead' }
  | { kind: 'pass' };

export type Hint =
  | { type: 'play'; handIndex: number; target: Pos; reason: HintReason }
  | { type: 'exchange'; handIndex: number; reason: HintReason }
  | { type: 'pass'; reason: HintReason };

// Wild jacks are worth keeping, so a normal card that does as well is preferred.
const WILD_JACK_COST = 15;
const ONE_EYED_JACK_COST = 12;

/** The longest line through `pos` that counts for `team` (its chips and the corners), in any direction. */
export function longestLine(chips: ChipGrid, pos: Pos, team: TeamIndex): number {
  let longest = 0;
  for (const dir of DIRECTIONS) {
    let length = 1;
    for (const sign of [1, -1]) {
      let p = { row: pos.row + sign * dir.row, column: pos.column + sign * dir.column };
      while (inBounds(p) && countsFor(chips, p, team)) {
        length++;
        p = { row: p.row + sign * dir.row, column: p.column + sign * dir.column };
      }
    }
    longest = Math.max(longest, length);
  }
  return longest;
}

function withChip(chips: ChipGrid, pos: Pos, team: TeamIndex): (TeamIndex | null)[][] {
  const next = chips.map((row) => [...row]);
  next[pos.row][pos.column] = team;
  return next;
}

function placing(state: GameState, team: TeamIndex, pos: Pos, wild: boolean): { score: number; reason: HintReason } {
  const placed = withChip(state.chips, pos, team);
  const cost = wild ? WILD_JACK_COST : 0;
  if (findNewSequences(placed, state.sequences, team, pos).length > 0) return { score: 1000 - cost, reason: { kind: 'sequence' } };
  const own = longestLine(placed, pos, team);
  let block: { length: number; team: TeamIndex | null } = { length: 0, team: null };
  for (let other = 0; other < state.teamCount; other++) {
    if (other === team) continue;
    const length = longestLine(withChip(state.chips, pos, other as TeamIndex), pos, other as TeamIndex);
    if (length > block.length) block = { length, team: other as TeamIndex };
  }
  // A cell that would give an opponent five in a row must be taken now.
  const blockScore = block.length >= 5 ? 900 : block.length * 9;
  if (own * 10 >= blockScore || block.team === null) return { score: own * 10 - cost, reason: { kind: 'extend', length: own } };
  return { score: blockScore - cost, reason: { kind: 'block', length: block.length, team: block.team } };
}

function removing(state: GameState, pos: Pos): { score: number; reason: HintReason } {
  const owner = state.chips[pos.row][pos.column]!;
  const length = longestLine(state.chips, pos, owner);
  return { score: length * 9 - ONE_EYED_JACK_COST, reason: { kind: 'break', length, team: owner } };
}

/** The suggested move for the current player, or null once the game is over. Deterministic. */
export function suggestMove(state: GameState): Hint | null {
  if (state.winner !== null) return null;
  const hand = state.hands[state.current];
  const team = state.players[state.current].team;

  if (canExchange(state)) {
    return { type: 'exchange', handIndex: hand.findIndex((card) => isDeadCard(state, card)), reason: { kind: 'dead' } };
  }

  let best: { score: number; hint: Hint } | null = null;
  hand.forEach((card, handIndex) => {
    const kind = cardKind(card);
    for (const target of legalTargets(state, handIndex)) {
      const scored = kind === 'one-eyed-jack' ? removing(state, target) : placing(state, team, target, kind === 'two-eyed-jack');
      // Ties go to the earlier card, then the earlier cell, so hints are stable.
      if (best === null || scored.score > best.score) best = { score: scored.score, hint: { type: 'play', handIndex, target, reason: scored.reason } };
    }
  });
  return best === null ? { type: 'pass', reason: { kind: 'pass' } } : (best as { hint: Hint }).hint;
}
