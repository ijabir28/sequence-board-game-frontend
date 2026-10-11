import { describe, expect, it } from 'vitest';
import { isCorner } from './board';
import { applyMove, canExchange, createGame, isDeadCard, legalTargets, sequenceCount, type GameState } from './game';
import { seededRandom, sequencesToWin } from './setup';

/** Plays random legal moves (exchanging dead cards first) until someone wins or the turn cap. */
function playOut(state: GameState, random: () => number, maxTurns = 2000): GameState {
  let g = state;
  while (g.winner === null && g.turn < maxTurns) {
    const hand = g.hands[g.current];
    const dead = hand.findIndex((c) => isDeadCard(g, c));
    if (dead >= 0 && canExchange(g)) {
      g = applyMove(g, { type: 'exchange', handIndex: dead }, random);
      continue;
    }
    const options = hand.flatMap((_, handIndex) => legalTargets(g, handIndex).map((target) => ({ handIndex, target })));
    g = options.length === 0
      ? applyMove(g, { type: 'pass' }, random)
      : applyMove(g, { type: 'play', ...options[Math.floor(random() * options.length)] }, random);
    assertInvariants(g);
  }
  return g;
}

function assertInvariants(g: GameState) {
  const cardsInPlay = g.hands.flat().length + g.deck.length + g.discard.length;
  const chipOnCorner = g.chips.some((row, r) => row.some((chip, c) => chip !== null && isCorner({ row: r, column: c })));
  const brokenSequence = g.sequences.some(
    (s) => s.cells.length !== 5 || s.cells.some((pos) => !isCorner(pos) && g.chips[pos.row][pos.column] !== s.team),
  );
  if (cardsInPlay !== 104 || chipOnCorner || brokenSequence) {
    expect({ cardsInPlay, chipOnCorner, brokenSequence }).toEqual({ cardsInPlay: 104, chipOnCorner: false, brokenSequence: false });
  }
}

describe('random full games', () => {
  it.each([
    [2, 1],
    [2, 2],
    [3, 1],
    [3, 2],
    [2, 6],
    [3, 4],
  ])('%i teams × %i players reach a valid end state', (teamCount, playersPerTeam) => {
    for (let seed = 1; seed <= 5; seed++) {
      const random = seededRandom(seed * 7919 + teamCount * 31 + playersPerTeam);
      const end = playOut(createGame({ teamCount, playersPerTeam, random }), random);
      expect(end.winner).not.toBeNull();
      expect(sequenceCount(end, end.winner!)).toBeGreaterThanOrEqual(sequencesToWin(end.teamCount));
    }
  });
});
