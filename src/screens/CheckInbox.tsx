import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { AccountError, resendVerification } from '../api/user';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { tipProps } from '../components/ui/TooltipLayer';
import styles from './Forms.module.css';
import own from './SignIn.module.css';

/**
 * After signing up: the account can sign in once the emailed link is opened. Worded so it is also true when the
 * email already had an account (the server then emails its owner instead), which must not be revealed here.
 */
export function CheckInbox({ email }: { email: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    try {
      await resendVerification(email);
      toast.success(`Sent another link to ${email}.`, { id: 'verify' });
    } catch (e) {
      toast.error(e instanceof AccountError ? e.message : errorMessage(e), { id: 'verify' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className={styles.header}>
        <h1>Check your inbox</h1>
        <p>
          We sent a link to <strong>{email}</strong>. Open it to confirm your email, and you're signed in. The link
          works for 24 hours.
        </p>
      </header>
      <p className={styles.help}>Nothing there? Look in your spam folder, or check the address and send it again.</p>
      <Button variant="primary" busy={busy} onClick={resend} tip="Email a new confirmation link to this address">
        Send the link again
      </Button>
      <Link to="/signin" className={own.altLink} {...tipProps('Go to sign in')}>
        Back to sign in
      </Link>
    </>
  );
}
