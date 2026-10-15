import type { TeamIndex } from '../engine/setup';
import { postJson, readJson, request } from './http';

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
}

interface RawRoom {
  administrator?: string;
  teams?: { handle: string; players: ({ handle?: string; name?: string; [key: string]: unknown } | null)[] }[];
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
  };
}

export async function createRoom(teamCount: number, playersPerTeam: number): Promise<string> {
  const body = await readJson<{ id: string }>(
    await postJson('/room/create', { number_of_team: teamCount, number_of_player_in_each_team: playersPerTeam }),
  );
  if (!body?.id) throw new Error('The server did not return a table code. Try again.');
  return String(body.id);
}

/** GET /room/:id. Returns null when the room doesn't exist (the backend answers 200 with an empty body). */
export async function getRoom(id: string): Promise<Room | null> {
  const raw = await readJson<RawRoom>(await request(`/room/${encodeURIComponent(id)}`));
  return raw ? sanitizeRoom(id, raw) : null;
}

export type JoinResult = 'success' | 'seat-taken' | 'already-seated' | 'signed-out' | 'not-found';

/** POST /room/:id/join is always HTTP 200; the outcome is in `message`. */
export async function joinRoom(id: string, teamHandle: string): Promise<JoinResult> {
  const body = await readJson<{ message: unknown }>(await postJson(`/room/${encodeURIComponent(id)}/join`, { team_handle: teamHandle }));
  if (body?.message === 'success') return 'success';
  if (body?.message === 'SEAT_TAKEN') return 'seat-taken';
  if (body?.message === 'ALREADY_SEATED') return 'already-seated';
  if (body?.message === 'NOT_SIGNED_IN') return 'signed-out';
  return 'not-found';
}

export function isSeated(room: Room, handle: string): boolean {
  return room.teams.some((t) => t.seats.some((s) => s?.handle === handle));
}
