import { describe, expect, it } from 'vitest';
import { creditLine } from './PoweredBy';

describe('creditLine', () => {
  it('names the year it is read in', () => {
    expect(creditLine(new Date(2026, 5, 1))).toBe('Powered by Fifteen’s Inc. © 2026');
    expect(creditLine(new Date(2031, 0, 1))).toBe('Powered by Fifteen’s Inc. © 2031');
  });

  it('defaults to the current year', () => {
    expect(creditLine()).toContain(`© ${new Date().getFullYear()}`);
  });
});
