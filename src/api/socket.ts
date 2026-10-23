import io from 'socket.io-client';

// socket.io-client 2.x to match the backend's socket.io 2.3.0. The socket connects to the
// page's own origin; the Vite proxy forwards /socket.io (including websockets) to :3000.

let socket: SocketIOClient.Socket | null = null;

export function getSocket(): SocketIOClient.Socket {
  socket ??= io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  return socket;
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
    s.emit('leave_game', { room_id: roomId });
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
    s.emit('unwatch_game', { room_id: roomId });
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
  socket.connect();
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
