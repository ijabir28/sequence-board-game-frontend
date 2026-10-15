import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { isSeated, joinRoom, type Room, type RoomTeam } from '../api/rooms';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Chip } from '../components/Chip';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { isSupportedTable, sequencesToWin } from '../engine/setup';
import { TEAM_STYLES } from '../game/teams';
import type { LocalConfig } from './LocalSetup';
import styles from './Forms.module.css';
import own from './RoomPage.module.css';
import { useRoom } from './useRoom';

type Notice = { tone: 'error' | 'success'; text: string; action?: 'signin' } | null;

export function RoomPage() {
  const { id = '' } = useParams();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { state, connection, reload } = useRoom(id);
  const [joining, setJoining] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const join = async (team: RoomTeam) => {
    if (!profile) return;
    const name = TEAM_STYLES[team.index]?.name ?? team.handle;
    setJoining(team.handle);
    setNotice(null);
    try {
      const result = await joinRoom(id, team.handle);
      if (result === 'seat-taken') {
        setNotice({ tone: 'error', text: `Team ${name} is full. Pick a team with an open seat.` });
      } else if (result === 'already-seated') {
        setNotice({ tone: 'error', text: 'You already have a seat at this table. Each player takes one seat.' });
      } else if (result === 'signed-out') {
        setNotice({
          tone: 'error',
          text: 'Your session has expired (sessions last an hour and end when the server restarts). Sign in again, then join.',
          action: 'signin',
        });
      } else if (result === 'not-found') {
        setNotice({ tone: 'error', text: 'The server no longer has this table (it forgets tables when it restarts). Go back to the lobby and open a new one.' });
      } else {
        await reload();
        setNotice({ tone: 'success', text: `You joined Team ${name}.` });
      }
    } catch (e) {
      setNotice({ tone: 'error', text: errorMessage(e) });
    } finally {
      setJoining(null);
    }
  };

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        {state.status === 'loading' && (
          <div className={own.state} role="status">
            <span className={own.spinner} aria-hidden="true" />
            Loading table {id}…
          </div>
        )}
        {state.status === 'not-found' && (
          <div className={[styles.card, own.state].join(' ')}>
            <h1>Table not found</h1>
            <p>There is no table with code {id}. The code may be mistyped, or the server restarted and forgot it.</p>
            <Link to="/lobby" className={own.linkButton}>
              Back to the lobby
            </Link>
          </div>
        )}
        {state.status === 'error' && (
          <div className={[styles.card, own.state].join(' ')} role="alert">
            <Icon name="wifiOff" size={28} />
            <h1>Can't load this table</h1>
            <p>{state.message}</p>
            <Button variant="primary" onClick={() => reload()}>
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
            notice={notice}
            onJoin={join}
            onSignInAgain={() => {
              signOut();
              navigate('/signin', { state: { from: `/table/${id}` } });
            }}
            onPlayLocally={(preset) => navigate('/local', { state: { preset } })}
          />
        )}
      </div>
    </>
  );
}

interface RoomViewProps {
  room: Room;
  you: string | null;
  connection: 'connecting' | 'live' | 'offline';
  joining: string | null;
  notice: Notice;
  onJoin: (team: RoomTeam) => void;
  onSignInAgain: () => void;
  onPlayLocally: (preset: LocalConfig) => void;
}

