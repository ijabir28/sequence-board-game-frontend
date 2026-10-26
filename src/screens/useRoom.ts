import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/http';
import { getRoom, roomUpdate, type Room } from '../api/rooms';
import { onConnectionChange, onRoomUpdated, type ConnectionState } from '../api/socket';

export type RoomState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; room: Room };

// Rooms are small: comparing them saves re-rendering the page when the same room arrives twice (the host's own answer,
// then the broadcast of it).
function sameRoom(a: Room, b: Room): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Loads a room and keeps it fresh from `room_updated` broadcasts, which carry the room: other tables' are ignored, and
 * only a broadcast without the room (an older backend, or the table deleted) makes it fetch.
 */
export function useRoom(id: string) {
  const [state, setState] = useState<RoomState>({ status: 'loading' });
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    try {
      const room = await getRoom(id);
      if (request !== latest.current) return null;
      setState(room ? { status: 'ready', room } : { status: 'not-found' });
      return room;
    } catch (e) {
      if (request !== latest.current) return null;
      // Keep showing the last good room if a background refresh fails.
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: errorMessage(e) }));
      return null;
    }
  }, [id]);

  // Shows a room the server just sent (an action's answer, or a broadcast). A fetch already under way read the room
  // before it, so its answer is dropped.
  const applyRoom = useCallback((room: Room) => {
    latest.current += 1;
    setState((prev) => (prev.status === 'ready' && sameRoom(prev.room, room) ? prev : { status: 'ready', room }));
  }, []);

  useEffect(() => {
    setState({ status: 'loading' });
    void reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offUpdate = onRoomUpdated((data) => {
      const update = roomUpdate(id, data);
      if (update === 'other') return;
      clearTimeout(timer);
      if (typeof update === 'object') return applyRoom(update);
      // Debounce bursts of these and fetch ours.
      timer = setTimeout(() => void reload(), 150);
    });
    const offConnection = onConnectionChange((next) => {
      setConnection(next);
      if (next === 'live') void reload(); // catch up on anything missed while offline
    });
    return () => {
      clearTimeout(timer);
      offUpdate();
      offConnection();
    };
  }, [id, reload, applyRoom]);

  return { state, connection, reload, applyRoom };
}
