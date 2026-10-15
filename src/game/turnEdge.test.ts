import { describe, expect, it } from 'vitest';
import { turnEdgeStrength, UNTIMED_EDGE_MS } from './turnEdge';

describe('turnEdgeStrength', () => {
  it('is the share of the turn time left', () => {
    expect(turnEdgeStrength({ now: 1000, turnStartedAt: 1000, turnDeadline: 91_000 })).toBe(1);
    expect(turnEdgeStrength({ now: 46_000, turnStartedAt: 1000, turnDeadline: 91_000 })).toBe(0.5);
    expect(turnEdgeStrength({ now: 95_000, turnStartedAt: 1000, turnDeadline: 91_000 })).toBe(0);
  });

  it('fades over a minute without a timer, and is null without a turn', () => {
    expect(turnEdgeStrength({ now: UNTIMED_EDGE_MS / 2, turnStartedAt: 0, turnDeadline: null })).toBe(0.5);
    expect(turnEdgeStrength({ now: UNTIMED_EDGE_MS * 2, turnStartedAt: 0, turnDeadline: null })).toBe(0);
    expect(turnEdgeStrength({ now: 0, turnStartedAt: null, turnDeadline: null })).toBeNull();
  });
});
