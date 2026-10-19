import type { DeadCardMode } from '../engine/game';
import type { TeamIndex } from '../engine/setup';
import { ApiError, postJson, readJson, request } from './http';

/** A seated player. */
export interface Seat {
  handle: string;
  name: string;
}

export interface RoomTeam {
  handle: string;
  index: TeamIndex;
  seats: (Seat | null)[];
}

/** Options the table's host picks. They can change until the game starts. */
export interface RoomSettings {
  /** Players can read back every move (the move log). */
  history: boolean;
  /** Legal cells light up when a card is picked. */
  highlights: boolean;
  /** A dead card is exchanged automatically when its owner's turn starts (only when dead cards are marked). */
  autoDrawDead: boolean;
  /** Seconds each player has for a turn. */
  turnSeconds: number;
  /** 'manual': players spot dead cards and ask to exchange them. 'indicator': dead cards are marked in the hand. */
  deadCards: DeadCardMode;
  /** Dead card exchanges allowed per turn; null is unlimited. */
  exchangesPerTurn: number | null;
}

export type { DeadCardMode };

/** Custom exchange limits a host may pick (the backend's 1 to EXCHANGES_PER_TURN_MAX). */
export const EXCHANGES_PER_TURN_MIN = 1;
export const EXCHANGES_PER_TURN_MAX = 10;

export function isValidExchangesPerTurn(count: number): boolean {
  return Number.isInteger(count) && count >= EXCHANGES_PER_TURN_MIN && count <= EXCHANGES_PER_TURN_MAX;
}

/** Turn timer choices offered to hosts (the backend's TURN_TIMER_PRESETS); any whole number in range works too. */
export const TURN_TIMER_PRESETS = [30, 60, 90, 120, 180] as const;
export const TURN_SECONDS_MIN = 15;
export const TURN_SECONDS_MAX = 600;

/**
 * Highlights and history are off unless the host turns them on; 90 seconds a turn; players find dead cards
 * themselves and may exchange as many as they like. Matches the backend.
 */
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  history: false,
  highlights: false,
  autoDrawDead: false,
  turnSeconds: 90,
  deadCards: 'manual',
  exchangesPerTurn: null,
};

export function isValidTurnSeconds(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= TURN_SECONDS_MIN && seconds <= TURN_SECONDS_MAX;
}

export interface RawRoomSettings {
  history?: boolean;
  highlights?: boolean;
  auto_draw_dead?: boolean;
  turn_seconds?: number;
  dead_cards?: string;
  exchanges_per_turn?: number | null;
}

/**
 * Missing settings (an older backend) fall back to the defaults, except the dead card ones: a backend without them
 * marks dead cards and allows one exchange per turn.
 */
export function sanitizeSettings(raw: RawRoomSettings | undefined): RoomSettings {
  return {
    history: raw?.history ?? DEFAULT_ROOM_SETTINGS.history,
    highlights: raw?.highlights ?? DEFAULT_ROOM_SETTINGS.highlights,
    autoDrawDead: raw?.auto_draw_dead ?? DEFAULT_ROOM_SETTINGS.autoDrawDead,
    turnSeconds: typeof raw?.turn_seconds === 'number' ? raw.turn_seconds : DEFAULT_ROOM_SETTINGS.turnSeconds,
    deadCards: raw?.dead_cards === 'manual' ? 'manual' : 'indicator',
    exchangesPerTurn:
      raw?.exchanges_per_turn === null ? null : typeof raw?.exchanges_per_turn === 'number' ? raw.exchanges_per_turn : 1,
  };
}

function rawSettings(settings: Partial<RoomSettings>): RawRoomSettings {
  return {
    history: settings.history,
    highlights: settings.highlights,
    auto_draw_dead: settings.autoDrawDead,
    turn_seconds: settings.turnSeconds,
    dead_cards: settings.deadCards,
    exchanges_per_turn: settings.exchangesPerTurn,
  };
}

export interface Room {
  /** The table's code: a slug such as "friday-night-k3m9" (older tables have numeric codes). */
  id: string;
  name: string;
  /** The host's handle (to compare with yours), and their display name (to show). */
  administrator: string | null;
  administratorName: string | null;
  teams: RoomTeam[];
  gameStarted: boolean;
  settings: RoomSettings;
}

