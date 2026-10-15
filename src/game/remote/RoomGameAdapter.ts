import { errorMessage } from '../../api/http';
import {
  exchangeRoomCard,
  GameRejectedError,
  getRoomGame,
  passRoomTurn,
  playRoomCard,
  type RoomGameView,
} from '../../api/roomGame';
import { onGameUpdated } from '../../api/socket';
import { positionsOf, type Pos } from '../../engine/board';
import { BLANK, cardKind, isCardName, type BoardCardName, type CardName } from '../../engine/cards';
import { legalTargets, type GameState } from '../../engine/game';
import { isLocked } from '../../engine/sequences';
import type { TeamIndex } from '../../engine/setup';
import type { ActionResult, GameAdapter, GameView, PlayerView } from '../types';

export interface RoomGameOptions {
  roomId: string;
  /** Called with a listener whenever the server says this game changed. Defaults to the socket's `game_updated`. */
  subscribeUpdates?: (listener: () => void) => () => void;
  /** Safety-net poll in case a socket event is missed. */
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
  canPass: false,
  deckCount: null,
  sequences: [],
  log: [],
  winner: null,
  turn: null,
};

/** A table's game, run by the server. Each player sees only their own hand. */
export class RoomGameAdapter implements GameAdapter {
  readonly mode = 'remote' as const;
  readonly hotSeat = false;
  private view: GameView = EMPTY_VIEW;
  private server: RoomGameView | null = null;
  private listeners = new Set<() => void>();
  private unsubscribeUpdates: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly options: RoomGameOptions) {}

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

  /** Targets are shown even when it isn't your turn, so you can plan; the server enforces turn order. */
  legalTargets(handIndex: number): Pos[] {
    const state = this.engineState();
    return state ? legalTargets(state, handIndex) : [];
  }

  playCard(handIndex: number, target: Pos): Promise<ActionResult> {
    return this.act(() => playRoomCard(this.options.roomId, handIndex, target));
  }

  exchangeDeadCard(handIndex: number): Promise<ActionResult> {
    return this.act(() => exchangeRoomCard(this.options.roomId, handIndex));
  }

  pass(): Promise<ActionResult> {
    return this.act(() => passRoomTurn(this.options.roomId));
  }

  /** Re-reads the game. Concurrent calls share one request. */
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
    const subscribe = this.options.subscribeUpdates ?? ((listener) => onGameUpdated(this.options.roomId, listener));
    this.unsubscribeUpdates = subscribe(() => void this.refresh());
    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.refresh();
    }, this.options.pollIntervalMs ?? 15_000);
  }

  private stop() {
    this.unsubscribeUpdates?.();
    this.unsubscribeUpdates = null;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async act(send: () => Promise<RoomGameView>): Promise<ActionResult> {
    try {
      this.accept(await send());
      return { ok: true };
    } catch (error) {
      if (error instanceof GameRejectedError) {
        // The board may have moved on (for example another player just played), so catch up.
        void this.refresh();
        return { ok: false, message: error.message };
      }
      return { ok: false, message: errorMessage(error) };
    }
  }

  private async load() {
    try {
      this.accept(await getRoomGame(this.options.roomId));
    } catch (error) {
      // Keep the last good board on a failed refresh; only show the error screen if we never loaded.
      if (this.view.status === 'ready') return;
      const message = error instanceof GameRejectedError ? error.message : errorMessage(error);
      this.publish({ ...EMPTY_VIEW, status: 'error', error: message });
    }
  }

  private accept(server: RoomGameView) {
    this.server = server;
    this.publish(toView(server));
  }

  /** The engine only needs the board, sequences and the viewer's hand to list legal cells. */
  private engineState(): GameState | null {
    const server = this.server;
    const viewer = this.view.viewer;
    if (!server || !viewer || this.view.status !== 'ready') return null;
    return {
      teamCount: server.team_count,
      players: [viewer],
      hands: [this.view.hand.map((h) => h.card)],
      chips: server.board.map((row) => row.map((cell) => cell.team)),
      deck: [],
      discard: [],
      current: 0,
      turn: server.turn,
      exchangedThisTurn: false,
      sequences: server.sequences,
      winner: server.winner,
      log: [],
    };
  }

  /** Only notify when something actually changed, so refreshes don't reset the UI (e.g. the selected card). */
  private publish(next: GameView) {
    if (this.disposed) return;
    if (JSON.stringify(next) === JSON.stringify(this.view)) return;
    this.view = next;
    this.listeners.forEach((listener) => listener());
  }
}

export function toView(server: RoomGameView): GameView {
  const players: PlayerView[] = server.players.map((p) => ({ id: p.handle, name: p.name, team: p.team }));
  const viewer = players.find((p) => p.id === server.viewer) ?? null;
  const teamIndexes = Array.from({ length: server.team_count }, (_, i) => i as TeamIndex);
  const hand = server.hand.filter(isCardName) as CardName[];
  const chips = server.board.map((row) => row.map((cell) => cell.team));
  return {
    status: 'ready',
    notice: viewer ? undefined : "You don't have a seat in this game, so you're watching.",
    board: server.board.map((row, r) =>
      row.map((cell, c) => {
        const card: BoardCardName = cell.name === BLANK || !isCardName(cell.name) ? BLANK : cell.name;
        return { row: r, column: c, card, chip: cell.team, locked: cell.team !== null && isLocked(server.sequences, { row: r, column: c }) };
      }),
    ),
    teams: teamIndexes.map((index) => ({ index, sequences: server.sequences.filter((s) => s.team === index).length })),
    sequencesToWin: server.sequences_to_win,
    players,
    currentPlayerId: server.current_player,
    viewer,
    hand: hand.map((card) => ({ card, dead: isDead(card, chips) })),
    canExchange: server.can_exchange,
    canPass: server.can_pass,
    deckCount: server.deck_count,
    sequences: server.sequences,
    log: server.log,
    winner: server.winner,
    turn: server.turn,
  };
}

/** Both board cells for this card are covered (jacks are never dead). */
function isDead(card: CardName, chips: (TeamIndex | null)[][]): boolean {
  if (cardKind(card) !== 'normal') return false;
  return positionsOf(card).every((p) => chips[p.row][p.column] !== null);
}
