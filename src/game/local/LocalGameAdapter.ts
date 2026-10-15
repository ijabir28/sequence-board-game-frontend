import { BOARD_LAYOUT, type Pos } from '../../engine/board';
import {
  playTimedOutTurn,
  applyMove,
  canExchange,
  createGame,
  hasLegalPlay,
  isDeadCard,
  legalTargets,
  RuleError,
  sequenceCount,
  type GameState,
  type NewGameOptions,
} from '../../engine/game';
import { suggestMove } from '../../engine/hints';
import { isLocked } from '../../engine/sequences';
import { sequencesToWin, type TeamIndex } from '../../engine/setup';
import { DEFAULT_PLAY_SETTINGS, type ActionResult, type GameAdapter, type GameView, type PlaySettings } from '../types';

export interface LocalGameOptions extends NewGameOptions {
  settings?: Partial<PlaySettings>;
  /** Seconds per turn; when they run out a random card is played for the player. Omit for no timer. */
  turnSeconds?: number;
}

/** Hot-seat game: the full rules engine running on this device. */
export class LocalGameAdapter implements GameAdapter {
  readonly mode = 'local' as const;
  readonly hotSeat: boolean;
  private state: GameState;
  private view: GameView;
  private listeners = new Set<() => void>();
  private random: () => number;
  private settings: PlaySettings;
  private turnStartedAt = Date.now();
  private turnSeconds: number | null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: LocalGameOptions) {
    this.random = options.random ?? Math.random;
    this.settings = { ...DEFAULT_PLAY_SETTINGS, ...options.settings };
    this.turnSeconds = options.turnSeconds ?? null;
    this.state = createGame(options);
    this.hotSeat = this.state.players.length > 1;
    this.view = toView(this.state, this.settings, this.turnStartedAt, this.deadline());
  }

  getState(): GameView {
    return this.view;
  }

  /** The turn timer runs only while someone is watching, so a discarded adapter never plays on its own. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.schedule();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) clearTimeout(this.timer);
    };
  }

  legalTargets(handIndex: number): Pos[] {
    return legalTargets(this.state, handIndex);
  }

  playCard(handIndex: number, target: Pos): Promise<ActionResult> {
    return this.apply(() => applyMove(this.state, { type: 'play', handIndex, target }, this.random));
  }

  exchangeDeadCard(handIndex: number): Promise<ActionResult> {
    return this.apply(() => applyMove(this.state, { type: 'exchange', handIndex }, this.random));
  }

  pass(): Promise<ActionResult> {
    return this.apply(() => applyMove(this.state, { type: 'pass' }, this.random));
  }

  async refresh(): Promise<void> {}

  dispose(): void {
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  private deadline(): number | null {
    return this.turnSeconds === null || this.state.winner !== null ? null : this.turnStartedAt + this.turnSeconds * 1000;
  }

  /** Plays a random card for the current player when their time runs out. */
  private schedule() {
    clearTimeout(this.timer);
    const deadline = this.deadline();
    if (deadline === null || this.listeners.size === 0) return;
    this.timer = setTimeout(() => {
      this.update(playTimedOutTurn(this.state, this.random));
    }, Math.max(0, deadline - Date.now()));
  }

  private update(state: GameState) {
    const before = this.state;
    this.state = state;
    // An exchange keeps the turn, so it keeps the clock running.
    if (this.state.turn !== before.turn || this.state.current !== before.current) this.turnStartedAt = Date.now();
    this.view = toView(this.state, this.settings, this.turnStartedAt, this.deadline());
    this.schedule();
    this.listeners.forEach((listener) => listener());
  }

  private apply(next: () => GameState): Promise<ActionResult> {
    let state: GameState;
    try {
      state = next();
    } catch (error) {
      if (error instanceof RuleError) return Promise.resolve({ ok: false, message: error.message });
      throw error;
    }
    this.update(state);
    return Promise.resolve({ ok: true });
  }
}

function toView(state: GameState, settings: PlaySettings, turnStartedAt: number, turnDeadline: number | null): GameView {
  const player = state.players[state.current];
  const teamIndexes = Array.from({ length: state.teamCount }, (_, i) => i as TeamIndex);
  return {
    status: 'ready',
    board: BOARD_LAYOUT.map((row, r) =>
      row.map((card, c) => ({
        row: r,
        column: c,
        card,
        chip: state.chips[r][c],
        locked: state.chips[r][c] !== null && isLocked(state.sequences, { row: r, column: c }),
      })),
    ),
    teams: teamIndexes.map((index) => ({ index, sequences: sequenceCount(state, index) })),
    sequencesToWin: sequencesToWin(state.teamCount),
    players: state.players,
    currentPlayerId: player.id,
    viewer: player,
    hand: state.hands[state.current].map((card) => ({ card, dead: isDeadCard(state, card) })),
    canExchange: canExchange(state),
    canPass: state.winner === null && !hasLegalPlay(state) && !canExchange(state),
    deckCount: state.deck.length,
    sequences: state.sequences,
    log: state.log,
    winner: state.winner,
    turn: state.turn,
    settings,
    hint: settings.mode === 'training' ? suggestMove(state) : null,
    turnStartedAt: state.winner === null ? turnStartedAt : null,
    turnDeadline,
    // Everyone shares this device, so nobody can be away.
    turnPaused: false,
    turnTimeLeft: null,
    away: [],
  };
}
