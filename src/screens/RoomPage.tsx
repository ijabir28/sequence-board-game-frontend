import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { startRoomGame } from '../api/roomGame';
import {
  declineRejoin,
  enterRoom,
  getRejoinStatus,
  isFull,
  isSeated,
  joinRoom,
  kickPlayer,
  leaveSeat,
  listRemoved,
  readmitPlayer,
  requestRejoin,
  sanitizeRoom,
  seatPlayer,
  shuffleSeats,
  uninvitePlayer,
  unseatPlayer,
  updateRoom,
  type RejoinStatus,
  type RemovedPlayer,
  type Room,
  type RoomSettings,
  type RoomTeam,
  type Seat,
  watchLink,
} from '../api/rooms';
import { onRejoinAnswered, onRejoinRequested, onRemovedFromTable, onTeamsShuffled } from '../api/socket';
import { Dialog } from '../components/ui/Dialog';
import { useAuth } from '../auth/AuthContext';
import { copyText } from '../copyText';
import { AppHeader } from '../components/AppHeader';
import { PoweredBy } from '../components/PoweredBy';
import { BackToDashboard } from '../components/BackToDashboard';
import { Chip } from '../components/Chip';
import { useToast, type ToastOptions } from '../components/toast/Toaster';
import { RoomOptions } from '../components/RoomOptions';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Select } from '../components/ui/Select';
import { Tooltip } from '../components/ui/Tooltip';
import { tipProps } from '../components/ui/TooltipLayer';
import { isSupportedTable, sequencesToWin } from '../engine/setup';
import { describeShuffle } from '../game/teamNotice';
import { TEAM_STYLES } from '../game/teams';
import { useMediaQuery } from '../game/useMediaQuery';
import styles from './Forms.module.css';
import own from './RoomPage.module.css';
import { InviteFriendsDialog } from './InviteFriendsDialog';
import { TableChat } from '../chat/TableChat';
import { useRoom } from './useRoom';

/** What the host can do to a player at their table before the game starts. */
export type HostAction =
  | { kind: 'seat'; player: Seat; team: RoomTeam; seat: number }
  | { kind: 'unseat'; player: Seat }
  | { kind: 'kick'; player: Seat }
  | { kind: 'uninvite'; player: Seat }
  | { kind: 'readmit'; player: Seat }
  | { kind: 'decline'; player: Seat };

/** The table's messages share one toast, so the latest replaces the one before. */
const NOTICE_TOAST = 'room-notice';
/** A reshuffle tells you your new team, which takes a little longer to read. */
const SHUFFLE_NOTICE_MS = 7000;

