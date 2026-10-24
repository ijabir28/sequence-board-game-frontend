import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { getCurrentGame, listMyRooms, type MyRoom, type MyRoomsPage } from '../api/rooms';
import { Chip } from '../components/Chip';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import { Pager } from '../components/ui/Pager';
import { tipProps } from '../components/ui/TooltipLayer';
import { teamName } from '../game/teams';
import styles from './Forms.module.css';
import own from './YourTables.module.css';

export type MyRoomsState = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & MyRoomsPage);

/** One line saying how far a table got, from the viewer's side. */
export function describeTable(room: MyRoom): string {
  const seats = room.teamCount * room.playersPerTeam;
  if (room.status === 'open') return `Waiting for players · ${room.seatsTaken} of ${seats} seats taken`;
  const moves = `${room.moveCount} ${room.moveCount === 1 ? 'move' : 'moves'}`;
  if (room.status === 'playing') return `In progress · ${moves}`;
  if (room.winnerTeam === null) return `Finished · ${moves}`;
  if (room.yourTeam === room.winnerTeam) return `You won · ${moves}`;
  return `${teamName(room.winnerTeam)} won · ${moves}`;
}

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Loads one page of the signed-in user's tables (GET /user/rooms) at a time. */
export function useMyRooms(enabled: boolean, perPage = 10) {
  const [state, setState] = useState<MyRoomsState>({ status: 'loading' });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    // Keep the current list on screen while the next page loads, so the dialog doesn't jump.
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    try {
      const result = await listMyRooms(page, perPage);
      // The list shrank (or a stale page was asked for): show the last page that exists.
      if (result.rooms.length === 0 && page > result.pages) return setPage(result.pages);
      setState({ status: 'ready', ...result });
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e) });
    }
  }, [page, perPage]);

  // Loads when enabled (each time a dialog opens, so the list is fresh), not before.
  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { state, page, setPage, reload: load };
}

/**
 * The one game worth resuming: the game in progress you sat at that moved last. Nothing while loading, without
 * one, or if it can't be loaded (the full list is one button away).
 */
export function CurrentGame() {
  const [room, setRoom] = useState<MyRoom | null>(null);

  useEffect(() => {
    let current = true;
    getCurrentGame()
      .then((found) => current && setRoom(found))
      .catch(() => current && setRoom(null));
    return () => {
      current = false;
    };
  }, []);

  if (!room) return null;
  return (
    <section className={own.resume} aria-labelledby="current-game">
      <span className={own.resumeChip} aria-hidden="true">
        {room.yourTeam !== null && <Chip team={room.yourTeam} />}
      </span>
      <span className={own.details}>
        <span className={own.eyebrow}>Game in progress</span>
        <span className={own.resumeName} id="current-game">
          {room.name}
        </span>
        <span className={own.meta}>
          {describeTable(room)}
          {room.yourTeam !== null && <> · you play for {teamName(room.yourTeam)}</>}
        </span>
      </span>
      <Link
        className={own.resumeLink}
        to={`/table/${room.id}/game`}
        aria-label={`Resume ${room.name}`}
        {...tipProps('Go back to this game where it left off', 'bottom', 'end')}
      >
        Resume
      </Link>
    </section>
  );
}

/** All the signed-in user's tables, newest first and a page at a time, so they can go back to any game. */
export function YourTablesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setPage, reload } = useMyRooms(open);
  return (
    <Dialog open={open} title="Your rooms" onClose={onClose} size="wide">
      <div className={own.dialogBody}>
        <p className={styles.help}>Rooms you opened or sat in. Games in progress are saved, so you can come back to them any time.</p>
        {state.status === 'loading' && (
          <p className={styles.help} role="status">
            Loading your rooms…
          </p>
        )}

        {state.status === 'error' && (
          <div className={own.problem}>
            <p className={styles.error} role="alert">
              <Icon name="alert" size={18} />
              <span>{state.message}</span>
            </p>
            <Button size="sm" onClick={() => void reload()} tip="Load your rooms again">
              Try again
            </Button>
          </div>
        )}

        {state.status === 'ready' && state.rooms.length === 0 && (
          <p className={styles.help}>No rooms yet. Rooms you open or join will show up here.</p>
        )}

        {state.status === 'ready' && state.rooms.length > 0 && (
          <ul className={own.list}>
            {state.rooms.map((room) => (
              <li key={room.id} className={own.row}>
                <span className={own.chip} aria-hidden="true">
                  {room.yourTeam !== null && <Chip team={room.yourTeam} />}
                </span>
                <span className={own.details}>
                  <span className={own.code}>{room.name}</span>
                  <span className={own.meta}>
                    {describeTable(room)}
                    <span aria-hidden="true"> · </span>
                    <time dateTime={room.createdAt}>{DATE.format(new Date(room.createdAt))}</time>
                    <span aria-hidden="true"> · </span>
                    <span className={own.slug}>{room.id}</span>
                    {room.yourTeam !== null && <span className={own.visuallyHidden}>, you play for {teamName(room.yourTeam)}</span>}
                  </span>
                </span>
                <Link
                  className={own.open}
                  to={room.status === 'open' ? `/table/${room.id}` : `/table/${room.id}/game`}
                  aria-label={`${room.status === 'playing' ? 'Resume' : 'Open'} ${room.name}`}
                  {...tipProps(
                    room.status === 'playing'
                      ? 'Go back to this game where it left off'
                      : room.status === 'finished'
                        ? 'See how this game ended'
                        : 'Open the room to take a seat or change its options',
                    'bottom',
                    'end',
                  )}
                >
                  {room.status === 'playing' ? 'Resume' : room.status === 'finished' ? 'View' : 'Open'}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {state.status === 'ready' && <Pager page={state.page} pages={state.pages} label="your rooms" onPage={setPage} />}
      </div>
    </Dialog>
  );
}
