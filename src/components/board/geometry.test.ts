import { describe, expect, it } from 'vitest';
import { cellCentre } from './geometry';

describe('cellCentre', () => {
  it('puts the first and last cells symmetrically and the middle at 50', () => {
    expect(cellCentre(0) + cellCentre(9)).toBeCloseTo(100);
    expect((cellCentre(4) + cellCentre(5)) / 2).toBeCloseTo(50);
  });

  it('steps by one cell plus one gap', () => {
    const steps = Array.from({ length: 9 }, (_, i) => cellCentre(i + 1) - cellCentre(i));
    steps.forEach((step) => expect(step).toBeCloseTo(steps[0]));
    // The gaps make the first centre sit a little inside a plain tenth.
    expect(cellCentre(0)).toBeLessThan(5);
  });
});
