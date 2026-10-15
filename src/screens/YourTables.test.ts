import { describe, expect, it } from 'vitest';
import type { MyRoom } from '../api/rooms';
import { describeTable } from './YourTables';

const base: MyRoom = {
  id: '1',
  name: 'Friday',
  createdAt: '2026-10-15T05:48:22.696Z',
  administrator: 'jabir',
  teamCount: 2,
  playersPerTeam: 2,
  seatsTaken: 3,
  yourTeam: 0,
  status: 'open',
  winnerTeam: null,
  moveCount: 0,
};

describe('describeTable', () => {
  it('counts seats while the table fills', () => {
    expect(describeTable(base)).toBe('Waiting for players · 3 of 4 seats taken');
  });

  it('counts moves while playing', () => {
    expect(describeTable({ ...base, status: 'playing', moveCount: 1 })).toBe('In progress · 1 move');
    expect(describeTable({ ...base, status: 'playing', moveCount: 12 })).toBe('In progress · 12 moves');
  });

  it('names the winner from the viewer side', () => {
    expect(describeTable({ ...base, status: 'finished', winnerTeam: 0, moveCount: 40 })).toBe('You won · 40 moves');
    expect(describeTable({ ...base, status: 'finished', winnerTeam: 1, moveCount: 40 })).toBe('Team Blue won · 40 moves');
    expect(describeTable({ ...base, yourTeam: null, status: 'finished', winnerTeam: 0, moveCount: 40 })).toBe('Team Green won · 40 moves');
  });
});
