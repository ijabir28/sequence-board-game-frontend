import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { createRoom, DEFAULT_ROOM_SETTINGS, getRoom, parseTableCode, type RoomSettings } from '../api/rooms';
import { AppHeader } from '../components/AppHeader';
import { RoomOptions } from '../components/RoomOptions';
import { devToolsEnabled } from '../components/game/DevAdapterToggle';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { HAND_SIZE_BY_PLAYER_COUNT, playersPerTeamOptions, type TeamCount } from '../engine/setup';
import styles from './Forms.module.css';
import own from './Lobby.module.css';
import { ResumeBanner, useMyRooms, YourTables } from './YourTables';

export function Lobby() {
  const navigate = useNavigate();
  const myRooms = useMyRooms();

  const [teamCount, setTeamCount] = useState<TeamCount>(2);
  const [perTeam, setPerTeam] = useState(1);
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createRoom(teamCount, perTeam, { name, settings });
      navigate(`/table/${id}`);
    } catch (e) {
      setCreateError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const id = parseTableCode(code);
    if (!id) {
      setJoinError('Table codes are lower-case words and numbers joined by hyphens, like friday-night-k3m9. You can also paste a table link.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const room = await getRoom(id);
      if (!room) setJoinError(`There is no table with code ${id}. Check the code, or create a new table.`);
      else navigate(`/table/${id}`);
    } catch (e) {
      setJoinError(errorMessage(e));
    } finally {
      setJoining(false);
    }
  };

  const total = teamCount * perTeam;

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <div className={own.grid}>
          <ResumeBanner state={myRooms.state} />
          <form className={styles.card} onSubmit={create}>
            <header className={styles.header}>
              <h1>Open a table</h1>
              <p>Name the table and pick the teams, then share its code so friends can take a seat.</p>
            </header>
            <label className={styles.field}>
              <span className={styles.label}>Table name</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="off"
                placeholder="Friday night"
                aria-describedby="table-name-help"
              />
              <span className={styles.help} id="table-name-help">
                Optional. The table's code is made from its name. Leave it blank for a random one.
              </span>
            </label>
            <fieldset className={styles.fieldset}>
              <legend>Teams</legend>
              <div className={styles.segmented}>
                {([2, 3] as const).map((n) => (
                  <label key={n} className={styles.segment}>
                    <input
                      type="radio"
                      name="teams"
                      checked={teamCount === n}
                      onChange={() => {
                        setTeamCount(n);
                        if (!playersPerTeamOptions(n).includes(perTeam)) setPerTeam(1);
                      }}
                    />
                    <span>{n} teams</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend>Players per team</legend>
              <div className={styles.segmented}>
                {playersPerTeamOptions(teamCount).map((n) => (
                  <label key={n} className={styles.segment}>
                    <input type="radio" name="perTeam" checked={perTeam === n} onChange={() => setPerTeam(n)} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
              <p className={styles.help}>
                {total} players, {HAND_SIZE_BY_PLAYER_COUNT[total]} cards each. Only table sizes the rules can deal for are offered.
              </p>
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend>Options</legend>
              <RoomOptions value={settings} onChange={setSettings} />
              <p className={styles.help}>You can change these until the game starts.</p>
            </fieldset>
            {createError && (
              <p className={styles.error} role="alert">
                <Icon name="alert" size={18} />
                <span>{createError}</span>
              </p>
            )}
            <Button type="submit" variant="primary" busy={creating}>
              <Icon name="plus" size={18} />
              Open table
            </Button>
          </form>

          <div className={own.side}>
            <form className={styles.card} onSubmit={join} noValidate>
              <header className={styles.header}>
                <h2>Join a table</h2>
                <p>Enter the code or link a friend shared with you.</p>
              </header>
              <label className={styles.field}>
                <span className={styles.label}>Table code</span>
                <input
                  className={styles.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="friday-night-k3m9"
                  aria-invalid={joinError ? true : undefined}
                  aria-describedby={joinError ? 'join-error' : undefined}
                />
              </label>
              {joinError && (
                <p className={styles.error} role="alert" id="join-error">
                  <Icon name="alert" size={18} />
                  <span>{joinError}</span>
                </p>
              )}
              <Button type="submit" busy={joining}>
                Find table
              </Button>
            </form>

            <section className={styles.card}>
              <header className={styles.header}>
                <h2>Play on this device</h2>
                <p>Pass one screen around. Works without the server.</p>
              </header>
              <Link to="/local" className={own.linkButton}>
                Set up a hot-seat game
              </Link>
            </section>

            {devToolsEnabled() && (
              <section className={[styles.card, own.dev].join(' ')}>
                <header className={styles.header}>
                  <h2>Server test game</h2>
                  <p>Developer tool. Opens the server's built-in test game: one shared board with four fixed players.</p>
                </header>
                <Link to="/server-game" className={own.linkButton}>
                  Open server game
                </Link>
              </section>
            )}
          </div>

          <YourTables state={myRooms.state} reload={myRooms.reload} onPage={myRooms.setPage} />
        </div>
      </div>
    </>
  );
}
