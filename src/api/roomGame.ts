import type { Pos } from '../engine/board';
import type { LogEntry } from '../engine/game';
import type { Sequence } from '../engine/sequences';
import type { TeamIndex } from '../engine/setup';
import { ApiError, postJson, request } from './http';
import type { HintReason } from '../engine/hints';
import type { RawRoomSettings } from './rooms';

// A table's game (backend controller/room_game.js). Every response is the game as the
// signed-in player sees it; errors are JSON {error, message}.

export interface RoomGamePlayer {
  handle: string;
  name: string;
  team: TeamIndex;
  hand_count: number;
}

/** A suggested move: training games only, for the player whose turn it is. */
export type RawHint =
  | { type: 'play'; hand_index: number; target: Pos; reason: HintReason }
  | { type: 'exchange'; hand_index: number; reason: HintReason }
  | { type: 'pass'; reason: HintReason };

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
  can_pass: boolean;
  deck_count: number;
  sequences: Sequence[];
  winner: TeamIndex | null;
  /** With history off, only the latest move. */
  log: LogEntry[];
  /** The room's name and settings (missing from older backends). */
  name?: string;
  settings?: RawRoomSettings;
  hint?: RawHint | null;
}

/** The server understood the request and refused it, for example a move out of turn. */
export class GameRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GameRejectedError';
  }
}

async function readGame(response: Response): Promise<RoomGameView> {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('server', `The server returned an error (${response.status}). Try again in a moment.`, response.status);
  }
  if (!response.ok) {
    const { error, message } = (body ?? {}) as { error?: string; message?: string };
    if (error && response.status < 500) throw new GameRejectedError(error, message ?? 'The server refused that.', response.status);
    throw new ApiError('server', message ?? `The server returned an error (${response.status}). Try again in a moment.`, response.status);
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
