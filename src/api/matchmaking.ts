import { ApiError, UNREADABLE_RESPONSE, readJson, request } from './http';

// Quick Match, /matchmaking/queue on the backend (see its docs/api.md): queue for a table shape and the server seats
// you with someone who asked for the same, or with bots after two minutes. A waiting page must keep asking for its
// status, or the server drops it from the queue.

export type MatchTeams = 2 | 3;
export type MatchTimer = 'blitz' | 'medium' | 'slow';

export const MATCH_TIMERS: { id: MatchTimer; label: string; seconds: number }[] = [
  { id: 'blitz', label: 'Blitz', seconds: 15 },
  { id: 'medium', label: 'Medium', seconds: 45 },
  { id: 'slow', label: 'Slow', seconds: 90 },
];

export type QueueStatus =
  | {
      status: 'queued';
      teams: MatchTeams;
      timer: MatchTimer;
      /** When this device joined and when bots will fill the table, on this device's clock (ms). */
      joinedAt: number;
      botsAt: number;
      /** Players in this queue, you included. */
      waiting: number;
    }
  /** The table is being made: ask again. */
  | { status: 'matching' }
  /** Seated at a new table (`matched`), or at one already in progress (`playing`). */
  | { status: 'matched' | 'playing'; roomId: string }
  | { status: 'idle' };

function time(value: unknown, skew: number): number | null {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? null : parsed + skew;
}

/** Reads the server's status. Times are moved onto this device's clock using the server's `server_time`. */
export function sanitizeQueueStatus(raw: Record<string, unknown>, now = Date.now()): QueueStatus {
  if ((raw.status === 'matched' || raw.status === 'playing') && typeof raw.room_id === 'string' && raw.room_id) {
    return { status: raw.status, roomId: raw.room_id };
  }
  if (raw.status === 'matching') return { status: 'matching' };
  if (raw.status === 'queued') {
    const serverNow = time(raw.server_time, 0);
    const skew = serverNow === null ? 0 : now - serverNow;
    const joinedAt = time(raw.joined_at, skew) ?? now;
    return {
      status: 'queued',
      teams: raw.teams === 3 ? 3 : 2,
      timer: MATCH_TIMERS.some((t) => t.id === raw.timer) ? (raw.timer as MatchTimer) : 'medium',
      joinedAt,
      botsAt: time(raw.bots_at, skew) ?? joinedAt + 120_000,
      waiting: typeof raw.waiting === 'number' && raw.waiting >= 1 ? Math.round(raw.waiting) : 1,
    };
  }
  return { status: 'idle' };
}

async function readStatus(response: Response): Promise<QueueStatus> {
  if (response.status >= 400 && response.status < 500) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    throw new ApiError('refused', typeof body?.message === 'string' ? body.message : "We couldn't find you a match. Please try again.", response.status);
  }
  const body = await readJson<Record<string, unknown>>(response);
  if (!body) throw new ApiError('unexpected', UNREADABLE_RESPONSE);
  return sanitizeQueueStatus(body);
}

/** POST /matchmaking/queue: joins the queue for this table shape. */
export async function joinQueue(teams: MatchTeams, timer: MatchTimer): Promise<QueueStatus> {
  return readStatus(
    await request('/matchmaking/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams, timer }),
    }),
  );
}

/** GET /matchmaking/queue: where you stand. Calling it keeps you in the queue. */
export async function getQueueStatus(): Promise<QueueStatus> {
  return readStatus(await request('/matchmaking/queue'));
}

/** DELETE /matchmaking/queue: leaves the queue. */
export async function leaveQueue(): Promise<QueueStatus> {
  return readStatus(await request('/matchmaking/queue', { method: 'DELETE' }));
}
