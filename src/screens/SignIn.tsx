import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { AccountError } from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { tipProps } from '../components/ui/TooltipLayer';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

export function SignIn() {
  const { profile, signIn } = useAuth();
  const navigate = useNavigate();
  const fromState = useLocation().state as { from?: string } | null;
  const from = fromState?.from ?? '/lobby';
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setFormError] = useState<{ text: string; field: 'credentials' | 'server' } | null>(null);
  const toast = useToast();
  // The message floats as a toast; the fields stay marked until the next try.
  const setError = (next: { text: string; field: 'credentials' | 'server' } | null) => {
    setFormError(next);
    if (next) toast.error(next.text, { id: 'signin' });
    else toast.dismiss('signin');
  };
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
      if (e instanceof AccountError) setError({ text: e.message, field: e.field === 'credentials' ? 'credentials' : 'server' });
      else setError({ text: errorMessage(e), field: 'server' });
    } finally {
      setBusy(false);
    }
  };

  const invalid = error?.field === 'credentials';

  // Already signed in (for example a bookmarked /signin): skip the form.
  if (profile) return <Navigate to={from} replace />;

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
          />
        </label>
        {import.meta.env.DEV && (
          <p className={styles.help}>
            Development accounts: <strong>jabir</strong> / 1 and <strong>sakib</strong> / 123.
          </p>
        )}

        <Button type="submit" variant="primary" busy={busy} tip="Sign in with your handle and password">
          Sign in
        </Button>

        <p className={styles.help}>
          New here?{' '}
          <Link to="/signup" state={fromState} {...tipProps('Make a new account with a handle and display name')}>
            Create an account
          </Link>
        </p>

        <p className={styles.divider}>or</p>
        <Link to="/local" className={own.altLink} {...tipProps('Hot-seat game: everyone shares this screen. No account needed.')}>
          Play on this device without signing in
        </Link>
      </form>
    </div>
  );
}
