import { describe, expect, it } from 'vitest';
import type { SeriesSummary } from '../../game/types';
import { describeVerdict, formatDuration } from './RoundResults';

function summary(wins: number[], winner: SeriesSummary['winner'], leaders: SeriesSummary['leaders']): SeriesSummary {
  return {
    roundsPlayed: wins.reduce((a, b) => a + b, 0),
    turns: 0,
    teams: wins.map((roundsWon, team) => ({ team: team as 0 | 1 | 2, roundsWon, sequences: 0, placed: 0, removed: 0 })),
    players: [],
    winner,
    leaders,
  };
}

describe('describeVerdict', () => {
  it('names the winner with the score, best first', () => {
    expect(describeVerdict(summary([1, 2], 1, [1]))).toBe('Team Blue wins the match, 2–1');
    expect(describeVerdict(summary([3, 0, 1], 0, [0]))).toBe('Team Green wins the match, 3–1–0');
  });

  it('calls a tie a draw', () => {
    expect(describeVerdict(summary([1, 1], null, [0, 1]))).toBe('A draw: Team Green and Team Blue won 1 round each');
    expect(describeVerdict(summary([2, 2, 0], null, [0, 1]))).toBe('A draw: Team Green and Team Blue won 2 rounds each');
  });
});

describe('formatDuration', () => {
  it('reads like a clock', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 5 min');
    expect(formatDuration(120 * 60_000)).toBe('2 h');
  });
});
