import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Chip } from './Chip';
import styles from './AppHeader.module.css';

/** Top bar for the lobby and room pages. */
export function AppHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <Link to="/lobby" className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          <Chip team={0} />
        </span>
        Sequence
      </Link>
      {profile && (
        <div className={styles.user}>
          <span className={styles.name}>
            Signed in as <strong>{profile.name}</strong>
          </span>
          <button
            type="button"
            className={styles.switch}
            onClick={() => {
              void signOut().finally(() => navigate('/signin'));
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
