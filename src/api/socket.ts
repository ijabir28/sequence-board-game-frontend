import io from 'socket.io-client';

// socket.io-client 2.x to match the backend's socket.io 2.3.0. The socket connects to the
// page's own origin; the Vite proxy forwards /socket.io (including websockets) to :3000.

let socket: SocketIOClient.Socket | null = null;

/*
 * The socket only stays open while it is any use, to save the battery (a websocket's heartbeat, and the reconnect
 * loop, keep a phone's radio awake):
 * - A hidden page (another tab or app, a locked phone) tells the server at once (`set_away`), so friends see the
 *   player away, and after IDLE_MS lets the socket go; the server keeps them away a while longer. Coming back opens it
 *   again, and the pages listening for `connect` catch up and announce themselves again. Their game already counts
 *   them away while hidden (useAwayWhileHidden).
 * - While the device says it is offline, it stops trying to reconnect; it tries again once the device is back.
 * - A page that must hear the server while hidden (waiting in the Quick Match queue) holds it open (holdSocketOpen).
 * Reconnecting backs off to RECONNECT_DELAY_MAX_MS between tries rather than socket.io's 5 s.
 */
const IDLE_MS = 60_000;
const RECONNECT_DELAY_MAX_MS = 30_000;

/** Why the socket was let go on purpose, if it was: then it stays closed until that is over. */
let resting: 'idle' | 'offline' | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let holds = 0;

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function rest(reason: 'idle' | 'offline') {
  clearTimeout(idleTimer);
  idleTimer = undefined;
  if (!socket || resting === 'offline') return;
  resting = reason;
  // disconnect() also stops a reconnect loop in progress.
  socket.disconnect();
}

function wake() {
  clearTimeout(idleTimer);
  idleTimer = undefined;
  if (!socket || resting === null) return;
  resting = null;
  socket.connect();
}

/** Tells the server whether this page is hidden, so friends see the player away (or back). */
function sayAway() {
  if (socket?.connected) socket.emit('set_away', { away: hidden() });
}

function followVisibility() {
  if (!hidden()) {
    if (resting === 'idle') wake();
    else clearTimeout(idleTimer);
    return;
  }
  if (holds > 0 || resting !== null || idleTimer !== undefined) return;
  idleTimer = setTimeout(() => {
    idleTimer = undefined;
    if (hidden() && holds === 0) rest('idle');
  }, IDLE_MS);
}

function followNetwork() {
  if (typeof navigator === 'undefined') return;
  if (!navigator.onLine) rest('offline');
  else if (resting === 'offline') {
    resting = 'idle';
    if (hidden() && holds === 0) followVisibility();
    else wake();
  }
}

export function getSocket(): SocketIOClient.Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], reconnectionDelayMax: RECONNECT_DELAY_MAX_MS });
    if (typeof window !== 'undefined') {
      // Every new connection starts out in view on the server; a hidden page says otherwise.
      socket.on('connect', () => {
        if (hidden()) sayAway();
      });
      document.addEventListener('visibilitychange', () => {
        sayAway();
        followVisibility();
      });
      window.addEventListener('online', followNetwork);
      window.addEventListener('offline', followNetwork);
      followVisibility();
      followNetwork();
    }
  }
  return socket;
}

/**
 * Keeps the socket open while the page is hidden, until the returned function is called; it reopens at once if it
 * had been let go. For a page waiting on a server message the player wants even from another tab.
 */
export function holdSocketOpen(): () => void {
  getSocket();
  holds += 1;
  if (resting === 'idle') wake();
  clearTimeout(idleTimer);
  idleTimer = undefined;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holds -= 1;
    followVisibility();
  };
}

/**
 * Sends `event` only if the socket is open now. socket.io queues what is sent while disconnected and sends it after
 * the next `connect`, after the pages have announced themselves again, so a queued `leave_game` would undo a fresh
 * `join_game`. Leaving needs no message once disconnected: the server forgets a closed socket by itself.
 */
function emitNow(s: SocketIOClient.Socket, event: string, data: unknown) {
  if (s.connected) s.emit(event, data);
}

/**
 * `room_updated` is broadcast to every connected client. We pass no payload on: listeners
 * re-fetch their own room.
 */
export function onRoomUpdated(listener: () => void): () => void {
  const s = getSocket();
  const handler = () => listener();
  s.on('room_updated', handler);
  return () => {
    s.off('room_updated', handler);
  };
}

/** `game_updated` carries only the room id; listeners re-fetch the game for their own view. */
export function onGameUpdated(roomId: string, listener: () => void): () => void {
  const s = getSocket();
  const handler = (data?: { room_id?: string }) => {
    if (data?.room_id === roomId) listener();
  };
  s.on('game_updated', handler);
  return () => {
    s.off('game_updated', handler);
  };
}

/** `teams_shuffled`: the host dealt the seated players out again. Carries the host and the new seating. */
export interface TeamsShuffled {
  roomId: string;
  byName: string;
  /** The room as the server sent it (raw); pass it to sanitizeRoom. */
  room: unknown;
}

export function onTeamsShuffled(roomId: string, listener: (event: TeamsShuffled) => void): () => void {
  const s = getSocket();
  const handler = (data?: { room_id?: string; by?: { name?: string; handle?: string }; room?: unknown }) => {
    if (data?.room_id !== roomId) return;
    listener({ roomId, byName: data.by?.name ?? data.by?.handle ?? 'The host', room: data.room });
  };
  s.on('teams_shuffled', handler);
  return () => {
    s.off('teams_shuffled', handler);
  };
}