export function RoomPage() {
  const { id = '' } = useParams();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { state, connection, reload } = useRoom(id);
  const [joining, setJoining] = useState<string | null>(null);
  const toast = useToast();
  const showSuccess = (text: string, durationMs?: number) => toast.success(text, { id: NOTICE_TOAST, durationMs });
  const showError = (text: string, options: ToastOptions = {}) => toast.error(text, { id: NOTICE_TOAST, ...options });
  const clearNotice = () => toast.dismiss(NOTICE_TOAST);
  const signInAgain = () => {
    // Navigate only once signed out, or /signin would send the stale profile straight back.
    void signOut().finally(() => navigate('/signin', { state: { from: `/table/${id}` } }));
  };

  // When the host reshuffles, every player is told their new team, replacing whatever notice was showing.
  const you = profile?.handle ?? null;
  useEffect(
    () =>
      onTeamsShuffled(id, (event) => {
        const shuffled = sanitizeRoom(id, event.room as Parameters<typeof sanitizeRoom>[1]);
        showSuccess(describeShuffle(shuffled, event.byName, you), SHUFFLE_NOTICE_MS);
        void reload();
      }),
    [id, you, reload],
  );
  // Whether the host removed you, and your request to come back. Friends or not, you can ask once.
  const [rejoin, setRejoin] = useState<RejoinStatus>({ removed: false, requested: false, declined: false });
  const [asking, setAsking] = useState(false);
  const loadRejoin = useCallback(() => {
    if (you === null) return;
    getRejoinStatus(id)
      .then(setRejoin)
      .catch(() => undefined);
  }, [id, you]);
  useEffect(loadRejoin, [loadRejoin]);
  // Opening the table puts you at it (and in Your tables) before its game starts, once per visit.
  const entered = useRef<string | null>(null);
  const openRoom = state.status === 'ready' ? state.room : null;
  useEffect(() => {
    if (you === null || openRoom === null || openRoom.gameStarted || entered.current === `${id}:${you}`) return;
    entered.current = `${id}:${you}`;
    void enterRoom(id).then(({ removed }) => {
      if (removed) loadRejoin();
    });
  }, [id, you, openRoom, loadRejoin]);
  // The host sent you away: you stay here, and can ask to come back.
  useEffect(
    () =>
      onRemovedFromTable(id, () => {
        toast.error('The host removed you from this table. You can ask them to let you back in.', { id: NOTICE_TOAST, durationMs: null });
        loadRejoin();
        void reload();
      }),
    [id, loadRejoin, reload],
  );
  useEffect(
    () =>
      onRejoinAnswered(id, (answer) => {
        if (answer === 'readmitted') toast.success('The host let you back in. Pick a team to sit down.', { id: NOTICE_TOAST });
        else toast.error('The host said no to your request to rejoin this table.', { id: NOTICE_TOAST });
        loadRejoin();
        void reload();
      }),
    [id, loadRejoin, reload],
  );
  const askRejoin = async () => {
    setAsking(true);
    clearNotice();
    try {
      setRejoin(await requestRejoin(id));
      showSuccess('Your request was sent. You can sit down once the host lets you back in.');
    } catch (e) {
      showError(errorMessage(e));
      loadRejoin();
    } finally {
      setAsking(false);
    }
  };

  // The host's list of players they removed, with anyone asking to come back.
  const [removedPlayers, setRemovedPlayers] = useState<RemovedPlayer[]>([]);
  const readyRoom = state.status === 'ready' ? state.room : null;
  const hosting = readyRoom !== null && you !== null && readyRoom.administrator === you && !readyRoom.gameStarted;
  const loadRemoved = useCallback(() => {
    if (!hosting) return setRemovedPlayers([]);
    listRemoved(id)
      .then(setRemovedPlayers)
      .catch(() => undefined);
  }, [id, hosting]);
  // Every change at the table (a kick, a readmit) comes with a fresh room.
  useEffect(loadRemoved, [loadRemoved, readyRoom]);
  useEffect(
    () =>
      onRejoinRequested(id, (name) => {
        toast.success(`${name} asks to rejoin this table. Let them back in from Removed players.`, { id: NOTICE_TOAST, durationMs: null });
        loadRemoved();
      }),
    [id, loadRemoved],
  );
  const [hostBusy, setHostBusy] = useState<string | null>(null);

  // The host's seating: each answers with the room, and the broadcast refreshes everyone else.
  const runHostAction = async (action: HostAction) => {
    setHostBusy(`${action.kind}:${action.player.handle}`);
    clearNotice();
    const team = action.kind === 'seat' ? (TEAM_STYLES[action.team.index]?.name ?? action.team.handle) : '';
    try {
      if (action.kind === 'seat') await seatPlayer(id, action.player.handle, action.team, action.seat);
      else if (action.kind === 'unseat') await unseatPlayer(id, action.player.handle);
      else if (action.kind === 'kick') await kickPlayer(id, action.player.handle);
      else if (action.kind === 'readmit') await readmitPlayer(id, action.player.handle);
      else if (action.kind === 'decline') await declineRejoin(id, action.player.handle);
      else await uninvitePlayer(id, action.player.handle);
      await reload();
      loadRemoved();
      const who = action.player.handle === you ? 'You' : action.player.name;
      showSuccess(
        action.kind === 'seat'
          ? `${who} now ${who === 'You' ? 'sit' : 'sits'} on Team ${team}.`
          : action.kind === 'unseat'
            ? `${who} stood up, and can be seated again.`
            : action.kind === 'kick'
              ? `${who} was removed from this table.`
              : action.kind === 'readmit'
                ? `${who} is back at the table. Seat them, or they can pick a team.`
                : action.kind === 'decline'
                  ? `You said no to ${who}'s request to rejoin.`
                  : `${who}'s invitation was taken back.`,
      );
    } catch (e) {
      showError(errorMessage(e));
      void reload();
    } finally {
      setHostBusy(null);
    }
  };
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seatAction, setSeatAction] = useState<'leave' | 'shuffle' | null>(null);

  // Stand up, or (host) shuffle the teams. Both answer with the room, which the broadcast refreshes too.
  const changeSeats = async (action: 'leave' | 'shuffle') => {
    setSeatAction(action);
    clearNotice();
    try {
      const updated = await (action === 'leave' ? leaveSeat(id) : shuffleSeats(id));
      await reload();
      // The teams_shuffled broadcast says the same to everyone; this covers a host whose socket is offline.
      if (action === 'leave') showSuccess('You stood up. Pick a team to sit down again.');
      else showSuccess(describeShuffle(updated, profile?.name ?? 'You', you), SHUFFLE_NOTICE_MS);
    } catch (e) {
      showError(errorMessage(e));
      void reload();
    } finally {
      setSeatAction(null);
    }
  };

  // Seated players go straight to the game when someone starts it, wherever they are on this page.
  const room = state.status === 'ready' ? state.room : null;
  const wasStarted = useRef<boolean | null>(null);
  useEffect(() => {
    if (!room) return;
    const seated = profile !== null && profile !== undefined && isSeated(room, profile.handle);
    if (wasStarted.current === false && room.gameStarted && seated) navigate(`/table/${id}/game`);
    wasStarted.current = room.gameStarted;
  }, [room, profile, id, navigate]);

  const save = async (changes: { name?: string; settings?: RoomSettings }) => {
    setSaving(true);
    clearNotice();
    try {
      await updateRoom(id, changes);
      await reload();
      return true;
    } catch (e) {
      showError(errorMessage(e));
      void reload();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const start = async () => {
    setStarting(true);
    clearNotice();
    try {
      await startRoomGame(id);
      navigate(`/table/${id}/game`);
    } catch (e) {
      showError(errorMessage(e));
      void reload();
    } finally {
      setStarting(false);
    }
  };

  const join = async (team: RoomTeam) => {
    if (!profile) return;
    const name = TEAM_STYLES[team.index]?.name ?? team.handle;
    setJoining(team.handle);
    clearNotice();
    try {
      const result = await joinRoom(id, team.handle);
      if (result === 'seat-taken') {
        showError(`Team ${name} is full. Pick a team with an open seat.`);
      } else if (result === 'already-seated') {
        showError('You already have a seat at this table. Each player takes one seat.');
      } else if (result === 'game-started') {
        showError("This table's game has already started, so its seats are fixed.");
        void reload();
      } else if (result === 'signed-out') {
        showError('Your session has ended (sessions expire after a week without play, or when you sign out elsewhere). Sign in again, then join.', {
          durationMs: null,
          action: { label: 'Sign in again', onClick: signInAgain },
        });
      } else if (result === 'removed') {
        showError('The host removed you from this table. Ask them to let you back in.');
        loadRejoin();
      } else if (result === 'not-found') {
        showError("We couldn't find a table with this code. Go back to the lobby and open a new one.");
      } else {
        await reload();
        showSuccess(`You joined Team ${name}.`);
      }
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setJoining(null);
    }
  };

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <BackToDashboard tip="Go back to the dashboard. Your seat here is kept." />
        {state.status === 'loading' && (
          <div className={own.state} role="status">
            <span className={own.spinner} aria-hidden="true" />
            Loading table {id}…
          </div>
        )}
        {state.status === 'not-found' && (
          <div className={[styles.card, own.state].join(' ')}>
            <h1>Table not found</h1>
            <p>
              There is no table with code {id}. Check that the code is typed correctly. Tables whose game never started are cleared
              after a day with nobody sitting down.
            </p>
            <Link to="/lobby" className={own.linkButton} {...tipProps('Go back to the dashboard to try another code')}>
              Back to the lobby
            </Link>
          </div>
        )}
        {state.status === 'error' && (
          <div className={[styles.card, own.state].join(' ')} role="alert">
            <Icon name="wifiOff" size={28} />
            <h1>Can't load this table</h1>
            <p>{state.message}</p>
            <Button variant="primary" onClick={() => reload()} tip="Load this table again">
              <Icon name="refresh" size={16} />
              Try again
            </Button>
          </div>
        )}
        {state.status === 'ready' && (
          <RoomView
            room={state.room}
            you={profile?.handle ?? null}
            connection={connection}
            joining={joining}
            onJoin={join}
            starting={starting}
            onStart={start}
            saving={saving}
            onSave={save}
            seatAction={seatAction}
            onSeats={changeSeats}
            hostBusy={hostBusy}
            onHost={runHostAction}
            rejoin={rejoin}
            asking={asking}
            onAskRejoin={askRejoin}
            removedPlayers={removedPlayers}
            onOpenGame={() => navigate(`/table/${id}/game`)}
          />
        )}
        <PoweredBy />
      </div>
      {state.status === 'ready' && <TableChat roomId={id} you={you} />}
    </>
  );
}

