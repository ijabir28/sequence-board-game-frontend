import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { listMyRooms, type MyRoom } from '../api/rooms';
import { Chip } from '../components/Chip';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { teamName } from '../game/teams';
import styles from './Forms.module.css';
import own from './YourTables.module.css';

export type MyRoomsState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rooms: MyRoom[] };

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

/** Games in progress where the user has a seat: the ones worth resuming first. */
export function resumableTables(rooms: MyRoom[]): MyRoom[] {
  return rooms.filter((room) => room.status === 'playing' && room.yourTeam !== null);
}

/** Loads the signed-in user's tables (GET /user/rooms). */
export function useMyRooms() {
  const [state, setState] = useState<MyRoomsState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', rooms: await listMyRooms() });
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}

/** A call to action for games in progress, so a player who left (or whose server restarted) can jump back in. */
export function ResumeBanner({ state }: { state: MyRoomsState }) {
  if (state.status !== 'ready') return null;
  const games = resumableTables(state.rooms);
  if (games.length === 0) return null;
  return (
    <section className={own.resume} aria-label="Games in progress">
      {games.slice(0, 3).map((room) => (
        <div key={room.id} className={own.resumeRow}>
          <span className={own.chip} aria-hidden="true">
            {room.yourTeam !== null && <Chip team={room.yourTeam} />}
          </span>
          <span className={own.details}>
            <span className={own.code}>Your game at {room.name} is in progress</span>
            <span className={own.meta}>{describeTable(room)}</span>
          </span>
          <Link className={own.resumeLink} to={`/table/${room.id}/game`}>
            Resume
          </Link>
        </div>
      ))}
    </section>
  );
}

/** The signed-in user's tables, newest first, so they can go back to a game (even after a server restart). */
export function YourTables({ state, reload }: { state: MyRoomsState; reload: () => Promise<void> }) {
  return (
    <section className={[styles.card, own.card].join(' ')} aria-labelledby="your-tables">
      <header className={styles.header}>
        <h2 id="your-tables">Your tables</h2>
        <p>Tables you opened or sat at. Games in progress are saved, so you can come back to them any time.</p>
      </header>

      {state.status === 'loading' && (
        <p className={styles.help} role="status">
          Loading your tables…
        </p>
      )}

      {state.status === 'error' && (
        <div className={own.problem}>
          <p className={styles.error} role="alert">
            <Icon name="alert" size={18} />
            <span>{state.message}</span>
          </p>
          <Button size="sm" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      )}

      {state.status === 'ready' && state.rooms.length === 0 && (
        <p className={styles.help}>No tables yet. Tables you open or join will show up here.</p>
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
              >
                {room.status === 'playing' ? 'Resume' : room.status === 'finished' ? 'View' : 'Open'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
