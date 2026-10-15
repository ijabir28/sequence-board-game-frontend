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

export interface Room {
  id: string;
  administrator: string | null;
  teams: RoomTeam[];
  gameStarted: boolean;
}

interface RawRoom {
  administrator?: string;
  teams?: { handle: string; players: ({ handle?: string; name?: string; [key: string]: unknown } | null)[] }[];
  game_started?: boolean;
}

/** Keeps only the fields the UI needs. */
export function sanitizeRoom(id: string, raw: RawRoom): Room {
  return {
    id,
    administrator: raw.administrator ?? null,
    teams: (raw.teams ?? []).map((team, i) => ({
      handle: team.handle,
      index: i as TeamIndex,
      seats: (team.players ?? []).map((p) => (p ? { handle: String(p.handle ?? ''), name: String(p.name ?? 'Unknown player') } : null)),
    })),
    gameStarted: raw.game_started === true,
  };
}

/** POST /room/create. Refusals (signed out, unsupported size) are JSON {error, message} and become an ApiError with that message. */
export async function createRoom(teamCount: number, playersPerTeam: number): Promise<string> {
  const response = await postJson('/room/create', { number_of_team: teamCount, number_of_player_in_each_team: playersPerTeam });
  if (response.status >= 400 && response.status < 500) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : `The server refused to open the table (${response.status}).`;
    throw new ApiError('server', message, response.status);
  }
  const body = await readJson<{ id: string }>(response);
  if (!body?.id) throw new Error('The server did not return a table code. Try again.');
  return String(body.id);
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
