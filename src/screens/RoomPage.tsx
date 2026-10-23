import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { startRoomGame } from '../api/roomGame';
import { isFull, isSeated, joinRoom, leaveSeat, sanitizeRoom, shuffleSeats, updateRoom, type Room, type RoomSettings, type RoomTeam, watchLink } from '../api/rooms';
import { onTeamsShuffled } from '../api/socket';
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
import { Tooltip } from '../components/ui/Tooltip';
import { tipProps } from '../components/ui/TooltipLayer';
import { isSupportedTable, sequencesToWin } from '../engine/setup';
import { describeShuffle } from '../game/teamNotice';
import { TEAM_STYLES } from '../game/teams';
import { useMediaQuery } from '../game/useMediaQuery';
import styles from './Forms.module.css';
import own from './RoomPage.module.css';
import { InviteFriendsDialog } from './InviteFriendsDialog';
import { useRoom } from './useRoom';

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
            <p>There is no table with code {id}. Check that the code is typed correctly.</p>
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
            onOpenGame={() => navigate(`/table/${id}/game`)}
          />
        )}
        <PoweredBy />
      </div>
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
          <ShareCode id={room.id} gameStarted={room.gameStarted} />
          {canInvite && (
            <div className={own.invite}>
              <Button size="sm" variant="primary" onClick={() => setInviting(true)} tip="Send friends a link to one of this table's open seats">
                <Icon name="users" size={16} />
                Invite friends
              </Button>
            </div>
          )}
        </div>
      </section>
      <InviteFriendsDialog open={inviting && canInvite} onClose={() => setInviting(false)} room={room} />

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
                    ) : (
                      'Open seat'
                    )}
                  </li>
                ))}
              </ol>
              <Button
                variant={teamFull || seated ? 'secondary' : 'primary'}
                disabled={teamFull || seated || room.gameStarted || joining !== null}
                busy={joining === team.handle}
                onClick={() => onJoin(team)}
                aria-label={teamFull ? `Team ${name} is full` : seated ? `Join Team ${name} (you already have a seat)` : `Join Team ${name}`}
                tip={
                  room.gameStarted
                    ? 'The game has started, so seats are fixed'
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

function ShareCode({ id, gameStarted }: { id: string; gameStarted: boolean }) {
  const [copied, setCopied] = useState<'code' | 'link' | 'watch' | null>(null);
  const [failed, setFailed] = useState(false);
  const link = `${window.location.origin}/table/${id}`;

  const copy = async (what: 'code' | 'link' | 'watch') => {
    try {
      if (!(await copyText(what === 'code' ? id : what === 'watch' ? watchLink(id) : link))) throw new Error('copy refused');
      setCopied(what);
      setFailed(false);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className={own.share}>
      <label className={own.codeField}>
        <span className="visually-hidden">Table code</span>
        <input className={styles.input} value={id} readOnly />
      </label>
      <Tooltip text="Copy the code. Friends enter it under Join a table." align="end">
        <Button size="sm" onClick={() => copy('code')}>
          <Icon name={copied === 'code' ? 'check' : 'copy'} size={16} />
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </Button>
      </Tooltip>
      <Tooltip text="Copy a link that opens this table" align="end">
        <Button size="sm" onClick={() => copy('link')}>
          <Icon name={copied === 'link' ? 'check' : 'copy'} size={16} />
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </Button>
      </Tooltip>
      {gameStarted && (
        <Tooltip text="Copy a link anyone can open to watch the game live, without signing in. They never see a hand." align="end">
          <Button size="sm" onClick={() => copy('watch')}>
            <Icon name={copied === 'watch' ? 'check' : 'eye'} size={16} />
            {copied === 'watch' ? 'Copied' : 'Copy watch link'}
          </Button>
        </Tooltip>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copied ? `${copied === 'code' ? 'Code' : copied === 'watch' ? 'Watch link' : 'Link'} copied` : ''}
      </span>
      {failed && <p className={styles.help}>Your browser blocked copying. Read the code out, or type it to your friends.</p>}
    </div>
  );
}