/**
 * `signed_in_elsewhere {handle}`: that account just signed in on another device, which signed out its other sessions
 * (one device at a time). Every client hears it; the listener checks its own session before acting on it.
 */
export function onSignedInElsewhere(listener: (handle: string) => void): () => void {
  const s = getSocket();
  const handler = (data?: { handle?: unknown }) => {
    if (typeof data?.handle === 'string') listener(data.handle);
  };
  s.on('signed_in_elsewhere', handler);
  return () => {
    s.off('signed_in_elsewhere', handler);
  };
}

/** `match_found {room_id, players}`: the Quick Match queue seated these players at a new table. */
export function onMatchFound(handle: string, listener: (roomId: string) => void): () => void {
  const s = getSocket();
  const handler = (data?: { room_id?: unknown; players?: unknown }) => {
    if (typeof data?.room_id === 'string' && Array.isArray(data.players) && data.players.includes(handle)) listener(data.room_id);
  };
  s.on('match_found', handler);
  return () => {
    s.off('match_found', handler);
  };
}

export type ConnectionState = 'connecting' | 'live' | 'offline';

export function onConnectionChange(listener: (state: ConnectionState) => void): () => void {
  const s = getSocket();
  const live = () => listener('live');
  const offline = () => listener('offline');
  const connecting = () => listener('connecting');
  listener(s.connected ? 'live' : 'connecting');
  s.on('connect', live);
  s.on('reconnect', live);
  s.on('disconnect', offline);
  s.on('connect_error', offline);
  s.on('reconnecting', connecting);
  return () => {
    s.off('connect', live);
    s.off('reconnect', live);
    s.off('disconnect', offline);
    s.off('connect_error', offline);
    s.off('reconnecting', connecting);
  };
}

/**
 * Tells the server this player has the table's game open (`join_game`), again after every reconnect, until the
 * returned function is called (`leave_game`). While the current player isn't at the table, their turn is paused.
 * `token` is the `presence_token` from the player's own game view.
 */
export function announcePresence(roomId: string, handle: string, token: string): () => void {
  const s = getSocket();
  const join = () => s.emit('join_game', { room_id: roomId, handle, token });
  if (s.connected) join();
  s.on('connect', join);
  return () => {
    s.off('connect', join);
    emitNow(s, 'leave_game', { room_id: roomId });
  };
}

/**
 * Watches a table's game without a seat (`watch_game`), again after every reconnect, until the returned function is
 * called (`unwatch_game`). It only counts the viewer among the table's spectators: the game itself arrives through
 * `game_updated`, like everyone else's.
 */
export function watchGame(roomId: string): () => void {
  const s = getSocket();
  const watch = () => s.emit('watch_game', { room_id: roomId });
  if (s.connected) watch();
  s.on('connect', watch);
  return () => {
    s.off('connect', watch);
    emitNow(s, 'unwatch_game', { room_id: roomId });
  };
}

/** `spectators_updated {room_id, count}`: someone started or stopped watching this table's game. */
export function onSpectatorsUpdated(roomId: string, listener: (count: number) => void): () => void {
  const s = getSocket();
  const handler = (data?: { room_id?: string; count?: unknown }) => {
    if (data?.room_id === roomId && typeof data.count === 'number') listener(data.count);
  };
  s.on('spectators_updated', handler);
  return () => {
    s.off('spectators_updated', handler);
  };
}

/**
 * The server reads who a socket is from the session cookie of its handshake, once, as it connects (that is how
 * friends hear `friends_updated` and `table_invitation`, which go only to their own sockets). After signing in or out
 * the socket connects again, so its handshake carries the new cookie. Listeners stay attached, and the pages that
 * announce themselves on `connect` do so again.
 */
export function reconnectSocket(): void {
  if (!socket) return;
  socket.disconnect();
  // A socket let go on purpose reconnects, with the new cookie, when it wakes.
  if (resting === null) socket.connect();
}

/** `friends_updated`: a friend request, friendship or invitation of yours changed. Re-fetch the friends list. */
export function onFriendsUpdated(listener: () => void): () => void {
  const s = getSocket();
  const handler = () => listener();
  s.on('friends_updated', handler);
  return () => {
    s.off('friends_updated', handler);
  };
}

/** `table_invitation {room_id, room_name, from}`: a friend asked you to their table. */
export interface TableInvitationEvent {
  roomId: string;
  roomName: string;
  fromName: string;
}

export function onTableInvitation(listener: (event: TableInvitationEvent) => void): () => void {
  const s = getSocket();
  const handler = (data?: { room_id?: unknown; room_name?: unknown; from?: { name?: unknown; handle?: unknown } }) => {
    if (typeof data?.room_id !== 'string' || !data.room_id) return;
    const from = typeof data.from?.name === 'string' ? data.from.name : typeof data.from?.handle === 'string' ? data.from.handle : 'A friend';
    listener({ roomId: data.room_id, roomName: typeof data.room_name === 'string' ? data.room_name : data.room_id, fromName: from });
  };
  s.on('table_invitation', handler);
  return () => {
    s.off('table_invitation', handler);
  };
}
