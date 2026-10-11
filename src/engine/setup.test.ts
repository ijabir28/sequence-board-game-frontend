import { describe, expect, it } from 'vitest';
import { handSizeFor, isSupportedTable, playersPerTeamOptions, seatTeams, seededRandom, sequencesToWin, shuffle } from './setup';

describe('table setup', () => {
  it('deals by total player count per the official chart', () => {
    expect([2, 3, 4, 6, 8, 9, 10, 12].map(handSizeFor)).toEqual([7, 6, 6, 5, 4, 4, 3, 3]);
    expect(handSizeFor(5)).toBeUndefined();
    expect(handSizeFor(15)).toBeUndefined();
  });

  it('only offers players-per-team values with a supported total', () => {
    expect(playersPerTeamOptions(2)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(playersPerTeamOptions(3)).toEqual([1, 2, 3, 4]);
    expect(isSupportedTable(3, 5)).toBe(false);
    expect(isSupportedTable(4, 1)).toBe(false);
  });

  it('alternates teams around the table', () => {
    expect(seatTeams(3, 2)).toEqual([0, 1, 2, 0, 1, 2]);
    expect(seatTeams(2, 2)).toEqual([0, 1, 0, 1]);
  });

  it('needs 2 sequences with two teams and 1 with three', () => {
    expect(sequencesToWin(2)).toBe(2);
    expect(sequencesToWin(3)).toBe(1);
  });

  it('shuffles deterministically with a seed and keeps every item', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffle(items, seededRandom(1));
    expect(shuffle(items, seededRandom(1))).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
