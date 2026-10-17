import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { AccountError, resetPassword } from '../api/user';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { tipProps } from '../components/ui/TooltipLayer';
import { AuthShell } from './AuthShell';
import { PASSWORD_MAX, PASSWORD_MIN } from './SignUp';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

type Field = 'password' | 'confirm';

/** The new password and its repeat, or what is wrong with them. */
export function validateNewPassword(password: string, confirm: string): { text: string; field: Field } | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { text: `Passwords need ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`, field: 'password' };
  }
  if (password !== confirm) return { text: "The two passwords don't match.", field: 'confirm' };
  return null;
}

/** Where the emailed reset link lands: /reset-password?token=…, or ?error=INVALID_TOKEN when it has expired. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invalid, setInvalid] = useState<Field | 'token' | null>(token ? null : 'token');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setInvalid(problem.field);
      toast.error(problem.text, { id: 'reset' });
      return;
    }
    setInvalid(null);
    setBusy(true);
    toast.dismiss('reset');
    try {
      await resetPassword(token ?? '', password);
      setDone(true);
    } catch (e) {
      if (e instanceof AccountError && e.code === 'INVALID_TOKEN') setInvalid('token');
      else if (e instanceof AccountError && e.field === 'password') setInvalid('password');
      toast.error(e instanceof AccountError ? e.message : errorMessage(e), { id: 'reset' });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell>
        <header className={styles.header}>
          <h1>Password changed</h1>
          <p>Every device was signed out, in case someone else had your old password. Sign in with the new one.</p>
        </header>
        <Link to="/signin" className={own.altLink} {...tipProps('Go to sign in')}>
          Sign in
        </Link>
      </AuthShell>
    );
  }

  if (invalid === 'token') {
    return (
      <AuthShell>
        <header className={styles.header}>
          <h1>This link has expired</h1>
          <p>Reset links work once, for an hour. Ask for a new one and use the latest email.</p>
        </header>
        <Link to="/forgot-password" className={own.altLink} {...tipProps('Ask for a new password reset link')}>
          Send a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell onSubmit={submit}>
      <header className={styles.header}>
        <h1>Choose a new password</h1>
        <p>Pick one you don't use anywhere else. Every device will be signed out.</p>
      </header>
      <label className={styles.field}>
        <span className={styles.label}>New password</span>
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          aria-invalid={invalid === 'password' || undefined}
          autoFocus
        />
        <span className={styles.help}>At least {PASSWORD_MIN} characters.</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>New password again</span>
        <input
          className={styles.input}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={invalid === 'confirm' || undefined}
        />
      </label>
      <Button type="submit" variant="primary" busy={busy} tip="Save the new password and sign out every device">
        Change password
      </Button>
    </AuthShell>
  );
}
