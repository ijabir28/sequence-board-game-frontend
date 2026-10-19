import { errorMessage } from '../../api/http';
import {
  endRoomRounds,
  exchangeRoomCard,
  GameRejectedError,
  getRoomGame,
  getRoomRound,
  nextRoomRound,
  passRoomTurn,
  playRoomCard,
  type RawPlayerStats,
  type RawRoundResult,
  type RawRounds,
  type RoomGameView,
} from '../../api/roomGame';
import { sanitizeSettings } from '../../api/rooms';
import { announcePresence, onGameUpdated } from '../../api/socket';
import { positionsOf, type Pos } from '../../engine/board';
import { BLANK, cardKind, isCardName, type BoardCardName, type CardName } from '../../engine/cards';
import { legalTargets, type GameState } from '../../engine/game';
import { isLocked } from '../../engine/sequences';
import type { TeamIndex } from '../../engine/setup';
import {
  DEFAULT_PLAY_SETTINGS,
  type ActionResult,
  type GameAdapter,
  type GameView,
  type PlayerStats,
  type PlayerView,
  type CellView,
  type RoundDetail,
  type RoundResult,
  type RoundsView,
} from '../types';
import type { Sequence } from '../../engine/sequences';

export interface RoomGameOptions {
  roomId: string;
  /** Called with a listener whenever the server says this game changed. Defaults to the socket's `game_updated`. */
  subscribeUpdates?: (listener: () => void) => () => void;
  /** Safety-net poll in case a socket event is missed. */
  pollIntervalMs?: number;
  /**
   * Tells the server the viewer is at the table while this game is open; returns a function that says they left.
   * Defaults to the socket's `join_game` / `leave_game`.
   */
  announcePresence?: (handle: string, token: string) => () => void;
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
  /** This device's clock minus the server's, measured once so the turn start stays put between refreshes. */
  private clockSkew: number | null = null;
  /** The token we announced presence with, and how to take it back. */
  private presence: { token: string; leave: () => void } | null = null;
  /** The viewer has a menu or the leave dialog open: they count as away from the table. */
  private steppedAway = false;

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

  nextRound(): Promise<ActionResult> {
    return this.act(() => nextRoomRound(this.options.roomId));
  }

  endRounds(): Promise<ActionResult> {
    return this.act(() => endRoomRounds(this.options.roomId));
  }

  async roundDetail(round: number): Promise<RoundDetail> {
    try {
      const raw = await getRoomRound(this.options.roomId, round);
      return { result: toRoundResult(raw), board: toBoard(raw.board, raw.sequences), sequences: raw.sequences, log: raw.log };
    } catch (error) {
      throw new Error(error instanceof GameRejectedError ? error.message : errorMessage(error));
    }
  }

  stepAway(away: boolean): void {
    if (away === this.steppedAway) return;
    this.steppedAway = away;
    if (away) {
      this.presence?.leave();
      this.presence = null;
    } else if (this.server) {
      this.announce(this.server);
    }
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
    this.presence?.leave();
    this.presence = null;
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
    if (this.clockSkew === null && server.server_time) {
      const serverNow = Date.parse(server.server_time);
      if (!Number.isNaN(serverNow)) this.clockSkew = Date.now() - serverNow;
    }
    this.announce(server);
    this.publish(toView(server, this.clockSkew ?? 0));
  }

