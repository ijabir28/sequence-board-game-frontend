import type { LogEntry } from '../../engine/game';
import { describeLog } from '../../game/describeLog';
import { Chip } from '../Chip';
import styles from './MoveLog.module.css';

/** Newest-first list of moves. */
export function MoveLog({ entries, emptyText }: { entries: LogEntry[]; emptyText: string }) {
  if (entries.length === 0) return <p className={styles.empty}>{emptyText}</p>;
  return (
    <ol className={styles.log} reversed>
      {[...entries].reverse().map((entry, i) => (
        <li
          key={entries.length - i}
          className={[styles.entry, (entry.kind === 'sequence' || entry.kind === 'win') && styles.highlight].filter(Boolean).join(' ')}
        >
          <span className={styles.chip}>
            <Chip team={entry.team} />
          </span>
          <span>{describeLog(entry)}</span>
        </li>
      ))}
    </ol>
  );
}
