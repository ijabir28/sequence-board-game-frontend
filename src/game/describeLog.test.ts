import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../engine/game';
import { describeLatest, describeLog } from './describeLog';

describe('describeLog', () => {
  it('describes moves in plain language', () => {
    expect(describeLog({ kind: 'place', turn: 1, player: 'Ana', team: 0, card: '7-Heart', pos: { row: 4, column: 6 }, wild: false })).toBe('Ana played 7♥');
    expect(describeLog({ kind: 'place', turn: 1, player: 'Ana', team: 0, card: 'J-Club', pos: { row: 0, column: 1 }, wild: true })).toBe(
      'Ana played J♣ on 6♦',
    );
    expect(describeLog({ kind: 'remove', turn: 2, player: 'Ben', team: 1, card: 'J-Spade', pos: { row: 0, column: 1 }, removedTeam: 0 })).toBe(
      "Ben removed Team Green's chip from 6♦",
    );
    expect(describeLog({ kind: 'exchange', turn: 3, player: 'Ana', team: 0, card: '7-Heart', auto: true })).toBe(
      "Ana's dead 7♥ auto-swapped",
    );
    expect(describeLog({ kind: 'place', turn: 4, player: 'Ana', team: 0, card: 'J-Club', pos: { row: 0, column: 1 }, wild: true, timed_out: true })).toBe(
      'Ana timed out: J♣ played on 6♦',
    );
    expect(describeLog({ kind: 'pass', turn: 5, player: 'Ben', team: 1, timed_out: true })).toBe('Ben timed out: no move, passed');
    expect(describeLog({ kind: 'win', turn: 9, team: 2 })).toBe('Team Red won the game');
  });
});

describe('describeLog with the Numbered deck', () => {
  it('names cards and cells by number', () => {
    expect(describeLog({ kind: 'place', turn: 1, player: 'Ana', team: 0, card: '7-Heart', pos: { row: 4, column: 6 }, wild: false }, 'numbers')).toBe('Ana played #6');
    expect(describeLog({ kind: 'place', turn: 1, player: 'Ana', team: 0, card: 'J-Club', pos: { row: 0, column: 1 }, wild: true }, 'numbers')).toBe(
      'Ana played Wild on #29',
    );
    expect(describeLog({ kind: 'remove', turn: 2, player: 'Ben', team: 1, card: 'J-Spade', pos: { row: 0, column: 1 }, removedTeam: 0 }, 'numbers')).toBe(
      "Ben removed Team Green's chip from #29",
    );
  });
});

describe('describeLatest', () => {
  const play: LogEntry = { kind: 'place', turn: 7, player: 'Jabir', team: 0, card: '7-Heart', pos: { row: 4, column: 6 }, wild: false };
  const sequence: LogEntry = { kind: 'sequence', turn: 7, team: 0, cells: [] };

  it('says who made a sequence, and with what card', () => {
    expect(describeLatest([play, sequence])).toBe('Jabir played 7♥ and made a sequence');
    expect(describeLatest([play, sequence, sequence])).toBe('Jabir played 7♥ and made 2 sequences');
    expect(describeLatest([play, sequence, { kind: 'win', turn: 7, team: 0 }])).toBe('Jabir played 7♥ and won the game');
    expect(describeLatest([{ ...play, card: 'J-Club', wild: true, timed_out: true }, sequence])).toBe('Jabir timed out: J♣ on 7♥ made a sequence');
  });

  it('describes any other move as the log does', () => {
    expect(describeLatest([])).toBe('');
    expect(describeLatest([play])).toBe('Jabir played 7♥');
  });
});
