import { describe, expect, it } from 'vitest';
import { BOARD_LAYOUT, positionsOf } from './board';
import type { CardName } from './cards';
import { createGame, type GameState } from './game';
import { longestLine, suggestMove } from './hints';
import { seededRandom, type TeamIndex } from './setup';

/** A two-player game with the current player's hand and some chips replaced. */
function setup(hand: CardName[], chips: [number, number, TeamIndex][] = []): GameState {
  const game = createGame({ teamCount: 2, playersPerTeam: 1, random: seededRandom(3) });
  const grid = game.chips.map((row) => [...row]);
  chips.forEach(([row, column, team]) => (grid[row][column] = team));
  return { ...game, chips: grid, hands: game.hands.map((h, i) => (i === game.current ? hand : h)) };
}

const cardAt = (row: number, column: number) => BOARD_LAYOUT[row][column] as CardName;

describe('longestLine', () => {
  it("counts the team's chips and corners through a cell", () => {
    const { chips } = setup([], [[0, 1, 0], [0, 2, 0], [1, 1, 1]]);
    expect(longestLine(chips, { row: 0, column: 3 }, 0)).toBe(4);
    expect(longestLine(chips, { row: 0, column: 3 }, 1)).toBe(1);
  });
});

describe('suggestMove', () => {
  it('completes a sequence when it can', () => {
    const state = setup(['J-Club', cardAt(1, 5)], [1, 2, 3, 4].map((c) => [1, c, 0] as [number, number, TeamIndex]));
    expect(suggestMove(state)).toEqual({ type: 'play', handIndex: 1, target: { row: 1, column: 5 }, reason: { kind: 'sequence' } });
  });

  it('blocks an opponent about to make five', () => {
    const state = setup([cardAt(3, 5), cardAt(8, 8)], [1, 2, 3, 4].map((c) => [3, c, 1] as [number, number, TeamIndex]));
    expect(suggestMove(state)).toMatchObject({ handIndex: 0, target: { row: 3, column: 5 }, reason: { kind: 'block', length: 5, team: 1 } });
  });

  it('prefers a normal card over a wild jack for the same cell', () => {
    const hint = suggestMove(setup(['J-Diamond', cardAt(1, 1)]));
    expect(hint).toMatchObject({ handIndex: 1, reason: { kind: 'extend' } });
  });

  it('breaks the longest opponent line with a one-eyed jack', () => {
    const hint = suggestMove(setup(['J-Spade'], [[5, 2, 1], [5, 3, 1], [5, 4, 1], [7, 7, 1]]));
    expect(hint?.type === 'play' && hint.target.row).toBe(5);
    expect(hint?.reason).toEqual({ kind: 'break', length: 3, team: 1 });
  });

  it('suggests exchanging a dead card first', () => {
    const dead = cardAt(2, 2) as CardName;
    const cells = positionsOf(dead).map((p) => [p.row, p.column, 1] as [number, number, TeamIndex]);
    expect(suggestMove(setup(['J-Club', dead], cells))).toEqual({ type: 'exchange', handIndex: 1, reason: { kind: 'dead' } });
  });

  it('suggests passing with nothing to play, and nothing once the game is over', () => {
    expect(suggestMove(setup(['J-Heart']))).toEqual({ type: 'pass', reason: { kind: 'pass' } });
    expect(suggestMove({ ...setup(['J-Heart']), winner: 0 })).toBeNull();
  });
});
