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

/** `training` gives the player whose turn it is hints; `standard` games never get any. */
export type GameMode = 'standard' | 'training';

/** Options the table's host picks. They can change until the game starts. */
export interface RoomSettings {
  mode: GameMode;
  /** Players can read back every move (the move log). */
  history: boolean;
  /** Legal cells light up when a card is picked. */
  highlights: boolean;
  /** A dead card is exchanged automatically when its owner's turn starts. */
  autoDrawDead: boolean;
  /** Seconds each player has for a turn. */
  turnSeconds: number;
}

/** Turn timer choices offered to hosts (the backend's TURN_TIMER_PRESETS); any whole number in range works too. */
export const TURN_TIMER_PRESETS = [30, 60, 90, 120, 180] as const;
export const TURN_SECONDS_MIN = 15;
export const TURN_SECONDS_MAX = 600;

/** Highlights and history are off unless the host turns them on; 90 seconds a turn. Matches the backend. */
export const DEFAULT_ROOM_SETTINGS: RoomSettings = { mode: 'standard', history: false, highlights: false, autoDrawDead: false, turnSeconds: 90 };

export function isValidTurnSeconds(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= TURN_SECONDS_MIN && seconds <= TURN_SECONDS_MAX;
}

export interface RawRoomSettings {
  mode?: string;
  history?: boolean;
  highlights?: boolean;
  auto_draw_dead?: boolean;
  turn_seconds?: number;
}

/** Missing settings (an older backend) fall back to the defaults. */
export function sanitizeSettings(raw: RawRoomSettings | undefined): RoomSettings {
  return {
    mode: raw?.mode === 'training' ? 'training' : 'standard',
    history: raw?.history ?? DEFAULT_ROOM_SETTINGS.history,
    highlights: raw?.highlights ?? DEFAULT_ROOM_SETTINGS.highlights,
    autoDrawDead: raw?.auto_draw_dead ?? DEFAULT_ROOM_SETTINGS.autoDrawDead,
    turnSeconds: typeof raw?.turn_seconds === 'number' ? raw.turn_seconds : DEFAULT_ROOM_SETTINGS.turnSeconds,
  };
}

function rawSettings(settings: Partial<RoomSettings>): RawRoomSettings {
  return { mode: settings.mode, history: settings.history, highlights: settings.highlights, auto_draw_dead: settings.autoDrawDead, turn_seconds: settings.turnSeconds };
}

export interface Room {
  /** The table's code: a slug such as "friday-night-k3m9" (older tables have numeric codes). */
  id: string;
  name: string;
  administrator: string | null;
  teams: RoomTeam[];
  gameStarted: boolean;
  settings: RoomSettings;
}

interface RawRoom {
  name?: string;
  administrator?: string;
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
  };
}

/** The tables the signed-in user created or sat at, newest first. */
export async function listMyRooms(): Promise<MyRoom[]> {
  const raw = await readJson<RawMyRoom[]>(await request('/user/rooms'));
  return (raw ?? []).map(sanitizeMyRoom);
}
