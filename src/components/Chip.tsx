import type { TeamIndex } from '../engine/setup';
import { TEAM_STYLES } from '../game/teams';
import styles from './Chip.module.css';

interface ChipProps {
  team: TeamIndex;
  locked?: boolean;
  className?: string;
}

/** A team marker. Each team has its own silhouette and inner mark, not just its own colour. */
export function Chip({ team, locked = false, className }: ChipProps) {
  const { shape, color, ink, glow } = TEAM_STYLES[team];
  return (
    <svg
      className={[styles.chip, locked && styles.locked, className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ '--chip-color': color, '--chip-ink': ink, '--chip-glow': glow } as React.CSSProperties}
    >
      {shape === 'circle' && (
        <>
          <circle cx="12" cy="12" r="10.5" className={styles.body} />
          <circle cx="12" cy="12" r="5.5" className={styles.mark} fill="none" strokeWidth="2.2" />
        </>
      )}
      {shape === 'diamond' && (
        <>
          <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2" transform="rotate(45 12 12)" className={styles.body} />
          <rect x="9" y="9" width="6" height="6" transform="rotate(45 12 12)" className={styles.mark} fill="none" strokeWidth="2" />
        </>
      )}
      {shape === 'triangle' && (
        <>
          <path d="M12 1.8 L22.6 21 H1.4 Z" strokeLinejoin="round" className={styles.body} />
          <circle cx="12" cy="14.4" r="2.6" className={styles.markFill} />
        </>
      )}
    </svg>
  );
}
