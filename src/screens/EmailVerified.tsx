import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SessionCheck, useAuth } from '../auth/AuthContext';
import { tipProps } from '../components/ui/TooltipLayer';
import { AuthShell } from './AuthShell';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

/**
 * Where the confirmation link lands: /email-verified once the server confirmed the address and signed the player
 * in, or /email-verified?error=… when the link was broken or had expired.
 */
export function EmailVerified() {
  const [params] = useSearchParams();
  const error = params.get('error');
  const { refresh } = useAuth();
  // The server set the session cookie on the redirect; the app learns about it here.
  const [checked, setChecked] = useState(Boolean(error));

  useEffect(() => {
    if (error) return;
    refresh().finally(() => setChecked(true));
  }, [error, refresh]);

  if (!checked) return <SessionCheck />;

  if (error) {
    return (
      <AuthShell>
        <header className={styles.header}>
          <h1>This link has expired</h1>
          <p>
            Confirmation links work for 24 hours. Sign in with your handle and password, and we'll email you a new
            one.
          </p>
        </header>
        <Link to="/signin" className={own.altLink} {...tipProps('Go to sign in')}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <header className={styles.header}>
        <h1>Email confirmed</h1>
        <p>Your account is ready, and you're signed in on this device.</p>
      </header>
      <Link to="/lobby" className={own.altLink} {...tipProps('Open the lobby to start or join a game')}>
        Start playing
      </Link>
    </AuthShell>
  );
}
