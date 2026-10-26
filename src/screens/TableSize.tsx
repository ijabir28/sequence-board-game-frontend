import { useId } from 'react';
import { HAND_SIZE_BY_PLAYER_COUNT, playersPerTeamOptions, sequencesToWin, type TeamCount } from '../engine/setup';
import { tipProps } from '../components/ui/TooltipLayer';
import styles from './Forms.module.css';

export interface TableSizeValue {
  teamCount: TeamCount;
  playersPerTeam: number;
}

/** The most players per team `teamCount` teams allow that is no more than `perTeam`, so switching teams loses as few seats as it can. */
function fitPerTeam(teamCount: TeamCount, perTeam: number): number {
  const options = playersPerTeamOptions(teamCount);
  return [...options].reverse().find((n) => n <= perTeam) ?? options[0];
}

/** The host's pick of teams and players per team: only table sizes the rules can deal for are offered. */
export function TableSize({ value, onChange, disabled }: { value: TableSizeValue; onChange: (next: TableSizeValue) => void; disabled?: boolean }) {
  const id = useId();
  const { teamCount, playersPerTeam } = value;
  const total = teamCount * playersPerTeam;
  return (
    <>
      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend>Teams</legend>
        <div className={styles.segmented}>
          {([2, 3] as const).map((n) => (
            <label key={n} className={styles.segment} {...tipProps(`Play with ${n} teams, which need ${sequencesToWin(n)} sequence${sequencesToWin(n) > 1 ? 's' : ''} to win`, 'top')}>
              <input
                type="radio"
                name={`${id}-teams`}
                checked={teamCount === n}
                onChange={() => onChange({ teamCount: n, playersPerTeam: fitPerTeam(n, playersPerTeam) })}
              />
              <span>{n} teams</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend>Players per team</legend>
        <div className={styles.segmented}>
          {playersPerTeamOptions(teamCount).map((n) => (
            <label key={n} className={styles.segment} {...tipProps(`${n} player${n === 1 ? '' : 's'} on each team`, 'top')}>
              <input type="radio" name={`${id}-perTeam`} checked={playersPerTeam === n} onChange={() => onChange({ teamCount, playersPerTeam: n })} />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <p className={styles.help}>
          {total} players, {HAND_SIZE_BY_PLAYER_COUNT[total]} cards each. Only table sizes the rules can deal for are offered.
        </p>
      </fieldset>
    </>
  );
}
