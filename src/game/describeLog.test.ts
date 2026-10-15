import { describe, expect, it } from 'vitest';
import { describeLog } from './describeLog';

describe('describeLog', () => {
  it('describes moves in plain language', () => {
    expect(describeLog({ kind: 'place', turn: 1, player: 'Ana', team: 0, card: '7-Heart', pos: { row: 4, column: 6 }, wild: false })).toBe('Ana played 7♥');
    expect(describeLog({ kind: 'place', turn: 1, player: 'Ana', team: 0, card: 'J-Club', pos: { row: 0, column: 1 }, wild: true })).toBe(
      'Ana played wild J♣ on 6♦',
    );
    expect(describeLog({ kind: 'remove', turn: 2, player: 'Ben', team: 1, card: 'J-Spade', pos: { row: 0, column: 1 }, removedTeam: 0 })).toBe(
      "Ben used J♠ to remove Team Green's chip from 6♦",
    );
    expect(describeLog({ kind: 'exchange', turn: 3, player: 'Ana', team: 0, card: '7-Heart', auto: true })).toBe(
      "Ana's dead card 7♥ was swapped for a new one automatically",
    );
    expect(describeLog({ kind: 'win', turn: 9, team: 2 })).toBe('Team Red won the game');
  });
});
