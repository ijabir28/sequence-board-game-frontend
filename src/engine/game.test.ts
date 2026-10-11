import { describe, expect, it } from 'vitest';
import { positionsOf, type Pos } from './board';
import type { CardName } from './cards';
import { applyMove, canExchange, createGame, isDeadCard, legalTargets, RuleError, sequenceCount, type GameState } from './game';
import { seededRandom, type TeamIndex } from './setup';

const p = (row: number, column: number): Pos => ({ row, column });

function newGame(teamCount = 2, playersPerTeam = 1): GameState {
  return createGame({ teamCount, playersPerTeam, random: seededRandom(42) });
}

/** Gives the current player a specific hand. */
function withHand(state: GameState, hand: CardName[]): GameState {
  return { ...state, hands: state.hands.map((h, i) => (i === state.current ? hand : h)) };
}

function withChips(state: GameState, cells: [Pos, TeamIndex][]): GameState {
  const chips = state.chips.map((r) => [...r]);
  cells.forEach(([pos, team]) => (chips[pos.row][pos.column] = team));
  return { ...state, chips };
}

function expectRuleError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    expect((e as RuleError).code).toBe(code);
    return;
  }
  throw new Error(`expected RuleError ${code}`);
}

describe('createGame', () => {
  it('deals the official hand size and keeps 104 cards in play', () => {
    const g = newGame(2, 1);
    expect(g.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(g.deck.length + g.hands.flat().length).toBe(104);

    const g9 = newGame(3, 3);
    expect(g9.players.map((pl) => pl.team)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    expect(g9.hands.every((h) => h.length === 4)).toBe(true);
  });

  it('rejects unsupported tables', () => {
    expect(() => createGame({ teamCount: 3, playersPerTeam: 5 })).toThrow(RangeError);
    expect(() => createGame({ teamCount: 4, playersPerTeam: 1 })).toThrow(RangeError);
  });

  it('uses given names and falls back to seat numbers', () => {
    const g = createGame({ teamCount: 2, playersPerTeam: 1, playerNames: ['Ana', ' '] });
    expect(g.players.map((pl) => pl.name)).toEqual(['Ana', 'Player 2']);
  });
});

describe('normal cards', () => {
  it('can target both matching empty cells', () => {
    const g = withHand(newGame(), ['7-Heart']);
    expect(legalTargets(g, 0)).toEqual(positionsOf('7-Heart'));
  });

  it('places a chip, draws into the same slot and passes the turn', () => {
    const g = withHand(newGame(), ['2-Club', '7-Heart', '3-Club']);
    const deckTop = g.deck[0];
    const [target] = positionsOf('7-Heart');
    const next = applyMove(g, { type: 'play', handIndex: 1, target });
    expect(next.chips[target.row][target.column]).toBe(0);
    expect(next.hands[0]).toEqual(['2-Club', deckTop, '3-Club']);
    expect(next.discard).toEqual(['7-Heart']);
    expect(next.current).toBe(1);
    expect(next.turn).toBe(2);
    expect(next.log.at(-1)).toMatchObject({ kind: 'place', card: '7-Heart', wild: false });
  });

  it('rejects a cell with a different card, an occupied cell and a corner', () => {
    const g = withHand(newGame(), ['7-Heart']);
    expectRuleError(() => applyMove(g, { type: 'play', handIndex: 0, target: p(1, 1) }), 'CELL_MISMATCH');
    const [target] = positionsOf('7-Heart');
    expectRuleError(() => applyMove(withChips(g, [[target, 1]]), { type: 'play', handIndex: 0, target }), 'CELL_OCCUPIED');
    expectRuleError(() => applyMove(g, { type: 'play', handIndex: 0, target: p(0, 0) }), 'CORNER');
  });

  it('does not change the input state', () => {
    const g = withHand(newGame(), ['7-Heart']);
    const snapshot = JSON.stringify(g);
    applyMove(g, { type: 'play', handIndex: 0, target: positionsOf('7-Heart')[0] });
    expect(JSON.stringify(g)).toBe(snapshot);
  });
});

describe('two-eyed jacks', () => {
  it.each(['J-Club', 'J-Diamond'] as CardName[])('%s can go on every empty non-corner cell', (jack) => {
    const g = withChips(withHand(newGame(), [jack]), [[p(3, 3), 1], [p(4, 4), 0]]);
    const targets = legalTargets(g, 0);
    expect(targets).toHaveLength(100 - 4 - 2);
    expect(targets).not.toContainEqual(p(0, 0));
    expect(targets).not.toContainEqual(p(3, 3));
  });

  it('places a wild chip', () => {
    const g = withHand(newGame(), ['J-Club']);
    const next = applyMove(g, { type: 'play', handIndex: 0, target: p(5, 5) });
    expect(next.chips[5][5]).toBe(0);
    expect(next.log.at(-1)).toMatchObject({ kind: 'place', wild: true });
  });
});

describe('one-eyed jacks', () => {
  it.each(['J-Spade', 'J-Heart'] as CardName[])('%s targets only unlocked opponent chips', (jack) => {
    let g = withHand(newGame(), [jack]);
    g = withChips(g, [[p(2, 2), 1], [p(3, 3), 0], [p(6, 6), 1]]);
    g = { ...g, sequences: [{ team: 1, cells: [p(6, 2), p(6, 3), p(6, 4), p(6, 5), p(6, 6)] }] };
    expect(legalTargets(g, 0)).toEqual([p(2, 2)]);
  });

  it('removes the chip without placing one', () => {
    const g = withChips(withHand(newGame(), ['J-Spade']), [[p(2, 2), 1]]);
    const next = applyMove(g, { type: 'play', handIndex: 0, target: p(2, 2) });
    expect(next.chips[2][2]).toBeNull();
    expect(next.log.at(-1)).toMatchObject({ kind: 'remove', removedTeam: 1 });
  });

  it('rejects empty cells, own chips and chips in a sequence', () => {
    let g = withChips(withHand(newGame(), ['J-Heart']), [[p(3, 3), 0], [p(6, 6), 1]]);
    g = { ...g, sequences: [{ team: 1, cells: [p(6, 2), p(6, 3), p(6, 4), p(6, 5), p(6, 6)] }] };
    expectRuleError(() => applyMove(g, { type: 'play', handIndex: 0, target: p(2, 2) }), 'NOTHING_TO_REMOVE');
    expectRuleError(() => applyMove(g, { type: 'play', handIndex: 0, target: p(3, 3) }), 'OWN_CHIP');
    expectRuleError(() => applyMove(g, { type: 'play', handIndex: 0, target: p(6, 6) }), 'LOCKED_CHIP');
  });

  it('can remove a chip of either opponent with three teams', () => {
    const g = withChips(withHand(newGame(3, 1), ['J-Spade']), [[p(2, 2), 1], [p(2, 3), 2]]);
    expect(legalTargets(g, 0)).toEqual([p(2, 2), p(2, 3)]);
  });
});

describe('sequences and winning', () => {
  // Row 1 columns 1–4 are 3H 2H 2S 3S; column 5 is 4-Spade.
  const row1 = [p(1, 1), p(1, 2), p(1, 3), p(1, 4)];

  it('records a sequence when the fifth chip is placed', () => {
    const g = withChips(withHand(newGame(), ['4-Spade']), row1.map((pos) => [pos, 0] as [Pos, TeamIndex]));
    const next = applyMove(g, { type: 'play', handIndex: 0, target: p(1, 5) });
    expect(sequenceCount(next, 0)).toBe(1);
    expect(next.winner).toBeNull();
    expect(next.log.some((e) => e.kind === 'sequence')).toBe(true);
  });

  it('wins with two sequences when there are two teams', () => {
    let g = withChips(withHand(newGame(), ['4-Spade']), row1.map((pos) => [pos, 0] as [Pos, TeamIndex]));
    g = { ...g, sequences: [{ team: 0, cells: [p(5, 1), p(5, 2), p(5, 3), p(5, 4), p(5, 5)] }] };
    const next = applyMove(g, { type: 'play', handIndex: 0, target: p(1, 5) });
    expect(next.winner).toBe(0);
    expect(next.current).toBe(g.current);
    expect(next.log.at(-1)).toMatchObject({ kind: 'win', team: 0 });
    expectRuleError(() => applyMove(next, { type: 'pass' }), 'GAME_OVER');
    expect(legalTargets(next, 0)).toEqual([]);
  });

  it('wins with one sequence when there are three teams', () => {
    const g = withChips(withHand(newGame(3, 1), ['4-Spade']), row1.map((pos) => [pos, 0] as [Pos, TeamIndex]));
    expect(applyMove(g, { type: 'play', handIndex: 0, target: p(1, 5) }).winner).toBe(0);
  });

  it('counts the corner toward a sequence', () => {
    // Row 0: Blank 6D 7D 8D 9D
    const cells: [Pos, TeamIndex][] = [p(0, 1), p(0, 2), p(0, 3)].map((pos) => [pos, 0]);
    const g = withChips(withHand(newGame(), ['9-Diamond']), cells);
    const next = applyMove(g, { type: 'play', handIndex: 0, target: p(0, 4) });
    expect(next.sequences[0].cells[0]).toEqual(p(0, 0));
  });
});

describe('dead cards', () => {
  const [a, b] = positionsOf('7-Heart');

  it('detects a card whose two cells are taken', () => {
    const g = withChips(withHand(newGame(), ['7-Heart', 'J-Club']), [[a, 1], [b, 0]]);
    expect(isDeadCard(g, '7-Heart')).toBe(true);
    expect(isDeadCard(g, 'J-Club')).toBe(false);
    expect(isDeadCard(withChips(newGame(), [[a, 1]]), '7-Heart')).toBe(false);
    expect(canExchange(g)).toBe(true);
  });

  it('exchanges once per turn without ending the turn', () => {
    const g = withChips(withHand(newGame(), ['7-Heart', '7-Heart']), [[a, 1], [b, 0]]);
    const top = g.deck[0];
    const next = applyMove(g, { type: 'exchange', handIndex: 0 });
    expect(next.hands[0]).toEqual([top, '7-Heart']);
    expect(next.current).toBe(g.current);
    expect(next.exchangedThisTurn).toBe(true);
    expect(canExchange(next)).toBe(false);
    expectRuleError(() => applyMove(next, { type: 'exchange', handIndex: 1 }), 'ALREADY_EXCHANGED');
  });

  it('rejects exchanging a live card', () => {
    const g = withHand(newGame(), ['7-Heart']);
    expectRuleError(() => applyMove(g, { type: 'exchange', handIndex: 0 }), 'NOT_DEAD');
  });

  it('resets the exchange allowance on the next turn', () => {
    let g = withChips(withHand(newGame(), ['7-Heart', 'J-Club']), [[a, 1], [b, 0]]);
    g = applyMove(g, { type: 'exchange', handIndex: 0 });
    g = applyMove(g, { type: 'play', handIndex: 1, target: p(5, 5) });
    expect(g.exchangedThisTurn).toBe(false);
  });
});

describe('deck and passing', () => {
  it('reshuffles the discard pile when the deck runs out', () => {
    let g = withHand(newGame(), ['7-Heart']);
    g = { ...g, deck: [], discard: ['2-Club', '3-Club'] };
    const next = applyMove(g, { type: 'play', handIndex: 0, target: positionsOf('7-Heart')[0] });
    expect(next.hands[0]).toHaveLength(1);
    expect(next.deck.length + next.discard.length).toBe(2);
  });

  it('only allows passing with no legal move', () => {
    const g = withHand(newGame(), ['7-Heart']);
    expectRuleError(() => applyMove(g, { type: 'pass' }), 'HAS_MOVES');
    const stuck = withHand(newGame(), ['J-Spade']); // nothing on the board to remove
    expect(applyMove(stuck, { type: 'pass' }).current).toBe(1);
  });
});
