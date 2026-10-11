import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { InvalidCredentialsError } from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { Chip } from '../components/Chip';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

export function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/lobby';
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ text: string; field: 'credentials' | 'server' } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!handle.trim() || !password) {
      setError({ text: 'Enter your handle and password.', field: 'credentials' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(handle.trim(), password);
      navigate(from, { replace: true });
    } catch (e) {
      setError({ text: e instanceof InvalidCredentialsError ? e.message : errorMessage(e), field: e instanceof InvalidCredentialsError ? 'credentials' : 'server' });
    } finally {
      setBusy(false);
    }
  };

  const invalid = error?.field === 'credentials';

  return (
    <div className={styles.page}>
      <div className={own.mark} aria-hidden="true">
        <span><Chip team={0} /></span>
        <span><Chip team={1} /></span>
        <span><Chip team={2} /></span>
      </div>
      <form className={styles.card} onSubmit={submit} noValidate>
        <header className={styles.header}>
          <h1>Sign in to Sequence</h1>
          <p>Five chips in a row makes a sequence. Sign in to open a table and play with friends.</p>
        </header>

        {error && (
          <p className={styles.error} role="alert" id="signin-error">
            <Icon name="alert" size={18} />
            <span>{error.text}</span>
          </p>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Handle</span>
          <input
            className={styles.input}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={invalid || undefined}
            aria-describedby={error ? 'signin-error' : undefined}
            autoFocus
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={invalid || undefined}
            aria-describedby={error ? 'signin-error' : undefined}
          />
        </label>
        <p className={styles.help}>
          This server has two test accounts: <strong>jabir</strong> / 1 and <strong>sakib</strong> / 123. Accounts can't be created yet.
        </p>

        <Button type="submit" variant="primary" busy={busy}>
          Sign in
        </Button>

        <p className={styles.divider}>or</p>
        <Link to="/local" className={own.altLink}>
          Play on this device without signing in
        </Link>
      </form>
    </div>
  );
}
