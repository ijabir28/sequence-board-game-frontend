import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AccountMenu } from './AccountMenu';
import { Chip } from './Chip';
import { tipProps } from './ui/TooltipLayer';
import styles from './AppHeader.module.css';

/** Top bar for the lobby and room pages. */
export function AppHeader() {
  const { profile } = useAuth();
  return (
    <header className={styles.header}>
      <Link to="/lobby" className={styles.brand} {...tipProps('Go to the dashboard', 'bottom', 'start')}>
        <span className={styles.logo} aria-hidden="true">
          <Chip team={0} />
        </span>
        Sequence
      </Link>
      {profile && <AccountMenu profile={profile} />}
    </header>
  );
}
