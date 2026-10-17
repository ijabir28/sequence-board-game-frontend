import { describe, expect, it } from 'vitest';
import { EDGE_WARN_MS, turnEdgeColor, turnEdgeHeat, turnEdgeStrength, UNTIMED_EDGE_MS } from './turnEdge';

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

describe('turnEdgeHeat', () => {
  it('stays green until the last 20 seconds, then turns red as time runs out', () => {
    expect(turnEdgeHeat({ now: 0, turnDeadline: 60_000 })).toBe(0);
    expect(turnEdgeHeat({ now: 60_000 - EDGE_WARN_MS, turnDeadline: 60_000 })).toBe(0);
    expect(turnEdgeHeat({ now: 60_000 - EDGE_WARN_MS / 2, turnDeadline: 60_000 })).toBe(0.5);
    expect(turnEdgeHeat({ now: 70_000, turnDeadline: 60_000 })).toBe(1);
  });

  it('stays green without a timer', () => {
    expect(turnEdgeHeat({ now: 1e9, turnDeadline: null })).toBe(0);
  });
});

describe('turnEdgeColor', () => {
  it('goes from green to red', () => {
    expect(turnEdgeColor(0)).toBe('hsl(150 85% 55%)');
    expect(turnEdgeColor(1)).toBe('hsl(0 85% 50%)');
  });
});
