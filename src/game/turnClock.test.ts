import { describe, expect, it } from 'vitest';
import { clockLeft, formatElapsed } from './turnClock';

describe('formatElapsed', () => {
  it('reads like a clock', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_900)).toBe('0:07');
    expect(formatElapsed(750_000)).toBe('12:30');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(-500)).toBe('0:00');
  });
});

describe('clockLeft', () => {
  const clocks = { seconds: 300, left: [200_000, 300_000] };

  it('runs down only the current team, to the turn deadline', () => {
    const view = { clocks, turnDeadline: 1_000 + 200_000, turnPaused: false, turnTimeLeft: null };
    expect(clockLeft(view, 0, 0, 51_000)).toBe(150_000);
    expect(clockLeft(view, 1, 0, 51_000)).toBe(300_000);
    expect(clockLeft(view, 0, 0, 999_999)).toBe(0);
  });

  it('never reads more than the team had when the turn began, and freezes while paused', () => {
    // A quick match's first turn has a few extra seconds on its deadline to open the game.
    expect(clockLeft({ clocks, turnDeadline: 210_000, turnPaused: false, turnTimeLeft: null }, 0, 0, 0)).toBe(200_000);
    expect(clockLeft({ clocks, turnDeadline: null, turnPaused: true, turnTimeLeft: 120_000 }, 0, 0, 0)).toBe(120_000);
  });
});
