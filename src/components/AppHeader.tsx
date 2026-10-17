import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { Tooltip } from './ui/Tooltip';
import { tipProps } from './ui/TooltipLayer';
import styles from './AppHeader.module.css';

/** Top bar for the lobby and room pages. */
export function AppHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <Link to="/lobby" className={styles.brand} {...tipProps('Go to the dashboard', 'bottom', 'start')}>
        <span className={styles.logo} aria-hidden="true">
          <Chip team={0} />
        </span>
        Sequence
      </Link>
      {profile && (
        <div className={styles.user}>
          <Link to="/profile" className={styles.profile} {...tipProps('Your profile: picture, name, email, password and devices', 'bottom', 'end')}>
            <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={32} />
            <span className={styles.name}>
              Signed in as <strong>{profile.name}</strong>
            </span>
          </Link>
          <Tooltip text="Sign out on this device. Your tables and games stay saved." align="end">
            <button
              type="button"
              className={styles.switch}
              onClick={() => {
                void signOut().finally(() => navigate('/signin'));
              }}
            >
              Sign out
            </button>
          </Tooltip>
        </div>
      )}
    </header>
  );
}