  /** Seated players are "at the table" while the game is open, so their turn doesn't pause. */
  private announce(server: RoomGameView) {
    const token = server.viewer && server.presence_token;
    if (!token || this.steppedAway || this.presence?.token === token || this.listeners.size === 0 || this.disposed) return;
    this.presence?.leave();
    const announce = this.options.announcePresence ?? ((handle, t) => announcePresence(this.options.roomId, handle, t));
    this.presence = { token, leave: announce(server.viewer!, token) };
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
      exchangesThisTurn: 0,
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

/** `clockSkew` is this device's clock minus the server's, in ms. */
export function toView(server: RoomGameView, clockSkew = 0): GameView {
  const players: PlayerView[] = server.players.map((p) => ({ id: p.handle, name: p.name, team: p.team }));
  const viewer = players.find((p) => p.id === server.viewer) ?? null;
  const teamIndexes = Array.from({ length: server.team_count }, (_, i) => i as TeamIndex);
  const hand = server.hand.filter(isCardName) as CardName[];
  const chips = server.board.map((row) => row.map((cell) => cell.team));
  const { mode, highlights, history, deadCards } = sanitizeSettings(server.settings);
  return {
    status: 'ready',
    title: server.name,
    settings: { mode, highlights, history, deadCards },
    // Training tables are retired, so tables never hint, even if an older server still sends one.
    hint: null,
    turnStartedAt: server.winner === null && server.turn_started_at ? Date.parse(server.turn_started_at) + clockSkew : null,
    turnDeadline: server.winner === null && server.turn_deadline ? Date.parse(server.turn_deadline) + clockSkew : null,
    turnPaused: server.winner === null && server.turn_paused === true,
    turnTimeLeft: server.winner === null && server.turn_paused === true ? (server.turn_time_left_ms ?? null) : null,
    away: server.away ?? [],
    rounds: toRounds(server.rounds, server.host ?? null, server.viewer),
    notice: viewer ? undefined : "You don't have a seat in this game, so you're watching.",
    board: toBoard(server.board, server.sequences),
    teams: teamIndexes.map((index) => ({ index, sequences: server.sequences.filter((s) => s.team === index).length })),
    sequencesToWin: server.sequences_to_win,
    players,
    currentPlayerId: server.current_player,
    viewer,
    // With manual dead cards, players find them themselves: nothing is marked.
    hand: hand.map((card) => ({ card, dead: deadCards === 'indicator' && isDead(card, chips) })),
    canExchange: server.can_exchange,
    exchangesLeft: server.exchanges_left ?? null,
    canPass: server.can_pass,
    deckCount: server.deck_count,
    sequences: server.sequences,
    log: server.log,
    winner: server.winner,
    turn: server.turn,
  };
}

function toPlayerStats(raw: RawPlayerStats): PlayerStats {
  return {
    id: raw.handle,
    name: raw.name,
    team: raw.team,
    plays: raw.plays,
    wilds: raw.wilds,
    removals: raw.removals,
    exchanges: raw.exchanges,
    passes: raw.passes,
    timedOut: raw.timed_out,
  };
}

function toBoard(board: RoomGameView['board'], sequences: Sequence[]): CellView[][] {
  return board.map((row, r) =>
    row.map((cell, c) => {
      const card: BoardCardName = cell.name === BLANK || !isCardName(cell.name) ? BLANK : cell.name;
      return { row: r, column: c, card, chip: cell.team, locked: cell.team !== null && isLocked(sequences, { row: r, column: c }) };
    }),
  );
}

function toRoundResult(result: RawRoundResult): RoundResult {
  const started = result.started_at ? Date.parse(result.started_at) : NaN;
  const finished = result.finished_at ? Date.parse(result.finished_at) : NaN;
  return {
    round: result.round,
    winner: result.winner,
    durationMs: Number.isNaN(started) || Number.isNaN(finished) ? null : Math.max(0, finished - started),
    stats: result.stats && {
      turns: result.stats.turns,
      firstPlayerId: result.stats.first_player,
      teams: result.stats.teams,
      players: result.stats.players.map(toPlayerStats),
    },
  };
}

function toRounds(raw: RawRounds | undefined, hostId: string | null, viewer: string | null): RoundsView | null {
  if (!raw) return null;
  return {
    round: raw.round,
    over: raw.over,
    hostId,
    isHost: hostId !== null && hostId === viewer,
    results: raw.results.map(toRoundResult),
    summary: raw.summary && {
      roundsPlayed: raw.summary.rounds_played,
      turns: raw.summary.turns,
      teams: raw.summary.teams.map((t) => ({ team: t.team, roundsWon: t.rounds_won, sequences: t.sequences, placed: t.placed, removed: t.removed })),
      players: raw.summary.players.map(toPlayerStats),
      winner: raw.summary.verdict.winner,
      leaders: raw.summary.verdict.leaders,
    },
  };
}

/** Both board cells for this card are covered (jacks are never dead). */
function isDead(card: CardName, chips: (TeamIndex | null)[][]): boolean {
  if (cardKind(card) !== 'normal') return false;
  return positionsOf(card).every((p) => chips[p.row][p.column] !== null);
}
