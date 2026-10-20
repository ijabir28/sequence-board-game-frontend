import type { Pos } from '../engine/board';
import type { LogEntry } from '../engine/game';
import type { Sequence } from '../engine/sequences';
import type { TeamIndex } from '../engine/setup';
import { ApiError, failureMessage, postJson, request } from './http';
import type { RawRoomSettings } from './rooms';

// A table's game (backend controller/room_game.js). Every response is the game as the
// signed-in player sees it; errors are JSON {error, message}.

export interface RoomGamePlayer {
  handle: string;
  name: string;
  team: TeamIndex;
  hand_count: number;
}

export interface RawPlayerStats {
  handle: string;
  name: string;
  team: TeamIndex;
  plays: number;
  wilds: number;
  removals: number;
  exchanges: number;
  passes: number;
  timed_out: number;
}

export interface RawRoundResult {
  round: number;
  winner: TeamIndex | null;
  started_at: string | null;
  finished_at: string | null;
  stats: {
    winner: TeamIndex | null;
    turns: number;
    first_player: string;
    teams: { team: TeamIndex; sequences: number; chips: number; placed: number; removed: number }[];
    players: RawPlayerStats[];
  } | null;
}

/** GET /room/:id/rounds/:round: a won round to look back on, with its final board and whole move log. */
export interface RawRoundDetail extends RawRoundResult {
  team_count: 2 | 3;
  players: { handle: string; name: string; team: TeamIndex }[];
  board: { name: string; team: TeamIndex | null }[][];
  sequences: Sequence[];
  log: LogEntry[];
}

/** Where the table is in its rounds (missing from older backends). */
export interface RawRounds {
  round: number;
  over: boolean;
  results: RawRoundResult[];
  summary: {
    rounds_played: number;
    turns: number;
    teams: { team: TeamIndex; rounds_won: number; sequences: number; placed: number; removed: number }[];
    players: RawPlayerStats[];
    verdict: { winner: TeamIndex | null; leaders: TeamIndex[] };
  } | null;
}

export interface RoomGameView {
  team_count: 2 | 3;
  sequences_to_win: number;
  players: RoomGamePlayer[];
  /** Handle of whoever moves next; null once the game is won. */
  current_player: string | null;
  turn: number;
  board: { name: string; team: TeamIndex | null }[][];
  /** The signed-in player's handle, or null for a spectator. */
  viewer: string | null;
  hand: string[];
  can_exchange: boolean;
  /** Current player only: dead card exchanges left this turn; null when unlimited (missing from older backends). */
  exchanges_left?: number | null;
  can_pass: boolean;
  deck_count: number;
  sequences: Sequence[];
  winner: TeamIndex | null;
  /** With history off, only the latest move. */
  log: LogEntry[];
  /** The room's name and settings (missing from older backends). */
  name?: string;
  /** The host's handle, and the table's rounds (missing from older backends). */
  host?: string;
  rounds?: RawRounds;
  settings?: RawRoomSettings;
  /** When the current turn began (ISO time), and the server's clock at the time of the response. */
  turn_started_at?: string | null;
  /** When the turn's timer runs out (ISO time); the server then plays a random card for the player. */
  turn_deadline?: string | null;
  /** The current player is away from the table: the turn waits for them, with no deadline. */
  turn_paused?: boolean;
  /** While paused: the time the current player will have left (ms). */
  turn_time_left_ms?: number | null;
  /** Seated players whose game page isn't open. */
  away?: string[];
  /** Seated viewers only: sent on the game socket to say they're at the table. */
  presence_token?: string | null;
  server_time?: string;
}

/** The server understood the request and refused it, for example a move out of turn. */
export class GameRejectedError extends ApiError {
  declare readonly status: number;

  constructor(
    readonly code: string,
    message: string,
    status: number,
  ) {
    super('refused', message, status);
    this.name = 'GameRejectedError';
  }
}

async function readGame(response: Response): Promise<RoomGameView> {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('server', failureMessage(response.status), response.status);
  }
  if (!response.ok) {
    const { error, message } = (body ?? {}) as { error?: string; message?: string };
    if (error && response.status < 500) throw new GameRejectedError(error, message ?? "That isn't allowed right now.", response.status);
    throw new ApiError('server', message ?? failureMessage(response.status), response.status);
  }
  return body as RoomGameView;
}

const base = (roomId: string) => `/room/${encodeURIComponent(roomId)}`;

/** POST /room/:id/start. Deals the game for a full table. */
export async function startRoomGame(roomId: string): Promise<RoomGameView> {
  return readGame(await postJson(`${base(roomId)}/start`, {}));
}

export async function getRoomGame(roomId: string): Promise<RoomGameView> {
  return readGame(await request(`${base(roomId)}/game`));
}

export async function playRoomCard(roomId: string, handIndex: number, pos: Pos): Promise<RoomGameView> {
  return readGame(await postJson(`${base(roomId)}/game/play`, { hand_index: handIndex, row: pos.row, column: pos.column }));
}

export async function exchangeRoomCard(roomId: string, handIndex: number): Promise<RoomGameView> {
  return readGame(await postJson(`${base(roomId)}/game/exchange`, { hand_index: handIndex }));
}

export async function passRoomTurn(roomId: string): Promise<RoomGameView> {
  return readGame(await postJson(`${base(roomId)}/game/pass`, {}));
}

/** POST /room/:id/rounds/next (host). Deals the next round once the current one is won. */
export async function nextRoomRound(roomId: string): Promise<RoomGameView> {
  return readGame(await postJson(`${base(roomId)}/rounds/next`, {}));
}

/** GET /room/:id/rounds/:round. A won round's statistics, final board and move log. */
export async function getRoomRound(roomId: string, round: number): Promise<RawRoundDetail> {
  return (await readGame(await request(`${base(roomId)}/rounds/${round}`))) as unknown as RawRoundDetail;
}

/** POST /room/:id/rounds/end (host). Ends the rounds once the current one is won; the view then has the summary. */
export async function endRoomRounds(roomId: string): Promise<RoomGameView> {
  return readGame(await postJson(`${base(roomId)}/rounds/end`, {}));
}
