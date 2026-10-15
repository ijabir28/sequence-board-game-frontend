import { BOARD_LAYOUT, type Pos } from '../../engine/board';
import {
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
import { isLocked } from '../../engine/sequences';
import { sequencesToWin, type TeamIndex } from '../../engine/setup';
import { DEFAULT_PLAY_SETTINGS, type ActionResult, type GameAdapter, type GameView, type PlaySettings } from '../types';

export interface LocalGameOptions extends NewGameOptions {
  settings?: Partial<PlaySettings>;
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

  constructor(options: LocalGameOptions) {
    this.random = options.random ?? Math.random;
    this.settings = { ...DEFAULT_PLAY_SETTINGS, ...options.settings };
    this.state = createGame(options);
    this.hotSeat = this.state.players.length > 1;
    this.view = toView(this.state, this.settings);
  }

  getState(): GameView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
    this.listeners.clear();
  }

  private apply(next: () => GameState): Promise<ActionResult> {
    try {
      this.state = next();
    } catch (error) {
      if (error instanceof RuleError) return Promise.resolve({ ok: false, message: error.message });
      throw error;
    }
    this.view = toView(this.state, this.settings);
    this.listeners.forEach((listener) => listener());
    return Promise.resolve({ ok: true });
  }
}

function toView(state: GameState, settings: PlaySettings): GameView {
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
  };
}
