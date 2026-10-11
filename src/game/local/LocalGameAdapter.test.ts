import { describe, expect, it, vi } from 'vitest';
import { positionsOf } from '../../engine/board';
import { seededRandom } from '../../engine/setup';
import { LocalGameAdapter } from './LocalGameAdapter';

function adapter() {
  return new LocalGameAdapter({ teamCount: 2, playersPerTeam: 1, playerNames: ['Ana', 'Ben'], random: seededRandom(3) });
}

describe('LocalGameAdapter', () => {
  it('exposes the current player as the viewer, hot-seat', () => {
    const a = adapter();
    const view = a.getState();
    expect(a.hotSeat).toBe(true);
    expect(view.viewer?.name).toBe('Ana');
    expect(view.currentPlayerId).toBe('p1');
    expect(view.hand).toHaveLength(7);
    expect(view.board).toHaveLength(10);
    expect(view.sequencesToWin).toBe(2);
  });

  it('plays a legal move, notifies subscribers and passes the turn', async () => {
    const a = adapter();
    const listener = vi.fn();
    a.subscribe(listener);
    const handIndex = a.getState().hand.findIndex((h) => a.legalTargets(a.getState().hand.indexOf(h)).length > 0);
    const [target] = a.legalTargets(handIndex);
    expect(await a.playCard(handIndex, target)).toEqual({ ok: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(a.getState().viewer?.name).toBe('Ben');
    expect(a.getState().log).toHaveLength(1);
  });

  it('returns a readable message for an illegal move and keeps the snapshot', async () => {
    const a = adapter();
    const before = a.getState();
    const handIndex = before.hand.findIndex((h) => !h.card.startsWith('J-'));
    const wrong = { row: 0, column: 0 };
    const result = await a.playCard(handIndex, wrong);
    expect(result.ok).toBe(false);
    expect(a.getState()).toBe(before);
    expect(positionsOf(before.hand[handIndex].card)).not.toContainEqual(wrong);
  });
});