interface RawRoom {
  name?: string;
  administrator?: string;
  administrator_name?: string;
  teams?: { handle: string; players: ({ handle?: string; name?: string; [key: string]: unknown } | null)[] }[];
  game_started?: boolean;
  settings?: RawRoomSettings;
}

/** Keeps only the fields the UI needs. */
export function sanitizeRoom(id: string, raw: RawRoom): Room {
  return {
    id,
    name: raw.name ?? `Table ${id}`,
    settings: sanitizeSettings(raw.settings),
    administrator: raw.administrator ?? null,
    // Older backends send only the handle; it is better than nothing.
    administratorName: raw.administrator_name ?? raw.administrator ?? null,
    teams: (raw.teams ?? []).map((team, i) => ({
      handle: team.handle,
      index: i as TeamIndex,
      seats: (team.players ?? []).map((p) => (p ? { handle: String(p.handle ?? ''), name: String(p.name ?? 'Unknown player') } : null)),
    })),
    gameStarted: raw.game_started === true,
  };
}

/** Turns a 4xx JSON {error, message} into an ApiError with that message. */
async function refusal(response: Response, fallback: string): Promise<void> {
  if (response.status >= 400 && response.status < 500) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : `${fallback} (${response.status}).`;
    throw new ApiError('server', message, response.status);
  }
}

export interface NewRoomOptions {
  /** Blank lets the server pick a name. */
  name?: string;
  settings?: Partial<RoomSettings>;
}

/** POST /room/create. Returns the new table's code. Refusals (signed out, unsupported size, bad name) become an ApiError with the server's message. */
export async function createRoom(teamCount: number, playersPerTeam: number, options: NewRoomOptions = {}): Promise<string> {
  const response = await postJson('/room/create', {
    number_of_team: teamCount,
    number_of_player_in_each_team: playersPerTeam,
    name: options.name?.trim() || undefined,
    ...rawSettings(options.settings ?? {}),
  });
  await refusal(response, 'The server refused to open the table');
  const body = await readJson<{ id: string }>(response);
  if (!body?.id) throw new Error('The server did not return a table code. Try again.');
  return String(body.id);
}

