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
