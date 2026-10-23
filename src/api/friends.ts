import { ApiError, UNREADABLE_RESPONSE, readJson, request } from './http';

// Friends on the backend (see its docs/api.md): /friends/… for the list, searching, requests and invitations, and
// POST /room/:id/invite to ask a friend to a table. Whoever a change concerns hears `friends_updated` on their socket
// (and an invited friend `table_invitation`), and reads the list again.

export interface Player {
  handle: string;
  name: string;
  image: string | null;
}

export interface Friend extends Player {
  /** When they became friends (ms), or null. */
  since: number | null;
  /** Has the app open right now. */
  online: boolean;
  /** Has a seat at a table game in progress. */
  playing: boolean;
  /** That game's table code, only when the friend lets friends watch their games (their profile setting); else null. */
  watch: string | null;
}

export interface FriendRequest extends Player {
  sentAt: number | null;
}

export interface TableInvitation {
  roomId: string;
  roomName: string;
  from: Player;
  sentAt: number | null;
  seatsTaken: number;
  seats: number;
}

export interface FriendsOverview {
  friends: Friend[];
  /** Requests waiting for this player's answer. */
  incoming: FriendRequest[];
  /** Requests this player sent that nobody has answered yet. */
  outgoing: FriendRequest[];
  invitations: TableInvitation[];
}

/** How the signed-in player stands with someone found by a search. */
export type Relationship = 'none' | 'friends' | 'incoming' | 'outgoing';

export interface SearchResult extends Player {
  relationship: Relationship;
}

const RELATIONSHIPS: Relationship[] = ['none', 'friends', 'incoming', 'outgoing'];

type Raw = Record<string, unknown>;

function time(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function list(value: unknown): Raw[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as Raw[]) : [];
}

export function sanitizePlayer(raw: Raw): Player {
  const handle = String(raw.handle ?? '');
  return {
    handle,
    name: typeof raw.name === 'string' && raw.name ? raw.name : handle,
    image: typeof raw.image === 'string' ? raw.image : null,
  };
}

export function sanitizeOverview(raw: Raw): FriendsOverview {
  return {
    friends: list(raw.friends).map((friend) => ({
      ...sanitizePlayer(friend),
      since: time(friend.since),
      online: friend.online === true,
      playing: friend.playing === true,
      watch: typeof friend.watch === 'string' && friend.watch ? friend.watch : null,
    })),
    incoming: list(raw.incoming).map((r) => ({ ...sanitizePlayer(r), sentAt: time(r.sent_at) })),
    outgoing: list(raw.outgoing).map((r) => ({ ...sanitizePlayer(r), sentAt: time(r.sent_at) })),
    invitations: list(raw.invitations)
      .filter((i) => typeof i.room_id === 'string' && i.room_id)
      .map((i) => ({
        roomId: i.room_id as string,
        roomName: typeof i.room_name === 'string' && i.room_name ? i.room_name : (i.room_id as string),
        from: sanitizePlayer(i.from && typeof i.from === 'object' ? (i.from as Raw) : {}),
        sentAt: time(i.sent_at),
        seatsTaken: count(i.seats_taken),
        seats: count(i.seats),
      })),
  };
}

export function sanitizeSearch(raw: Raw): SearchResult[] {
  return list(raw.players).map((p) => ({
    ...sanitizePlayer(p),
    relationship: RELATIONSHIPS.includes(p.relationship as Relationship) ? (p.relationship as Relationship) : 'none',
  }));
}

// A refusal (4xx) carries a message written for players; anything else is the usual failure.
async function refusedOr<T>(response: Response, fallback: string): Promise<T | null> {
  if (response.status >= 400 && response.status < 500) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    throw new ApiError('refused', typeof body?.message === 'string' ? body.message : fallback, response.status);
  }
  return readJson<T>(response);
}

async function send(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<Response> {
  return request(path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}

/** GET /friends/list: friends, requests both ways and invitations to tables. */
export async function getFriends(): Promise<FriendsOverview> {
  const body = await refusedOr<Raw>(await request('/friends/list'), "We couldn't load your friends.");
  if (!body) throw new ApiError('unexpected', UNREADABLE_RESPONSE);
  return sanitizeOverview(body);
}

/** At least this many letters before a search is sent. */
export const SEARCH_MIN_LENGTH = 2;

/** GET /friends/search: up to 10 players by handle or name. */
export async function searchPlayers(query: string): Promise<SearchResult[]> {
  const body = await refusedOr<Raw>(await request(`/friends/search?${new URLSearchParams({ q: query })}`), "We couldn't search just now.");
  if (!body) throw new ApiError('unexpected', UNREADABLE_RESPONSE);
  return sanitizeSearch(body);
}

/** POST /friends/requests: asks them; resolves to 'friends' when they had already asked you (which accepts it). */
export async function sendFriendRequest(handle: string): Promise<'outgoing' | 'friends'> {
  const body = await refusedOr<Raw>(await send('/friends/requests', 'POST', { handle }), "We couldn't send that request.");
  return body?.relationship === 'friends' ? 'friends' : 'outgoing';
}

export async function acceptFriendRequest(handle: string): Promise<void> {
  await refusedOr(await send(`/friends/requests/${encodeURIComponent(handle)}/accept`, 'POST'), "We couldn't accept that request.");
}

/** Declines their request, or takes back yours. */
export async function deleteFriendRequest(handle: string): Promise<void> {
  await refusedOr(await send(`/friends/requests/${encodeURIComponent(handle)}`, 'DELETE'), "We couldn't remove that request.");
}

export async function removeFriend(handle: string): Promise<void> {
  await refusedOr(await send(`/friends/${encodeURIComponent(handle)}`, 'DELETE'), "We couldn't remove that friend.");
}

export async function dismissInvitation(roomId: string): Promise<void> {
  await refusedOr(await send(`/friends/invitations/${encodeURIComponent(roomId)}`, 'DELETE'), "We couldn't dismiss that invitation.");
}

/** POST /room/:id/invite: asks a friend to this table. */
export async function inviteToTable(roomId: string, handle: string): Promise<void> {
  await refusedOr(await send(`/room/${encodeURIComponent(roomId)}/invite`, 'POST', { handle }), "We couldn't send that invitation.");
}