function RoomView({ room, you, connection, joining, notice, onJoin, onSignInAgain, onPlayLocally }: RoomViewProps) {
  const teamCount = room.teams.length;
  const perTeam = Math.max(0, ...room.teams.map((t) => t.seats.length));
  const supported = isSupportedTable(teamCount, perTeam);
  const seated = you !== null && isSeated(room, you);
  const open = room.teams.reduce((n, t) => n + t.seats.filter((s) => s === null).length, 0);
  const total = teamCount * perTeam;

  const preset = (): LocalConfig | null => {
    if (!isSupportedTable(teamCount, perTeam)) return null;
    // Seats alternate teams (T1, T2, [T3,] T1, …), matching the engine's turn order.
    const names = Array.from({ length: total }, (_, seat) => room.teams[seat % teamCount].seats[Math.floor(seat / teamCount)]?.name ?? '');
    return { teamCount, playersPerTeam: perTeam, playerNames: names };
  };

  return (
    <div className={own.layout}>
      <section className={[styles.card, own.summary].join(' ')}>
        <div className={own.titleRow}>
          <h1>Table {room.id}</h1>
          <span className={[own.live, own[connection]].join(' ')} role="status">
            <span className={own.dot} aria-hidden="true" />
            {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Offline, retrying'}
          </span>
        </div>
        <p className={styles.help}>
          {teamCount} teams of {perTeam}
          {supported && `. First team to ${sequencesToWin(teamCount)} sequence${sequencesToWin(teamCount) > 1 ? 's' : ''} wins`}.{' '}
          {room.administrator && <>Opened by {room.administrator}. </>}
          {open === 0 ? 'Every seat is taken.' : `${open} open seat${open === 1 ? '' : 's'}.`}
        </p>
        <ShareCode id={room.id} />
      </section>

      {notice && (
        <div className={notice.tone === 'error' ? styles.error : own.success} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <Icon name={notice.tone === 'error' ? 'alert' : 'check'} size={18} />
          <span>{notice.text}</span>
          {notice.action === 'signin' && (
            <Button size="sm" onClick={onSignInAgain}>
              Sign in again
            </Button>
          )}
        </div>
      )}

      <ul className={own.teams} aria-label="Teams">
        {room.teams.map((team) => {
          const style = TEAM_STYLES[team.index];
          const full = team.seats.every((s) => s !== null);
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
                        {seat.name}
                        {seat.handle === you && <span className={own.you}>you</span>}
                      </>
                    ) : (
                      'Open seat'
                    )}
                  </li>
                ))}
              </ol>
              <Button
                variant={full || seated ? 'secondary' : 'primary'}
                disabled={full || seated || joining !== null}
                busy={joining === team.handle}
                onClick={() => onJoin(team)}
                aria-label={full ? `Team ${name} is full` : seated ? `Join Team ${name} (you already have a seat)` : `Join Team ${name}`}
              >
                {full ? 'Team full' : `Join Team ${name}`}
              </Button>
            </li>
          );
        })}
      </ul>
      {seated && <p className={styles.help}>You have a seat at this table. Each player takes one seat.</p>}

      <section className={[styles.card, own.start].join(' ')}>
        <h2>Start the game</h2>
        <p className={styles.help}>
          The server can't start a game from a table yet. You can play this table's line-up now on one device, passing it
          between players.
        </p>
        <Button
          variant="primary"
          disabled={!supported}
          onClick={() => {
            const p = preset();
            if (p) onPlayLocally(p);
          }}
        >
          Play this table on one device
        </Button>
        {!supported && <p className={styles.help}>This table's size isn't one the rules can deal for, so it can't be played.</p>}
      </section>
    </div>
  );
}

function ShareCode({ id }: { id: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [failed, setFailed] = useState(false);
  const link = `${window.location.origin}/table/${id}`;

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? id : link);
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
        <input className={styles.input} value={id} readOnly onFocus={(e) => e.target.select()} />
      </label>
      <Button size="sm" onClick={() => copy('code')}>
        <Icon name={copied === 'code' ? 'check' : 'copy'} size={16} />
        {copied === 'code' ? 'Copied' : 'Copy code'}
      </Button>
      <Button size="sm" onClick={() => copy('link')}>
        <Icon name={copied === 'link' ? 'check' : 'copy'} size={16} />
        {copied === 'link' ? 'Copied' : 'Copy link'}
      </Button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? `${copied === 'code' ? 'Code' : 'Link'} copied` : ''}
      </span>
      {failed && <p className={styles.help}>Your browser blocked copying. Select the code and copy it by hand.</p>}
    </div>
  );
}
