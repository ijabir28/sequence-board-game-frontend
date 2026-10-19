import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardName } from '../engine/cards';
import { seededRandom } from '../engine/setup';
import { LESSONS, type BoardLesson } from './lessons';
import { BOT_DELAY_MS, TutorialAdapter } from './TutorialAdapter';

const lesson = (id: string) => LESSONS.find((l) => l.id === id) as BoardLesson;
const start = (id: string) => new TutorialAdapter(lesson(id), { random: seededRandom(7) });
const card = (adapter: TutorialAdapter, name: CardName) => adapter.getState().hand.findIndex((h) => h.card === name);
const at = (row: number, column: number) => ({ row, column });

describe('training lessons', () => {
  it('every board lesson starts on your turn with a full hand and nobody winning', () => {
    for (const l of LESSONS) {
      if (l.kind !== 'board') continue;
      const view = new TutorialAdapter(l).getState();
      expect(view.currentPlayerId, l.id).toBe('you');
      expect(view.hand, l.id).toHaveLength(7);
      expect(view.winner, l.id).toBeNull();
    }
  });

  it('place: only the open 7♠ cell finishes it', async () => {
    const a = start('place');
    expect(await a.playCard(card(a, '3-Club'), at(6, 4))).toMatchObject({ ok: false });
    expect(await a.playCard(card(a, '7-Spade'), at(1, 8))).toEqual({ ok: false, message: 'That cell already has a chip. Pick an empty cell.' });
    expect(await a.playCard(card(a, '7-Spade'), at(9, 3))).toEqual({ ok: true });
    expect(a.done).toBe(true);
    // Then it is free play: the lesson's check no longer applies, and the Bot answers.
    expect(a.getState().currentPlayerId).toBe('bot');
  });

  it('corner: the corner takes no chip, and 9♦ next to it makes the sequence', async () => {
    const a = start('corner');
    expect(await a.playCard(card(a, '9-Diamond'), at(0, 0))).toMatchObject({ ok: false, message: expect.stringContaining('Corners') });
    expect(await a.playCard(card(a, '9-Diamond'), at(5, 2))).toMatchObject({ ok: false, message: expect.stringContaining('sequence') });
    expect(await a.playCard(card(a, '9-Diamond'), at(0, 4))).toEqual({ ok: true });
    expect(a.getState().teams[0].sequences).toBe(1);
    expect(a.done).toBe(true);
  });

  it('wild: the two-eyed jack blocks the end of the Bot’s four', async () => {
    const a = start('wild');
    expect(await a.playCard(card(a, 'J-Club'), at(0, 5))).toMatchObject({ ok: false, message: expect.stringContaining('8♦') });
    expect(await a.playCard(card(a, 'J-Club'), at(6, 2))).toEqual({ ok: true });
    expect(a.done).toBe(true);
  });

  it('remove: own and locked chips stay; a chip in the open column comes off', async () => {
    const a = start('remove');
    const jack = card(a, 'J-Spade');
    expect(await a.playCard(jack, at(9, 5))).toMatchObject({ ok: false, message: expect.stringContaining('your own') });
    expect(await a.playCard(jack, at(8, 5))).toMatchObject({ ok: false, message: expect.stringContaining('sequence') });
    expect(await a.playCard(jack, at(4, 5))).toMatchObject({ ok: false, message: expect.stringContaining('empty') });
    expect(await a.playCard(jack, at(3, 6))).toMatchObject({ ok: false, message: expect.stringContaining('column') });
    expect(await a.playCard(jack, at(6, 5))).toEqual({ ok: true });
    expect(a.getState().board[6][5].chip).toBeNull();
    expect(a.done).toBe(true);
  });

  it('dead: a live card is not dead, play waits for the exchange, then any play finishes it', async () => {
    const a = start('dead');
    expect(a.getState().hand.every((h) => !h.dead)).toBe(true);
    expect(await a.exchangeDeadCard(card(a, '8-Heart'))).toMatchObject({ ok: false, message: expect.stringContaining("isn't dead") });
    expect(await a.playCard(card(a, '8-Heart'), at(6, 1))).toMatchObject({ ok: false, message: expect.stringContaining('Exchange the dead card first') });
    expect(await a.exchangeDeadCard(card(a, '5-Club'))).toEqual({ ok: true });
    expect(a.done).toBe(false);
    expect(a.getState().canExchange).toBe(false);
    expect(await a.playCard(card(a, '8-Heart'), at(6, 1))).toEqual({ ok: true });
    expect(a.done).toBe(true);
  });

  it('win: a second sequence sharing one chip wins', async () => {
    const a = start('win');
    expect(await a.playCard(card(a, '7-Heart'), at(5, 1))).toMatchObject({ ok: false });
    expect(await a.playCard(card(a, '2-Spade'), at(9, 8))).toEqual({ ok: true });
    expect(a.getState().winner).toBe(0);
    expect(a.getState().teams[0].sequences).toBe(2);
    expect(a.done).toBe(true);
  });

  it('every quiz answer is one of its options', () => {
    for (const l of LESSONS) {
      if (l.kind !== 'quiz') continue;
      for (const q of l.questions) expect(q.options[q.answer], q.question).toBeDefined();
    }
  });
});

describe('the Bot', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('moves after a pause in the practice match, then hands the turn back', async () => {
    const a = new TutorialAdapter(lesson('match'), { random: seededRandom(11) });
    const unsubscribe = a.subscribe(() => {});
    const view = a.getState();
    const handIndex = view.hand.findIndex((_, i) => a.legalTargets(i).length > 0);
    expect(await a.playCard(handIndex, a.legalTargets(handIndex)[0])).toEqual({ ok: true });
    expect(a.getState().currentPlayerId).toBe('bot');
    // On the Bot's turn your hand stays yours, and moves wait.
    expect(a.getState().viewer?.id).toBe('you');
    expect(await a.playCard(0, at(0, 1))).toMatchObject({ ok: false, message: expect.stringContaining('Wait') });
    vi.advanceTimersByTime(BOT_DELAY_MS);
    expect(a.getState().currentPlayerId).toBe('you');
    expect(a.getState().log.filter((e) => 'player' in e && e.player === 'Bot')).not.toHaveLength(0);
    unsubscribe();
  });
});
