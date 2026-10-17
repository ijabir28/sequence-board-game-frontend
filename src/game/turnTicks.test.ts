import { describe, expect, it } from 'vitest';
import { tickSecond } from './turnTicks';

describe('tickSecond', () => {
  it('counts the seconds left over the last 20', () => {
    expect(tickSecond({ now: 0, turnDeadline: 30_000 })).toBeNull();
    expect(tickSecond({ now: 10_000, turnDeadline: 30_000 })).toBe(20);
    expect(tickSecond({ now: 10_001, turnDeadline: 30_000 })).toBe(20);
    expect(tickSecond({ now: 11_000, turnDeadline: 30_000 })).toBe(19);
    expect(tickSecond({ now: 29_500, turnDeadline: 30_000 })).toBe(1);
  });

  it('is silent once time is up, and without a timer', () => {
    expect(tickSecond({ now: 30_000, turnDeadline: 30_000 })).toBeNull();
    expect(tickSecond({ now: 1e9, turnDeadline: null })).toBeNull();
  });
});
