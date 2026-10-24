import { useState, type FormEvent } from 'react';
import { HAND_SIZE_BY_PLAYER_COUNT, playersPerTeamOptions, seatTeams, sequencesToWin, type TeamCount } from '../engine/setup';
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from '../api/rooms';
import { Chip } from '../components/Chip';
import { PoweredBy } from '../components/PoweredBy';
import { RoomOptions } from '../components/RoomOptions';
import { Button } from '../components/ui/Button';
import { tipProps } from '../components/ui/TooltipLayer';
import { TEAM_STYLES } from '../game/teams';
import styles from './Forms.module.css';

export interface LocalConfig {
  teamCount: TeamCount;
  playersPerTeam: number;
  playerNames: string[];
  settings: RoomSettings;
}

interface LocalSetupProps {
  initial?: Partial<LocalConfig>;
  onStart: (config: LocalConfig) => void;
  /** Optional link back (for example to the lobby). */
  backAction?: React.ReactNode;
}

/** Choose teams and names for a hot-seat game on this device. */
export function LocalSetup({ initial, onStart, backAction }: LocalSetupProps) {
  const [teamCount, setTeamCount] = useState<TeamCount>(initial?.teamCount ?? 2);
  const [playersPerTeam, setPlayersPerTeam] = useState(initial?.playersPerTeam ?? 1);
  const [names, setNames] = useState<string[]>(initial?.playerNames ?? []);
  const [settings, setSettings] = useState<RoomSettings>(initial?.settings ?? DEFAULT_ROOM_SETTINGS);

  const perTeamOptions = playersPerTeamOptions(teamCount);
  const seats = seatTeams(teamCount, playersPerTeam);
  const total = seats.length;

  const changeTeams = (count: TeamCount) => {
    setTeamCount(count);
    if (!playersPerTeamOptions(count).includes(playersPerTeam)) setPlayersPerTeam(1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart({ teamCount, playersPerTeam, playerNames: seats.map((_, i) => names[i]?.trim() || `Player ${i + 1}`), settings });
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={submit}>
        <header className={styles.header}>
          <h1>Pass and play</h1>
          <p>Everyone shares one screen and passes it round. Each hand stays hidden until its owner reveals it.</p>
        </header>

        <fieldset className={styles.fieldset}>
          <legend>Teams</legend>
          <div className={styles.segmented}>
            {([2, 3] as const).map((count) => (
              <label key={count} className={styles.segment} {...tipProps(`Play with ${count} teams, which need ${sequencesToWin(count)} sequence${sequencesToWin(count) > 1 ? 's' : ''} to win`, 'top')}>
                <input type="radio" name="teams" value={count} checked={teamCount === count} onChange={() => changeTeams(count)} />
                <span>{count} teams</span>
              </label>
            ))}
          </div>
          <p className={styles.help}>
            {teamCount} teams need {sequencesToWin(teamCount)} sequence{sequencesToWin(teamCount) > 1 ? 's' : ''} to win.
          </p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Players per team</legend>
          <div className={styles.segmented}>
            {perTeamOptions.map((n) => (
              <label key={n} className={styles.segment} {...tipProps(`${n} player${n === 1 ? '' : 's'} on each team`, 'top')}>
                <input type="radio" name="perTeam" value={n} checked={playersPerTeam === n} onChange={() => setPlayersPerTeam(n)} />
                <span>{n}</span>
              </label>
            ))}
          </div>
          <p className={styles.help}>
            {total} players, {HAND_SIZE_BY_PLAYER_COUNT[total]} cards each.
          </p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Names, in turn order</legend>
          <ol className={styles.seats}>
            {seats.map((team, i) => (
              <li key={i} className={styles.seat}>
                <span className={styles.seatChip} {...tipProps(`Seat ${i + 1} plays for Team ${TEAM_STYLES[team].name}`, 'top', 'start')}>
                  <Chip team={team} />
                </span>
                <label className={styles.seatLabel}>
                  <span className="visually-hidden">
                    Seat {i + 1}, Team {TEAM_STYLES[team].name}
                  </span>
                  <input
                    className={styles.input}
                    value={names[i] ?? ''}
                    placeholder={`Player ${i + 1}`}
                    maxLength={20}
                    autoComplete="off"
                    onChange={(e) => setNames((prev) => Object.assign([...prev], { [i]: e.target.value }))}
                  />
                </label>
                <span className={styles.seatTeam}>{TEAM_STYLES[team].name}</span>
              </li>
            ))}
          </ol>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Options</legend>
          <RoomOptions value={settings} onChange={setSettings} />
        </fieldset>

        <div className={styles.footer}>
          {backAction}
          <Button type="submit" variant="primary" tip="Deal the cards and start playing on this device">
            Start game
          </Button>
        </div>
      </form>
      <PoweredBy />
    </div>
  );
}
