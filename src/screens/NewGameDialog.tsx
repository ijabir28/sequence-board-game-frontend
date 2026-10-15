import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { createRoom, DEFAULT_ROOM_SETTINGS, isValidTurnSeconds, type RoomSettings } from '../api/rooms';
import { RoomOptions } from '../components/RoomOptions';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import { HAND_SIZE_BY_PLAYER_COUNT, playersPerTeamOptions, type TeamCount } from '../engine/setup';
import styles from './Forms.module.css';

/** "Start a new game": the host names a table, picks teams and settings, and opens it. */
export function NewGameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const formId = useId();
  const [teamCount, setTeamCount] = useState<TeamCount>(2);
  const [perTeam, setPerTeam] = useState(1);
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidTurnSeconds(settings.turnSeconds)) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createRoom(teamCount, perTeam, { name, settings });
      navigate(`/table/${id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const total = teamCount * perTeam;

  return (
    <Dialog
      open={open}
      title="Start a new game"
      onClose={onClose}
      size="wide"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" busy={creating}>
            <Icon name="plus" size={18} />
            Create table
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} onSubmit={create}>
        <p className={styles.help}>Name the table and pick the teams and settings. Then share its code so friends can take a seat.</p>
        <label className={styles.field}>
          <span className={styles.label}>Table name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="off"
            data-autofocus
            placeholder="Friday night"
            aria-describedby={`${formId}-name-help`}
          />
          <span className={styles.help} id={`${formId}-name-help`}>
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
          <legend>Settings</legend>
          <RoomOptions value={settings} onChange={setSettings} />
          <p className={styles.help}>You can change these until the game starts.</p>
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </p>
        )}
      </form>
    </Dialog>
  );
}
