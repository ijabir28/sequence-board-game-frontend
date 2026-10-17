import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { AccountError, type AccountField } from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { tipProps } from '../components/ui/TooltipLayer';
import { AuthShell } from './AuthShell';
import { CheckInbox } from './CheckInbox';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

// Same rules as the backend (entity/user.js), checked here for instant feedback. The server has the final say.
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
/** Display names are short so they fit in turn panels and seat lists. */
export const NAME_MAX = 10;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
// A light check for typos; the server validates the address and, later, whether it receives mail.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `confirm` is the repeated password, which only this form has.
type Field = AccountField | 'confirm';
type FormError = { text: string; field: Field | null };

export function validateSignUp(handle: string, name: string, email: string, password: string, confirm: string): FormError | null {
  if (!HANDLE_PATTERN.test(handle.trim().toLowerCase())) {
    return { text: 'Handles are 3 to 20 characters: letters, digits and underscores.', field: 'handle' };
  }
  if (!name.trim() || name.trim().length > NAME_MAX) {
    return { text: `Enter a display name of up to ${NAME_MAX} characters.`, field: 'name' };
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return { text: 'Enter a valid email address.', field: 'email' };
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { text: `Passwords need ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`, field: 'password' };
  }
  if (password !== confirm) {
    return { text: "The two passwords don't match.", field: 'confirm' };
  }
  return null;
}

export function SignUp() {
  const { profile, signUp } = useAuth();
  const fromState = useLocation().state as { from?: string } | null;
  const from = fromState?.from ?? '/lobby';
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setFormError] = useState<FormError | null>(null);
  const toast = useToast();
  // The message floats as a toast; the field it is about stays marked until the next try.
  const setError = (next: FormError | null) => {
    setFormError(next);
    if (next) toast.error(next.text, { id: 'signup' });
    else toast.dismiss('signup');
  };
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateSignUp(handle, name, email, password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp(handle.trim(), name.trim(), email.trim(), password);
      setSentTo(email.trim());
    } catch (e) {
      setError(e instanceof AccountError ? { text: e.message, field: e.field } : { text: errorMessage(e), field: null });
    } finally {
      setBusy(false);
    }
  };

  if (profile) return <Navigate to={from} replace />;
  if (sentTo) {
    return (
      <AuthShell>
        <CheckInbox email={sentTo} />
      </AuthShell>
    );
  }

  const fieldProps = (field: Field) => ({
    'aria-invalid': error?.field === field || undefined,
  });

  return (
    <AuthShell onSubmit={submit}>
      <header className={styles.header}>
        <h1>Create your account</h1>
        <p>Pick a handle your friends will recognise. We'll email you a link to confirm your address.</p>
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
        <span className={styles.help}>
          Shown to other players at the table. Up to {NAME_MAX} characters ({name.length}/{NAME_MAX}).
        </span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          {...fieldProps('email')}
        />
        <span className={styles.help}>Never shown to other players. Used to reset your password.</span>
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
      <label className={styles.field}>
        <span className={styles.label}>Confirm Password</span>
        <input
          className={styles.input}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          {...fieldProps('confirm')}
        />
      </label>

      <Button type="submit" variant="primary" busy={busy} tip="Create the account and email you a link to confirm it">
        Create account
      </Button>

      <p className={styles.divider}>or</p>
      <Link to="/signin" state={fromState} className={own.altLink} {...tipProps('Go to sign in instead')}>
        I already have an account
      </Link>
    </AuthShell>
  );
}
