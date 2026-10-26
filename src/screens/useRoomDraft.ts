import { useCallback, useEffect, useRef, useState } from 'react';
import { resizeRoom, type Room, type RoomChanges, type RoomSettings } from '../api/rooms';

/** How long the host's option changes wait for another before they are sent together. */
export const ROOM_DRAFT_DELAY_MS = 300;

export function mergeChanges(a: RoomChanges, b: RoomChanges): RoomChanges {
  const merged: RoomChanges = { ...a, ...b };
  if (a.settings || b.settings) merged.settings = { ...a.settings, ...b.settings };
  return merged;
}

/** `pending` without what `sent` saved, unless the host changed it again since. */
export function settleChanges(pending: RoomChanges, sent: RoomChanges): RoomChanges {
  const rest: RoomChanges = { ...pending };
  if (sent.name !== undefined && rest.name === sent.name) delete rest.name;
  if (sent.size && rest.size && rest.size.teamCount === sent.size.teamCount && rest.size.playersPerTeam === sent.size.playersPerTeam) delete rest.size;
  if (sent.settings && rest.settings) {
    const settings = { ...rest.settings };
    for (const key of Object.keys(sent.settings) as (keyof RoomSettings)[]) if (settings[key] === sent.settings[key]) delete settings[key];
    if (Object.keys(settings).length > 0) rest.settings = settings;
    else delete rest.settings;
  }
  return rest;
}

function isEmpty(changes: RoomChanges): boolean {
  return changes.name === undefined && changes.size === undefined && Object.keys(changes.settings ?? {}).length === 0;
}

/** The room with the host's unsaved changes on it. The same room comes back when nothing is pending. */
export function previewRoom(room: Room, pending: RoomChanges): Room {
  let shown = room;
  if (pending.size) shown = resizeRoom(shown, pending.size);
  if (pending.settings && Object.keys(pending.settings).length > 0) shown = { ...shown, settings: { ...shown.settings, ...pending.settings } };
  if (pending.name !== undefined) shown = { ...shown, name: pending.name };
  return shown;
}

/**
 * The host's table options as they change them: each change shows at once (`pending`, for previewRoom) and is sent
 * once the host pauses for `delayMs`, merged with the others into one request. One request is in flight at a time, so
 * a burst of clicks is at most two round trips and the server sees them in order. Whatever is queued when the page
 * closes is still sent.
 */
export function useRoomDraft(send: (changes: RoomChanges) => Promise<unknown>, delayMs = ROOM_DRAFT_DELAY_MS) {
  const [pending, setPending] = useState<RoomChanges>({});
  const queued = useRef<RoomChanges>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;

  const flush = useCallback(async () => {
    timer.current = undefined;
    if (inFlight.current || isEmpty(queued.current)) return;
    const batch = queued.current;
    queued.current = {};
    inFlight.current = true;
    try {
      // On failure the sender says so and reloads; the preview falls back to the room as saved.
      await sendRef.current(batch);
    } catch {
      // The sender reports its own errors.
    } finally {
      inFlight.current = false;
      setPending((p) => settleChanges(p, batch));
      if (timer.current === undefined && !isEmpty(queued.current)) void flush();
    }
  }, []);

  const change = useCallback(
    (changes: RoomChanges) => {
      setPending((p) => mergeChanges(p, changes));
      queued.current = mergeChanges(queued.current, changes);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  useEffect(
    () => () => {
      if (timer.current === undefined) return;
      clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  return { pending, change };
}