interface RoomViewProps {
  room: Room;
  you: string | null;
  connection: 'connecting' | 'live' | 'offline';
  joining: string | null;
  onJoin: (team: RoomTeam) => void;
  starting: boolean;
  onStart: () => void;
  onOpenGame: () => void;
  saving: boolean;
  onSave: (changes: { name?: string; settings?: RoomSettings }) => Promise<boolean>;
  seatAction: 'leave' | 'shuffle' | null;
  onSeats: (action: 'leave' | 'shuffle') => void;
  /** `kind:handle` of the host action in flight, if any. */
  hostBusy: string | null;
  onHost: (action: HostAction) => void;
  /** Whether the host removed you, and your request to come back. */
  rejoin: RejoinStatus;
  asking: boolean;
  onAskRejoin: () => void;
  /** The host's list of players they removed. */
  removedPlayers: RemovedPlayer[];
}

function RoomView({
  room,
  you,
  connection,
  joining,
  onJoin,
  starting,
  onStart,
  onOpenGame,
  saving,
  onSave,
  seatAction,
  onSeats,
  hostBusy,
  onHost,
  rejoin,
  asking,
  onAskRejoin,
  removedPlayers,
}: RoomViewProps) {
  const teamCount = room.teams.length;
  const perTeam = Math.max(0, ...room.teams.map((t) => t.seats.length));
  const supported = isSupportedTable(teamCount, perTeam);
  const seated = you !== null && isSeated(room, you);
  const open = room.teams.reduce((n, t) => n + t.seats.filter((s) => s === null).length, 0);
  const taken = room.teams.reduce((n, t) => n + t.seats.filter(Boolean).length, 0);
  const full = isFull(room);
  const host = you !== null && room.administrator === you;
  // Players are addressed by display name; handles are only for telling people apart.
  const hostName = room.administratorName;
  // Only the host may start, and the server enforces it too.
  const canStart = supported && full && host;
  const editable = host && !room.gameStarted;
  // Phones: the name card and the options fold to their headings. The host opens them by default, since they run
  // the table; everyone else starts with them folded, so the teams and the start card are on the first screen.
  const phone = useMediaQuery('(max-width: 600px)');
  const [summaryOpen, setSummaryOpen] = useState(host);
  const [optionsOpen, setOptionsOpen] = useState(host);
  const summaryId = useId();
  const optionsId = useId();
  const showSummary = !phone || summaryOpen;
  const showOptions = !phone || optionsOpen;
  // Anyone at the table (or its host) can ask friends to its open seats, until the game starts.
  const canInvite = !room.gameStarted && !full && (seated || host);
  const [inviting, setInviting] = useState(false);
  // Not seated yet: whoever came to the table (by invitation, code or link) and has no seat. Invitations nobody has
  // answered are listed apart, since those players haven't come.
  const notSeated = room.standing.filter((player) => !isSeated(room, player.handle));
  // The host can seat anyone who came to the table in an open seat (moving them, if they have one), themself first.
  const seatedPlayers = room.teams.flatMap((t) => t.seats.filter((s): s is Seat => s !== null));
  const candidates: Seat[] =
    editable && you !== null
      ? [
          { handle: you, name: `${room.administratorName ?? 'You'} (You)` },
          ...[...notSeated, ...seatedPlayers].filter((player) => player.handle !== you),
        ]
      : [];
  // Every open seat, for seating a player from their row under Not seated yet.
  const openSeats = room.teams.flatMap((team) =>
    team.seats.flatMap((s, i) => (s === null ? [{ team, seat: i, label: `Team ${TEAM_STYLES[team.index]?.name ?? team.handle}, seat ${i + 1}` }] : [])),
  );
  const [removing, setRemoving] = useState<Seat | null>(null);
  const pendingInvites = room.invited.filter((player) => !isSeated(room, player.handle) && !notSeated.some((p) => p.handle === player.handle));

  return (
    <div className={own.layout}>
      <section className={[styles.card, own.summary].join(' ')}>
        <div className={own.titleRow}>
          <h1>
            {phone ? (
              <FoldToggle open={summaryOpen} controls={summaryId} onToggle={() => setSummaryOpen((o) => !o)}>
                {room.name}
              </FoldToggle>
            ) : (
              room.name
            )}
          </h1>
          <span className={[own.live, own[connection]].join(' ')} role="status">
            <span className={own.dot} aria-hidden="true" />
            {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Connection lost, reconnecting…'}
          </span>
        </div>
        <div id={summaryId} className={own.foldBody} hidden={!showSummary}>
          <p className={styles.help}>
            {teamCount} teams of {perTeam}
            {supported && `. First team to ${sequencesToWin(teamCount)} sequence${sequencesToWin(teamCount) > 1 ? 's' : ''} wins`}.{' '}
            {hostName && <>Opened by {hostName}. </>}
            {open === 0 ? 'Every seat is taken.' : `${open} open seat${open === 1 ? '' : 's'}.`}
          </p>
          <ShareCode id={room.id} gameStarted={room.gameStarted} onInvite={canInvite ? () => setInviting(true) : undefined} />
        </div>
      </section>
      <InviteFriendsDialog open={inviting && canInvite} onClose={() => setInviting(false)} room={room} host={host} />

      {rejoin.removed && !room.gameStarted && (
        <section className={[styles.card, own.around].join(' ')} aria-labelledby="removed-notice" role="status">
          <h2 id="removed-notice">You were removed from this table</h2>
          <p className={styles.help}>
            {rejoin.declined
              ? `${hostName ?? 'The host'} said no to your request to rejoin. They can still let you back in.`
              : rejoin.requested
                ? `You asked to rejoin. You can sit down once ${hostName ?? 'the host'} lets you back in.`
                : `${hostName ?? 'The host'} removed you, so you can't sit down here. You can ask them to let you back in, once.`}
          </p>
          {!rejoin.requested && !rejoin.declined && (
            <div>
              <Button variant="primary" busy={asking} disabled={asking} onClick={onAskRejoin} tip={`Ask ${hostName ?? 'the host'} to let you back to this table`}>
                Ask to rejoin
              </Button>
            </div>
          )}
        </section>
      )}

      {host && !room.gameStarted && taken >= 2 && (
        <div className={own.teamTools}>
          <Tooltip text="Deal everyone who is seated out to the teams at random" align="start">
            <Button size="sm" variant="ghost" busy={seatAction === 'shuffle'} disabled={seatAction !== null} onClick={() => onSeats('shuffle')}>
              <Icon name="shuffle" size={16} />
              Shuffle teams
            </Button>
          </Tooltip>
        </div>
      )}

      <ul className={own.teams} aria-label="Teams">
        {room.teams.map((team) => {
          const style = TEAM_STYLES[team.index];
          const teamFull = team.seats.every((s) => s !== null);
          const name = style?.name ?? team.handle;
          return (
            <li key={team.handle} className={own.team} style={style ? ({ '--team': style.color } as React.CSSProperties) : undefined}>
              <header className={own.teamHeader}>
                {style && (
                  <span className={own.teamChip}>
                    <Chip team={team.index} />
                  </span>
                )}
                <h2>Team {name}</h2>
                <span className={own.count}>
                  {team.seats.filter(Boolean).length}/{team.seats.length}
                </span>
              </header>
              <ol className={own.seats}>
                {team.seats.map((seat, i) => (
                  <li key={i} className={[own.seat, !seat && own.empty].filter(Boolean).join(' ')}>
                    {seat ? (
                      <>
                        <span>
                          {seat.name}
                          {seat.handle === you && <span className={own.you}>You</span>}
                        </span>
                        {editable && seat.handle !== you && (
                          <span className={own.hostTools}>
                            <Button
                              size="sm"
                              variant="ghost"
                              busy={hostBusy === `unseat:${seat.handle}`}
                              disabled={hostBusy !== null}
                              onClick={() => onHost({ kind: 'unseat', player: seat })}
                              aria-label={`Unseat ${seat.name}`}
                              tip={`Take ${seat.name} out of this seat. They stay at the table, and you can seat them again.`}
                              tipAlign="end"
                            >
                              Unseat
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={hostBusy !== null}
                              onClick={() => setRemoving(seat)}
                              className={own.removeButton}
                              aria-label={`Remove ${seat.name} from the table`}
                              tip={`Remove ${seat.name} from the table. They lose their seat and can't sit down again unless you let them back in.`}
                              tipAlign="end"
                            >
                              Remove
                            </Button>
                          </span>
                        )}
                        {seat.handle === you && !room.gameStarted && (
                          <Tooltip text="Free your seat, so you can take another or the host can reshuffle the teams" align="end">
                            <Button
                              size="sm"
                              variant="ghost"
                              busy={seatAction === 'leave'}
                              disabled={seatAction !== null}
                              onClick={() => onSeats('leave')}
                            >
                              Stand up
                            </Button>
                          </Tooltip>
                        )}
                      </>
                    ) : candidates.length > 0 ? (
                      <SeatPicker
                        teamName={name}
                        players={candidates}
                        disabled={hostBusy !== null}
                        onPick={(player) => onHost({ kind: 'seat', player, team, seat: i })}
                      />
                    ) : (
                      'Open seat'
                    )}
                  </li>
                ))}
              </ol>
              <Button
                variant={teamFull || seated ? 'secondary' : 'primary'}
                disabled={teamFull || seated || room.gameStarted || rejoin.removed || joining !== null}
                busy={joining === team.handle}
                onClick={() => onJoin(team)}
                aria-label={teamFull ? `Team ${name} is full` : seated ? `Join Team ${name} (you already have a seat)` : `Join Team ${name}`}
                tip={
                  room.gameStarted
                    ? 'The game has started, so seats are fixed'
                    : rejoin.removed
                      ? 'The host removed you from this table'
                      : teamFull
                      ? `Every seat on Team ${name} is taken`
                      : seated
                        ? 'You already have a seat. Stand up first to change teams.'
                        : `Take an open seat on Team ${name}`
                }
              >
                {teamFull ? 'Team full' : `Join Team ${name}`}
              </Button>
            </li>
          );
        })}
      </ul>
      {!room.gameStarted && notSeated.length > 0 && (
        <section className={[styles.card, own.around].join(' ')} aria-labelledby="around-table">
          <h2 id="around-table">Not seated yet</h2>
          <ul className={own.aroundList}>
            {notSeated.map((player) => (
              <li key={`standing-${player.handle}`} className={own.seat}>
                <span>
                  {player.name}
                  {player.handle === you && <span className={own.you}>You</span>}
                </span>
                {editable && (
                  <span className={own.hostTools}>
                    {openSeats.length > 0 && (
                      <SeatChooser
                        player={player}
                        seats={openSeats}
                        disabled={hostBusy !== null}
                        onPick={(team, seat) => onHost({ kind: 'seat', player, team, seat })}
                      />
                    )}
                    {player.handle !== you ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={hostBusy !== null}
                        onClick={() => setRemoving(player)}
                        className={own.removeButton}
                        aria-label={`Remove ${player.name} from the table`}
                        tip={`Remove ${player.name} from the table. They can't sit down again unless you let them back in.`}
                        tipAlign="end"
                      >
                        Remove
                      </Button>
                    ) : (
                      // You can't remove yourself; an invisible Remove keeps your seat list in line with everyone else's.
                      <Button size="sm" variant="ghost" className={own.placeholder} tabIndex={-1} aria-hidden="true">
                        Remove
                      </Button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className={styles.help}>
            {editable ? 'They came to the table by invitation, code or link. Pick a seat for each, or seat them from an open seat.' : 'They came to the table and are waiting for a seat.'}
          </p>
        </section>
      )}
      {!room.gameStarted && pendingInvites.length > 0 && (
        <section className={[styles.card, own.around].join(' ')} aria-labelledby="invites-sent">
          <h2 id="invites-sent">Invited, not here yet</h2>
          <ul className={own.aroundList}>
            {pendingInvites.map((player) => (
              <li key={`invited-${player.handle}`} className={own.seat}>
                <span>
                  {player.name}
                  {player.handle === you && <span className={own.you}>You</span>}
                </span>
                {editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    busy={hostBusy === `uninvite:${player.handle}`}
                    disabled={hostBusy !== null}
                    onClick={() => onHost({ kind: 'uninvite', player })}
                    tip={`Take back ${player.name}'s invitation to this table`}
                    tipAlign="end"
                  >
                    Cancel invite
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className={styles.help}>They show up under Not seated yet once they open the table.</p>
        </section>
      )}
      {editable && removedPlayers.length > 0 && (
        <section className={[styles.card, own.around].join(' ')} aria-labelledby="removed-players">
          <h2 id="removed-players">Removed players</h2>
          <ul className={own.aroundList}>
            {removedPlayers.map((player) => (
              <li key={player.handle} className={own.seat}>
                <span>
                  {player.name}
                  {player.asking && <span className={own.tag}>Asks to rejoin</span>}
                  {player.declined && <span className={own.tag}>You said no</span>}
                </span>
                <span className={own.hostTools}>
                  {player.asking && (
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={hostBusy === `decline:${player.handle}`}
                      disabled={hostBusy !== null}
                      onClick={() => onHost({ kind: 'decline', player })}
                      tip={`Say no. ${player.name} can't ask again, but you can still let them back in.`}
                      tipAlign="end"
                    >
                      Decline
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={player.asking ? 'primary' : 'ghost'}
                    busy={hostBusy === `readmit:${player.handle}`}
                    disabled={hostBusy !== null}
                    onClick={() => onHost({ kind: 'readmit', player })}
                    tip={`Let ${player.name} back to the table. They don't need to be your friend.`}
                    tipAlign="end"
                  >
                    Let back in
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Dialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? 'player'} from the table?`}
        onClose={() => setRemoving(null)}
        actions={
          <>
            <Button onClick={() => setRemoving(null)} tip="Keep them at the table">
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (removing) onHost({ kind: 'kick', player: removing });
                setRemoving(null);
              }}
              tip="Take their seat away and keep them from sitting down again"
            >
              Remove from table
            </Button>
          </>
        }
      >
        <p className={styles.help}>
          {removing?.name} loses their seat and can't sit down at this table again unless you let them back in. They can ask you to, once.
        </p>
      </Dialog>
      {seated && (
        <p className={styles.help}>
          {room.gameStarted
            ? 'You have a seat at this table.'
            : 'You have a seat at this table. Stand up to change teams; each player takes one seat.'}
        </p>
      )}

      <section className={[styles.card, own.start].join(' ')}>
        <h2>{room.gameStarted ? 'Game in progress' : host ? 'Start the game' : 'Waiting for the host'}</h2>
        {room.gameStarted ? (
          <>
            <p className={styles.help}>{seated ? 'The game has started. Your hand is waiting.' : 'The game has started. You can watch it.'}</p>
            <Button variant="primary" onClick={onOpenGame} tip={seated ? 'Go to the board and your hand' : 'Watch the board. You can’t see anyone’s hand.'}>
              {seated ? 'Open the game' : 'Watch the game'}
            </Button>
          </>
        ) : (
          <>
            <p className={styles.help}>
              {!supported
                ? "This table's size isn't one the rules can deal for, so it can't be played."
                : !full
                  ? 'The game can start once every seat is taken.'
                  : canStart
                    ? 'Every seat is taken. You opened this table, so start the game when everyone is ready.'
                    : `Every seat is taken. Waiting for ${hostName ?? 'the host'} to start the game.`}
            </p>
            {host ? (
              <Button
                variant="primary"
                disabled={!canStart || starting}
                busy={starting}
                onClick={onStart}
                tip={
                  !supported
                    ? "This table's size can't be dealt for, so it can't start"
                    : !full
                      ? 'Every seat must be taken before the game can start'
                      : 'Deal the cards and take everyone to the board'
                }
              >
                Start the game
              </Button>
            ) : (
              <p className={own.waiting} role="status">
                <span className={own.spinner} aria-hidden="true" />
                Only {hostName ?? 'the host'} can start the game. You'll be taken to it when it starts.
              </p>
            )}
          </>
        )}
      </section>

      <section className={[styles.card, own.options].join(' ')} aria-labelledby="table-options">
        <h2 id="table-options">
          {phone ? (
            <FoldToggle open={optionsOpen} controls={optionsId} onToggle={() => setOptionsOpen((o) => !o)}>
              Table options
            </FoldToggle>
          ) : (
            'Table options'
          )}
        </h2>
        {/* Folded with `hidden`, not unmounted, so a half-typed new name survives folding. */}
        <div id={optionsId} className={own.foldBody} hidden={!showOptions}>
          {editable && <RenameTable name={room.name} saving={saving} onSave={(name) => onSave({ name })} />}
          <RoomOptions value={room.settings} onChange={editable ? (settings) => void onSave({ settings }) : undefined} disabled={saving} />
          <p className={styles.help}>
            {room.gameStarted
              ? 'The game has started, so these are fixed.'
              : editable
                ? 'You opened this table, so you can change these until the game starts.'
                : `Only ${hostName ?? 'the host'} can change these, until the game starts.`}
          </p>
        </div>
      </section>
    </div>
  );
}

/** Shown on an open seat before anyone is picked: longer than any display name, so it reads as an empty line. */
const NOBODY_LABEL = '-'.repeat(24);

/** The host's list on an open seat: nobody (the seat stays open), the host, then each player. Picking one seats them. */
function SeatPicker({ teamName, players, disabled, onPick }: { teamName: string; players: Seat[]; disabled: boolean; onPick: (player: Seat) => void }) {
  return (
    <Select
      className={own.seatPicker}
      aria-label={`Seat a player on Team ${teamName}`}
      value=""
      disabled={disabled}
      options={[{ value: '', label: NOBODY_LABEL }, ...players.map((player) => ({ value: player.handle, label: player.name }))]}
      onChange={(handle) => {
        const player = players.find((p) => p.handle === handle);
        if (player) onPick(player);
      }}
    />
  );
}

/** The host's list on a player's row under Not seated yet: picking an open seat seats them there. */
function SeatChooser({
  player,
  seats,
  disabled,
  onPick,
}: {
  player: Seat;
  seats: { team: RoomTeam; seat: number; label: string }[];
  disabled: boolean;
  onPick: (team: RoomTeam, seat: number) => void;
}) {
  return (
    <Select
      className={own.seatChooser}
      aria-label={`Choose a seat for ${player.name}`}
      value=""
      disabled={disabled}
      options={[{ value: '', label: 'Seat…' }, ...seats.map((seat, i) => ({ value: String(i), label: seat.label }))]}
      onChange={(value) => {
        const picked = seats[Number(value)];
        if (picked) onPick(picked.team, picked.seat);
      }}
    />
  );
}

/** A card heading that folds the card's body on phones: the whole heading is the button. */
function FoldToggle({ open, controls, onToggle, children }: { open: boolean; controls: string; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" className={own.foldToggle} aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <span className={own.foldLabel}>{children}</span>
      <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} />
    </button>
  );
}

function RenameTable({ name, saving, onSave }: { name: string; saving: boolean; onSave: (name: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const changed = draft.trim() !== '' && draft.trim() !== name;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changed) void onSave(draft.trim());
  };

  return (
    <form className={own.rename} onSubmit={submit}>
      <label className={own.renameField}>
        <span className={styles.label}>Table name</span>
        <input className={styles.input} value={draft} maxLength={40} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={!changed} busy={saving && changed} tip={changed ? 'Save the new table name' : 'Type a new name first'}>
        Rename
      </Button>
    </form>
  );
}

/**
 * The table's code, with a copy button inside the box. It copies the table's link: pasted under Join a table, the
 * field reads the code out of it (see parseTableCode); pasted anywhere else, it opens the table.
 */
function ShareCode({ id, gameStarted, onInvite }: { id: string; gameStarted: boolean; onInvite?: () => void }) {
  const [copied, setCopied] = useState<'link' | 'watch' | null>(null);
  const [failed, setFailed] = useState(false);
  const link = `${window.location.origin}/table/${id}`;

  const copy = async (what: 'link' | 'watch') => {
    try {
      if (!(await copyText(what === 'watch' ? watchLink(id) : link))) throw new Error('copy refused');
      setCopied(what);
      setFailed(false);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className={own.share}>
      <div className={own.codeField}>
        <label>
          <span className="visually-hidden">Table code</span>
          <input className={styles.input} value={id} readOnly />
        </label>
        <Tooltip text="Copy this table's link. Paste it under Join a table, or send it to friends." align="end">
          <button type="button" className={own.copyIcon} onClick={() => copy('link')} aria-label="Copy table link">
            <Icon name={copied === 'link' ? 'check' : 'copy'} size={18} />
          </button>
        </Tooltip>
      </div>
      {onInvite && (
        <Button size="sm" variant="primary" className={own.inviteButton} onClick={onInvite} aria-label="Invite friends" tip="Send friends a link to one of this table's open seats" tipAlign="end">
          <Icon name="users" size={16} />
          <span>
            Invite<span className={own.inviteWide}> friends</span>
          </span>
        </Button>
      )}
      {gameStarted && (
        <Tooltip text="Copy a link anyone can open to watch the game live, without signing in. They never see a hand." align="end">
          <Button size="sm" onClick={() => copy('watch')}>
            <Icon name={copied === 'watch' ? 'check' : 'eye'} size={16} />
            {copied === 'watch' ? 'Copied' : 'Copy watch link'}
          </Button>
        </Tooltip>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copied ? `${copied === 'watch' ? 'Watch link' : 'Table link'} copied` : ''}
      </span>
      {failed && <p className={styles.help}>Your browser blocked copying. Read the code out, or type it to your friends.</p>}
    </div>
  );
}
