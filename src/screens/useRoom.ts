import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/http';
import { getRoom, type Room } from '../api/rooms';
import { onConnectionChange, onRoomUpdated, type ConnectionState } from '../api/socket';

export type RoomState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; room: Room };

/** Loads a room and keeps it fresh: every `room_updated` broadcast triggers a re-fetch. */
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

  useEffect(() => {
    setState({ status: 'loading' });
    void reload();
    // The broadcast doesn't say which room changed, so debounce bursts and re-fetch ours.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offUpdate = onRoomUpdated(() => {
      clearTimeout(timer);
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
  }, [reload]);

  return { state, connection, reload };
}
