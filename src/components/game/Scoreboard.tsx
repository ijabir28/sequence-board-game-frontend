import { TEAM_STYLES } from '../../game/teams';
import type { TeamView } from '../../game/types';
import { Chip } from '../Chip';
import styles from './Scoreboard.module.css';

interface ScoreboardProps {
  teams: TeamView[];
  sequencesToWin: number | null;
  currentTeam: number | null;
}

/** Sequence count per team, e.g. "Green 1 of 2". */
export function Scoreboard({ teams, sequencesToWin, currentTeam }: ScoreboardProps) {
  return (
    <ul className={styles.scores} aria-label="Sequences per team">
      {teams.map((team) => {
        const { name } = TEAM_STYLES[team.index];
        const label = sequencesToWin
          ? `Team ${name}: ${team.sequences} of ${sequencesToWin} sequences`
          : `Team ${name}: ${team.sequences} sequences`;
        return (
          <li key={team.index} className={[styles.score, currentTeam === team.index && styles.active].filter(Boolean).join(' ')} aria-label={label}>
            <span className={styles.chip}>
              <Chip team={team.index} />
            </span>
            <span className={styles.name} aria-hidden="true">
              {name}
            </span>
            <span className={styles.count} aria-hidden="true">
              {team.sequences}
              {sequencesToWin !== null && <span className={styles.of}>/{sequencesToWin}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
