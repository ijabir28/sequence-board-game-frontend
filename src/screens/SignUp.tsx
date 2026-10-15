import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { AccountError, type AccountField } from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { Chip } from '../components/Chip';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

// Same rules as the backend (entity/user.js), checked here for instant feedback. The server has the final say.
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
const NAME_MAX = 50;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

type FormError = { text: string; field: AccountField | null };

export function validateSignUp(handle: string, name: string, password: string): FormError | null {
  if (!HANDLE_PATTERN.test(handle.trim().toLowerCase())) {
    return { text: 'Handles are 3 to 20 characters: letters, digits and underscores.', field: 'handle' };
  }
  if (!name.trim() || name.trim().length > NAME_MAX) {
    return { text: `Enter a display name of up to ${NAME_MAX} characters.`, field: 'name' };
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { text: `Passwords need ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`, field: 'password' };
  }
  return null;
}

export function SignUp() {
  const { profile, signUp } = useAuth();
  const navigate = useNavigate();
  const fromState = useLocation().state as { from?: string } | null;
  const from = fromState?.from ?? '/lobby';
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateSignUp(handle, name, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp(handle.trim(), name.trim(), password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof AccountError ? { text: e.message, field: e.field } : { text: errorMessage(e), field: null });
    } finally {
      setBusy(false);
    }
  };

  if (profile) return <Navigate to={from} replace />;

  const fieldProps = (field: AccountField) => ({
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': error?.field === field ? 'signup-error' : undefined,
  });

  return (
    <div className={styles.page}>
      <div className={own.mark} aria-hidden="true">
        <span><Chip team={0} /></span>
        <span><Chip team={1} /></span>
        <span><Chip team={2} /></span>
      </div>
      <form className={styles.card} onSubmit={submit} noValidate>
        <header className={styles.header}>
          <h1>Create your account</h1>
          <p>Pick a handle your friends will recognise. You'll be signed in straight away.</p>
        </header>

        {error && (
          <p className={styles.error} role="alert" id="signup-error">
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
            maxLength={20}
            autoFocus
            {...fieldProps('handle')}
          />
          <span className={styles.help}>3–20 letters, digits or underscores. Used to sign in; not case-sensitive.</span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Display name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            maxLength={NAME_MAX}
            {...fieldProps('name')}
          />
          <span className={styles.help}>Shown to other players at the table.</span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            {...fieldProps('password')}
          />
          <span className={styles.help}>At least {PASSWORD_MIN} characters.</span>
        </label>

        <Button type="submit" variant="primary" busy={busy}>
          Create account
        </Button>

        <p className={styles.divider}>or</p>
        <Link to="/signin" state={fromState} className={own.altLink}>
          I already have an account
        </Link>
      </form>
    </div>
  );
}
