import type { Pos } from '../engine/board';
import { applyMove, legalTargets, RuleError, type GameState, type Move } from '../engine/game';
import { suggestMove } from '../engine/hints';
import { toView } from '../game/local/LocalGameAdapter';
import type { ActionResult, GameAdapter, GameView } from '../game/types';
import { BOT, YOU, type BoardLesson } from './lessons';

/** How long the Bot "thinks" before it moves, so its move can be followed. */
export const BOT_DELAY_MS = 900;

/**
 * One training lesson as a game: You against the Bot on this device. Moves go through the real rules engine, then
 * through the lesson's check, which may turn down a legal move that misses the task. The Bot plays the move the
 * training hints would suggest. Once the task is done, the position plays on as a free game against the Bot.
 */
export class TutorialAdapter implements GameAdapter {
  readonly mode = 'local' as const;
  readonly hotSeat = false;
  private state: GameState;
  private view: GameView;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private turnStartedAt = Date.now();
  private finished = false;
  private random: () => number;

  constructor(
    readonly lesson: BoardLesson,
    { playerName = 'Player', random = Math.random }: { playerName?: string; random?: () => number } = {},
  ) {
    this.random = random;
    const state = lesson.setup();
    this.state = { ...state, players: state.players.map((p, i) => (i === YOU ? { ...p, name: playerName } : p)) };
    this.view = this.toView();
  }

  /** The lesson's task is done. */
  get done(): boolean {
    return this.finished;
  }

  getState(): GameView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.scheduleBot();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) clearTimeout(this.timer);
    };
  }

  /** Your cells, even on the Bot's turn (to draft a move). */
  legalTargets(handIndex: number): Pos[] {
    return legalTargets({ ...this.state, current: YOU }, handIndex);
  }

  playCard(handIndex: number, target: Pos): Promise<ActionResult> {
    return this.attempt({ type: 'play', handIndex, target });
  }

  exchangeDeadCard(handIndex: number): Promise<ActionResult> {
    return this.attempt({ type: 'exchange', handIndex });
  }

  pass(): Promise<ActionResult> {
    return this.attempt({ type: 'pass' });
  }

  async refresh(): Promise<void> {}

  dispose(): void {
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  private attempt(move: Move): Promise<ActionResult> {
    if (this.state.current !== YOU) return Promise.resolve({ ok: false, message: 'Wait for the Bot to finish its turn.' });
    const before = this.state;
    let after: GameState;
    try {
      after = applyMove(before, move, this.random);
    } catch (error) {
      if (error instanceof RuleError) return Promise.resolve({ ok: false, message: error.message });
      throw error;
    }
    // Once the task is done the position is free play against the Bot.
    if (!this.finished) {
      const problem = this.lesson.check?.({ before, move, after }) ?? null;
      if (problem) return Promise.resolve({ ok: false, message: problem });
      this.finished = this.lesson.done({ before, move, after });
    }
    this.update(after);
    return Promise.resolve({ ok: true });
  }

  /** On the Bot's turn, it moves after a pause: as many moves as its turn takes (an exchange keeps the turn). */
  private scheduleBot() {
    clearTimeout(this.timer);
    if (this.state.winner !== null || this.state.current !== BOT || this.listeners.size === 0) return;
    this.timer = setTimeout(() => {
      const hint = suggestMove(this.state);
      const move: Move = !hint || hint.type === 'pass' ? { type: 'pass' } : hint.type === 'exchange' ? { type: 'exchange', handIndex: hint.handIndex } : { type: 'play', handIndex: hint.handIndex, target: hint.target };
      const after = applyMove(this.state, move, this.random);
      // The practice match ends when either side wins.
      if (after.winner !== null && !this.finished) this.finished = this.lesson.done({ before: this.state, move, after });
      this.update(after);
    }, BOT_DELAY_MS);
  }

  private update(state: GameState) {
    const before = this.state;
    this.state = state;
    if (state.turn !== before.turn || state.current !== before.current) this.turnStartedAt = Date.now();
    this.view = this.toView();
    this.scheduleBot();
    this.listeners.forEach((listener) => listener());
  }

  private toView(): GameView {
    return toView(this.state, this.lesson.settings, this.turnStartedAt, null, YOU);
  }
}