/** PATCH /room/:id/settings (host only, before the game starts). Returns the updated room. */
export async function updateRoom(id: string, changes: { name?: string; settings?: Partial<RoomSettings> }): Promise<Room> {
  const response = await request(`/room/${encodeURIComponent(id)}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: changes.name, ...rawSettings(changes.settings ?? {}) }),
  });
  await refusal(response, 'The server refused to change the table');
  const raw = await readJson<RawRoom>(response);
  if (!raw) throw new ApiError('unexpected', 'The server did not return the table. Reload the page.');
  return sanitizeRoom(id, raw);
}

/** POST to a room action that answers with the room (leave, shuffle); refusals carry the server's message. */
async function roomAction(id: string, action: 'leave' | 'shuffle', fallback: string): Promise<Room> {
  const response = await postJson(`/room/${encodeURIComponent(id)}/${action}`, {});
  await refusal(response, fallback);
  const raw = await readJson<RawRoom>(response);
  if (!raw) throw new ApiError('unexpected', 'The server did not return the table. Reload the page.');
  return sanitizeRoom(id, raw);
}

/** POST /room/:id/leave: stand up from your seat (before the game starts). */
export function leaveSeat(id: string): Promise<Room> {
  return roomAction(id, 'leave', 'The server refused to free your seat');
}

/** POST /room/:id/shuffle: the host deals the seated players out to the teams at random. */
export function shuffleSeats(id: string): Promise<Room> {
  return roomAction(id, 'shuffle', 'The server refused to shuffle the teams');
}

/**
 * Reads a table code from what a player typed or pasted: a code ("friday-night-k3m9", or an older numeric one)
 * or a table link. Returns null when it can't be a code.
 */
export function parseTableCode(input: string): string | null {
  let text = input.trim();
  const link = /\/table\/([^/?#\s]+)/.exec(text);
  if (link) text = decodeURIComponent(link[1]);
  text = text.toLowerCase().replace(/\s+/g, '');
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text) ? text : null;
}

/** GET /room/:id. Returns null when the room doesn't exist (the backend answers 200 with an empty body). */
export async function getRoom(id: string): Promise<Room | null> {
  const raw = await readJson<RawRoom>(await request(`/room/${encodeURIComponent(id)}`));
  return raw ? sanitizeRoom(id, raw) : null;
}

export type JoinResult = 'success' | 'seat-taken' | 'already-seated' | 'signed-out' | 'game-started' | 'not-found';

/** POST /room/:id/join is always HTTP 200; the outcome is in `message`. */
export async function joinRoom(id: string, teamHandle: string): Promise<JoinResult> {
  const body = await readJson<{ message: unknown }>(await postJson(`/room/${encodeURIComponent(id)}/join`, { team_handle: teamHandle }));
  if (body?.message === 'success') return 'success';
  if (body?.message === 'SEAT_TAKEN') return 'seat-taken';
  if (body?.message === 'ALREADY_SEATED') return 'already-seated';
  if (body?.message === 'NOT_SIGNED_IN') return 'signed-out';
  if (body?.message === 'GAME_ALREADY_STARTED') return 'game-started';
  return 'not-found';
}

export function isSeated(room: Room, handle: string): boolean {
  return room.teams.some((t) => t.seats.some((s) => s?.handle === handle));
}

export function isFull(room: Room): boolean {
  return room.teams.every((t) => t.seats.every((s) => s !== null));
}

export type RoomStatus = 'open' | 'playing' | 'finished';

/** A table from the signed-in user's history (GET /user/rooms). */
export interface MyRoom {
  id: string;
  name: string;
  createdAt: string;
  administrator: string;
  teamCount: number;
  playersPerTeam: number;
  seatsTaken: number;
  /** null when the user created the table but never sat at it. */
  yourTeam: TeamIndex | null;
  status: RoomStatus;
  winnerTeam: TeamIndex | null;
  moveCount: number;
  /** When the last move was made (or the game started); null before the game starts. */
  lastMoveAt: string | null;
}

interface RawMyRoom {
  id: string;
  name?: string;
  created_at: string;
  administrator: string;
  team_count: number;
  players_per_team: number;
  seats_taken: number;
  your_team: number | null;
  status: string;
  winner_team: number | null;
  move_count: number;
  last_move_at?: string | null;
}

export function sanitizeMyRoom(raw: RawMyRoom): MyRoom {
  const status: RoomStatus = raw.status === 'playing' || raw.status === 'finished' ? raw.status : 'open';
  return {
    id: String(raw.id),
    name: raw.name ?? `Table ${raw.id}`,
    createdAt: String(raw.created_at),
    administrator: String(raw.administrator),
    teamCount: Number(raw.team_count),
    playersPerTeam: Number(raw.players_per_team),
    seatsTaken: Number(raw.seats_taken),
    yourTeam: raw.your_team === null ? null : (raw.your_team as TeamIndex),
    status,
    winnerTeam: raw.winner_team === null ? null : (raw.winner_team as TeamIndex),
    moveCount: Number(raw.move_count),
    lastMoveAt: raw.last_move_at ? String(raw.last_move_at) : null,
  };
}

/** One page of the user's tables. */
export interface MyRoomsPage {
  rooms: MyRoom[];
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

interface RawMyRoomsPage {
  rooms?: RawMyRoom[];
  page?: number;
  per_page?: number;
  total?: number;
  pages?: number;
}

/** One page of the tables the signed-in user created or sat at, newest first (GET /user/rooms). */
export async function listMyRooms(page = 1, perPage = 10): Promise<MyRoomsPage> {
  const raw = await readJson<RawMyRoomsPage>(await request(`/user/rooms?page=${page}&per_page=${perPage}`));
  const rooms = (raw?.rooms ?? []).map(sanitizeMyRoom);
  return {
    rooms,
    page: raw?.page ?? page,
    perPage: raw?.per_page ?? perPage,
    total: raw?.total ?? rooms.length,
    pages: Math.max(1, raw?.pages ?? 1),
  };
}

/** The game in progress you sat at that moved last, to offer for resuming (GET /user/current-game). */
export async function getCurrentGame(): Promise<MyRoom | null> {
  const raw = await readJson<{ room?: RawMyRoom | null }>(await request('/user/current-game'));
  return raw?.room ? sanitizeMyRoom(raw.room) : null;
}
