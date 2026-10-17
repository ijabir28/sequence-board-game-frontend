import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { AccountError, requestPasswordReset } from '../api/user';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { tipProps } from '../components/ui/TooltipLayer';
import { AuthShell } from './AuthShell';
import { EMAIL_PATTERN } from './SignUp';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

/** Asks for a password reset link. The answer is the same whether or not the email has an account. */
export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setInvalid(true);
      toast.error('Enter the email of your account.', { id: 'forgot' });
      return;
    }
    setInvalid(false);
    setBusy(true);
    toast.dismiss('forgot');
    try {
      await requestPasswordReset(address);
      setSentTo(address);
    } catch (e) {
      toast.error(e instanceof AccountError ? e.message : errorMessage(e), { id: 'forgot' });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell>
        <header className={styles.header}>
          <h1>Check your inbox</h1>
          <p>
            If an account uses <strong>{sentTo}</strong>, we've sent it a link to choose a new password. The link works
            once, for an hour.
          </p>
        </header>
        <p className={styles.help}>Nothing there? Look in your spam folder, or try the email you signed up with.</p>
        <Link to="/signin" className={own.altLink} {...tipProps('Go to sign in')}>
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell onSubmit={submit}>
      <header className={styles.header}>
        <h1>Forgot your password?</h1>
        <p>Enter your account's email and we'll send you a link to choose a new one.</p>
      </header>
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
          aria-invalid={invalid || undefined}
          autoFocus
        />
        <span className={styles.help}>
          Accounts made before emails were asked for can't be reset this way. Sign in and add an email in your profile.
        </span>
      </label>
      <Button type="submit" variant="primary" busy={busy} tip="Email a password reset link to this address">
        Send reset link
      </Button>
      <Link to="/signin" className={own.altLink} {...tipProps('Go back to sign in')}>
        Back to sign in
      </Link>
    </AuthShell>
  );
}
