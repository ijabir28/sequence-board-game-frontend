import { describe, expect, it } from 'vitest';
import { formatElapsed } from './turnClock';

describe('formatElapsed', () => {
  it('reads like a clock', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_900)).toBe('0:07');
    expect(formatElapsed(750_000)).toBe('12:30');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(-500)).toBe('0:00');
  });
});
