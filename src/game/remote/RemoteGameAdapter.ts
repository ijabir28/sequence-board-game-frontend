import { getDeck, getHandCards, playMove, type RawCell } from '../../api/game';
import { errorMessage } from '../../api/http';
import { BLANK, isCardName, type BoardCardName, type CardName } from '../../engine/cards';
import { isDeadCard, legalTargets, type GameState } from '../../engine/game';
import type { Pos } from '../../engine/board';
import type { TeamIndex } from '../../engine/setup';
import { DEFAULT_PLAY_SETTINGS, type ActionResult, type CellView, type GameAdapter, type GameView, type PlayerView } from '../types';
import {
  interpretPlay,
  LEGACY_PLAYERS,
  PLAY_MESSAGES,
  POLL_INTERVAL_MS,
  SERVER_LIMITATIONS,
  teamFromOccupiedBy,
  UNSUPPORTED,
} from './backendQuirks';

export interface RemoteGameOptions {
  /** The signed-in user's handle; the legacy game reads hands by handle. */
  handle: string;
  displayName: string;
  pollIntervalMs?: number;
}

const EMPTY_VIEW: GameView = {
  status: 'loading',
  board: [],
  teams: [],
  sequencesToWin: null,
  players: [],
  currentPlayerId: null,
  viewer: null,
  hand: [],
  canExchange: false,
  exchangesLeft: null,
  canPass: false,
  deckCount: null,
  sequences: [],
  log: [],
  winner: null,
  turn: null,
  settings: DEFAULT_PLAY_SETTINGS,
  hint: null,
  turnStartedAt: null,
  turnDeadline: null,
  turnPaused: false,
  turnTimeLeft: null,
  away: [],
};

/** Talks to the backend's legacy HTTP game, polling because it emits no game events. */
export class RemoteGameAdapter implements GameAdapter {
  readonly mode = 'remote' as const;
  readonly hotSeat = false;
  private view: GameView = EMPTY_VIEW;
  private board: CellView[][] = [];
  private hand: CardName[] = [];
  private readonly viewer: PlayerView | null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly options: RemoteGameOptions) {
    const team = LEGACY_PLAYERS[options.handle];
    this.viewer = team === undefined ? null : { id: options.handle, name: options.displayName, team };
  }

  getState(): GameView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  legalTargets(handIndex: number): Pos[] {
    if (!this.viewer || this.view.status !== 'ready') return [];
    return legalTargets(this.engineState(), handIndex);
  }

  async playCard(handIndex: number, target: Pos): Promise<ActionResult> {
    if (!this.viewer) return { ok: false, message: this.unsupportedPlayerMessage() };
    let outcome;
    try {
      const response = await playMove(this.viewer.id, handIndex, target);
      outcome = interpretPlay(response.status, response.body);
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
    // Whatever happened, re-read the server's view of the board and hand.
    await this.refresh();
    switch (outcome.kind) {
      case 'applied':
        return { ok: true };
      case 'invalid':
        return { ok: false, message: PLAY_MESSAGES.invalid };
      case 'server-error':
        return { ok: false, message: PLAY_MESSAGES.serverError(outcome.status) };
    }
  }

  async exchangeDeadCard(): Promise<ActionResult> {
    return { ok: false, message: UNSUPPORTED.exchange };
  }

  async pass(): Promise<ActionResult> {
    return { ok: false, message: UNSUPPORTED.pass };
  }

  /** Fetches the board and hand. Concurrent calls share one request. */
  refresh(): Promise<void> {
    this.inFlight ??= this.load().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.listeners.clear();
  }

  private start() {
    if (this.disposed) return;
    void this.refresh();
    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.refresh();
    }, this.options.pollIntervalMs ?? POLL_INTERVAL_MS);
    // Hidden, the page skips its polls: catch up at once on coming back.
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void this.refresh();
  };

  private stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private async load() {
    if (!this.viewer) {
      this.publish({ ...EMPTY_VIEW, status: 'error', error: this.unsupportedPlayerMessage() });
      return;
    }
    try {
      const [deck, hand] = await Promise.all([getDeck(), getHandCards(this.viewer.id)]);
      this.board = deck.map((row, r) => row.map((cell, c) => toCell(cell, r, c)));
      this.hand = hand.filter(isCardName);
      this.publish(this.buildView());
    } catch (error) {
      // Keep the last good board on a failed poll; only show the error screen if we never loaded.
      if (this.view.status === 'ready') return;
      this.publish({ ...EMPTY_VIEW, status: 'error', error: errorMessage(error) });
    }
  }

  private buildView(): GameView {
    const viewer = this.viewer!;
    const state = this.engineState();
    const teamsOnBoard = new Set<TeamIndex>([0, 1]);
    this.board.flat().forEach((cell) => cell.chip !== null && teamsOnBoard.add(cell.chip));
    return {
      ...EMPTY_VIEW,
      status: 'ready',
      notice: SERVER_LIMITATIONS,
      board: this.board,
      teams: [...teamsOnBoard].sort().map((index) => ({ index, sequences: 0 })),
      players: [viewer],
      viewer,
      hand: this.hand.map((card) => ({ card, dead: isDeadCard(state, card) })),
    };
  }

  /** A minimal engine state so the client can highlight legal cells on the server's board. */
  private engineState(): GameState {
    return {
      teamCount: 2,
      players: [{ id: this.viewer!.id, name: this.viewer!.name, team: this.viewer!.team }],
      hands: [this.hand],
      chips: this.board.map((row) => row.map((cell) => cell.chip)),
      deck: [],
      discard: [],
      current: 0,
      turn: 1,
      exchangesThisTurn: 0,
      sequences: [],
      winner: null,
      log: [],
    };
  }

  /** Only notify when something actually changed, so polling doesn't reset the UI (e.g. the selected card). */
  private publish(next: GameView) {
    if (this.disposed) return;
    if (JSON.stringify(next) === JSON.stringify(this.view)) return;
    this.view = next;
    this.listeners.forEach((listener) => listener());
  }

  private unsupportedPlayerMessage(): string {
    return `The server's test game only has seats for ${Object.keys(LEGACY_PLAYERS).join(', ')}. Sign in as one of them, or play a hot-seat game.`;
  }
}

function toCell(raw: RawCell, row: number, column: number): CellView {
  const card: BoardCardName = raw.name === BLANK || !isCardName(raw.name) ? BLANK : raw.name;
  const chip = teamFromOccupiedBy(raw.occupied_by);
  return { row, column, card, chip, locked: false };
}
