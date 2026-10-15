import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import styles from './DevAdapterToggle.module.css';

export type AdapterKind = 'local' | 'remote';

const DEV_FLAG = 'sequence.dev';

/** Shown in dev builds, or anywhere after visiting with ?dev=1 (persisted; ?dev=0 turns it off). */
export function devToolsEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('dev');
    if (param === '1') localStorage.setItem(DEV_FLAG, '1');
    if (param === '0') localStorage.removeItem(DEV_FLAG);
    return import.meta.env.DEV || localStorage.getItem(DEV_FLAG) === '1';
  } catch {
    return import.meta.env.DEV;
  }
}

const ROUTES: Record<AdapterKind, string> = { local: '/local', remote: '/server-game' };
const LABELS: Record<AdapterKind, string> = { local: 'Local engine', remote: 'Server' };

/** Dev-only switch between the local rules engine and the backend's game. */
export function DevAdapterToggle({ current }: { current: AdapterKind }) {
  const navigate = useNavigate();
  if (!devToolsEnabled()) return null;
  const other: AdapterKind = current === 'local' ? 'remote' : 'local';
  return (
    <Tooltip text={`Developer tool: switch to the ${LABELS[other].toLowerCase()} game`} align="end">
      <button
        type="button"
        className={styles.toggle}
        onClick={() => navigate(ROUTES[other])}
        aria-label={`Game engine: ${LABELS[current]}. Switch to ${LABELS[other]} (developer tool)`}
      >
        <span className={styles.dev} aria-hidden="true">
          dev
        </span>
        <span className={styles.label} aria-hidden="true">
          {LABELS[current]}
        </span>
        <Icon name="swap" size={16} />
      </button>
    </Tooltip>
  );
}
