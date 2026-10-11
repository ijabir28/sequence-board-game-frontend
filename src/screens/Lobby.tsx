import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { createRoom, getRoom } from '../api/rooms';
import { AppHeader } from '../components/AppHeader';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { HAND_SIZE_BY_PLAYER_COUNT, playersPerTeamOptions, type TeamCount } from '../engine/setup';
import styles from './Forms.module.css';
import own from './Lobby.module.css';

export function Lobby() {
  const navigate = useNavigate();

  const [teamCount, setTeamCount] = useState<TeamCount>(2);
  const [perTeam, setPerTeam] = useState(1);
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
      const id = await createRoom(teamCount, perTeam);
      navigate(`/table/${id}`);
    } catch (e) {
      setCreateError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const id = code.replace(/\s+/g, '');
    if (!/^\d+$/.test(id)) {
      setJoinError('Table codes are numbers only, like 331791756412570. Check the code and try again.');
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
          <form className={styles.card} onSubmit={create}>
            <header className={styles.header}>
              <h1>Open a table</h1>
              <p>Pick the teams, then share the table code so friends can take a seat.</p>
            </header>
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
                <p>Enter the code a friend shared with you.</p>
              </header>
              <label className={styles.field}>
                <span className={styles.label}>Table code</span>
                <input
                  className={styles.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="331791756412570"
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
          </div>
        </div>
      </div>
    </>
  );
}
