import { afterEach, describe, expect, it, vi } from 'vitest';
import { positionsOf } from '../../engine/board';
import { seededRandom } from '../../engine/setup';
import { LocalGameAdapter } from './LocalGameAdapter';

function adapter() {
  return new LocalGameAdapter({ teamCount: 2, playersPerTeam: 1, playerNames: ['Ana', 'Ben'], random: seededRandom(3) });
}

describe('LocalGameAdapter', () => {
  it('hints only in training mode, with a legal move', () => {
    expect(adapter().getState().hint).toBeNull();
    const training = new LocalGameAdapter({ teamCount: 2, playersPerTeam: 1, random: seededRandom(3), settings: { mode: 'training' } });
    const hint = training.getState().hint;
    expect(hint?.type).toBe('play');
    if (hint?.type === 'play') expect(training.legalTargets(hint.handIndex)).toContainEqual(hint.target);
  });

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

describe('LocalGameAdapter turn timer', () => {
  afterEach(() => vi.useRealTimers());

  it('plays a random card when the time runs out, but only while watched', () => {
    vi.useFakeTimers();
    const a = new LocalGameAdapter({ teamCount: 2, playersPerTeam: 1, random: seededRandom(3), turnSeconds: 15 });
    const start = a.getState().turnDeadline!;
    expect(start - Date.now()).toBe(15_000);

    // Nobody subscribed: nothing happens.
    vi.advanceTimersByTime(20_000);
    expect(a.getState().turn).toBe(1);

    const listener = vi.fn();
    const unsubscribe = a.subscribe(listener);
    vi.advanceTimersByTime(0);
    expect(a.getState().turn).toBe(2);
    expect(a.getState().log.at(-1)).toMatchObject({ player: 'Player 1', timed_out: true });
    expect(a.getState().turnDeadline! - Date.now()).toBe(15_000);

    vi.advanceTimersByTime(15_000);
    expect(a.getState().turn).toBe(3);
    unsubscribe();
    vi.advanceTimersByTime(60_000);
    expect(a.getState().turn).toBe(3);
    a.dispose();
  });

  it('has no deadline without a timer', () => {
    expect(adapter().getState().turnDeadline).toBeNull();
  });
});
