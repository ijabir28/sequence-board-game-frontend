import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../api/http';
import {
  AccountError,
  changeEmail,
  changePassword,
  currentSessionToken,
  listSessions,
  removeAvatar,
  resendVerification,
  updateName,
  uploadAvatar,
  type DeviceSession,
  type Profile,
} from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { DeckPicker } from '../components/cards/DeckPicker';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { AVATAR_ACCEPT, AvatarError, makeAvatar } from '../profile/avatarImage';
import { describeDevice } from '../profile/describeDevice';
import { validateNewPassword } from './ResetPassword';
import { EMAIL_PATTERN, NAME_MAX, PASSWORD_MIN } from './SignUp';
import styles from './Forms.module.css';
import own from './ProfilePage.module.css';

function problem(e: unknown): string {
  return e instanceof AccountError ? e.message : errorMessage(e);
}

const DATE = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** The signed-in player's account: picture, name, email, password and the devices signed in. */
export function ProfilePage() {
  const { profile, refresh } = useAuth();
  if (!profile) return null;
  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <div className={own.grid}>
          <IdentityCard profile={profile} refresh={refresh} />
          <NameCard profile={profile} refresh={refresh} />
          <DeckCard />
          <EmailCard profile={profile} />
          <PasswordCard />
          <DevicesCard />
        </div>
      </div>
    </>
  );
}

type CardProps = { profile: Profile; refresh: () => Promise<Profile | null> };

function IdentityCard({ profile, refresh }: CardProps) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const { played, won, playing } = profile.stats;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      await uploadAvatar(await makeAvatar(file));
      await refresh();
      toast.success('Picture updated.', { id: 'avatar' });
    } catch (e) {
      toast.error(e instanceof AvatarError ? e.message : problem(e), { id: 'avatar' });
    } finally {
      setBusy(null);
      // Choosing the same file again should upload again.
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      await removeAvatar();
      await refresh();
      toast.success('Picture removed.', { id: 'avatar' });
    } catch (e) {
      toast.error(problem(e), { id: 'avatar' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={[styles.card, own.identity].join(' ')} aria-labelledby="profile-title">
      <div className={own.who}>
        <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={96} />
        <div className={own.names}>
          <h1 id="profile-title">{profile.name}</h1>
          <p className={own.handle}>@{profile.handle}</p>
          {profile.createdAt && <p className={styles.help}>Playing since {DATE.format(new Date(profile.createdAt))}</p>}
        </div>
      </div>
      <dl className={own.stats}>
        <div>
          <dt>Games played</dt>
          <dd>{played}</dd>
        </div>
        <div>
          <dt>Won</dt>
          <dd>{won}</dd>
        </div>
        <div>
          <dt>Win rate</dt>
          <dd>{played > 0 ? `${Math.round((won / played) * 100)}%` : '–'}</dd>
        </div>
        <div>
          <dt>In progress</dt>
          <dd>{playing}</dd>
        </div>
      </dl>
      <div className={own.actions}>
        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          className={own.fileInput}
          onChange={(e) => void upload(e.target.files?.[0])}
          tabIndex={-1}
          aria-hidden="true"
        />
        <Button
          variant="primary"
          busy={busy === 'upload'}
          disabled={busy !== null}
          onClick={() => input.current?.click()}
          tip="Choose a picture. Its centre is cropped to a square and shrunk before it is uploaded."
        >
          {profile.image ? 'Change picture' : 'Upload a picture'}
        </Button>
        {profile.image && (
          <Button busy={busy === 'remove'} disabled={busy !== null} onClick={remove} tip="Go back to your initials">
            Remove picture
          </Button>
        )}
      </div>
    </section>
  );
}

function NameCard({ profile, refresh }: CardProps) {
  const toast = useToast();
  const [name, setName] = useState(profile.name);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const unchanged = name.trim() === profile.name;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || name.trim().length > NAME_MAX) {
      setInvalid(true);
      toast.error(`Enter a display name of up to ${NAME_MAX} characters.`, { id: 'name' });
      return;
    }
    setInvalid(false);
    setBusy(true);
    try {
      await updateName(name.trim());
      await refresh();
      toast.success('Display name saved.', { id: 'name' });
    } catch (e) {
      setInvalid(e instanceof AccountError && e.field === 'name');
      toast.error(problem(e), { id: 'name' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={submit} noValidate aria-labelledby="name-title">
      <header className={styles.header}>
        <h2 id="name-title" className={own.title}>
          Display name
        </h2>
        <p>What other players see at the table. Your handle, @{profile.handle}, stays the same: it's how you sign in.</p>
      </header>
      <label className={styles.field}>
        <span className={styles.label}>Display name</span>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
          maxLength={Math.max(NAME_MAX, profile.name.length)}
          aria-invalid={invalid || undefined}
        />
        <span className={styles.help}>
          Up to {NAME_MAX} characters ({name.length}/{NAME_MAX}).
        </span>
      </label>
      <div className={own.actions}>
        <Button type="submit" variant="primary" busy={busy} disabled={unchanged} tip="Save the new display name">
          Save name
        </Button>
      </div>
    </form>
  );
}

function DeckCard() {
  return (
    <section className={styles.card} aria-labelledby="deck-title">
      <header className={styles.header}>
        <h2 id="deck-title" className={own.title}>
          Card deck
        </h2>
        <p>
          The design of the cards in your hand. Only you see it, and you can change it any time, also from the game menu
          in the middle of a game. It is remembered on this device.
        </p>
      </header>
      <DeckPicker />
    </section>
  );
}

function EmailCard({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState<'change' | 'resend' | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setInvalid(true);
      toast.error('Enter a valid email address.', { id: 'email' });
      return;
    }
    if (address.toLowerCase() === profile.email) {
      setInvalid(true);
      toast.error("That's already your email.", { id: 'email' });
      return;
    }
    setInvalid(false);
    setBusy('change');
    try {
      await changeEmail(address);
      setEmail('');
      toast.info(
        profile.email && profile.emailVerified
          ? `We emailed ${profile.email} to approve the change. Then ${address} gets a link to confirm it.`
          : `We sent a link to ${address}. Open it to make it your email.`,
        { id: 'email', durationMs: null },
      );
    } catch (e) {
      toast.error(problem(e), { id: 'email' });
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    if (!profile.email) return;
    setBusy('resend');
    try {
      await resendVerification(profile.email);
      toast.success(`Sent another link to ${profile.email}.`, { id: 'email' });
    } catch (e) {
      toast.error(problem(e), { id: 'email' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <form className={styles.card} onSubmit={submit} noValidate aria-labelledby="email-title">
      <header className={styles.header}>
        <h2 id="email-title" className={own.title}>
          Email
        </h2>
        <p>Never shown to other players. It's where password reset links go.</p>
      </header>
      {profile.email ? (
        <p className={own.current}>
          <strong>{profile.email}</strong>
          <span className={profile.emailVerified ? own.badgeOk : own.badgeWaiting}>
            {profile.emailVerified ? 'Confirmed' : 'Not confirmed'}
          </span>
        </p>
      ) : (
        <p className={own.notice}>
          Your account has no email yet, so a forgotten password can't be reset. Add one below.
        </p>
      )}
      {profile.email && !profile.emailVerified && (
        <div className={own.actions}>
          <Button busy={busy === 'resend'} disabled={busy !== null} onClick={resend} tip="Email a new confirmation link">
            Send the confirmation link again
          </Button>
        </div>
      )}
      <label className={styles.field}>
        <span className={styles.label}>{profile.email ? 'New email' : 'Email'}</span>
        <input
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={invalid || undefined}
        />
        <span className={styles.help}>It changes once you open the link we email to it.</span>
      </label>
      <div className={own.actions}>
        <Button type="submit" variant="primary" busy={busy === 'change'} disabled={busy !== null || !email.trim()} tip="Email a link to confirm the new address">
          {profile.email ? 'Change email' : 'Add email'}
        </Button>
      </div>
    </form>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invalid, setInvalid] = useState<'current' | 'password' | 'confirm' | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) {
      setInvalid('current');
      toast.error('Enter your current password.', { id: 'password' });
      return;
    }
    const wrong = validateNewPassword(password, confirm);
    if (wrong) {
      setInvalid(wrong.field);
      toast.error(wrong.text, { id: 'password' });
      return;
    }
    setInvalid(null);
    setBusy(true);
    try {
      await changePassword(current, password);
      setCurrent('');
      setPassword('');
      setConfirm('');
      toast.success('Password changed. Every other device was signed out.', { id: 'password' });
    } catch (e) {
      if (e instanceof AccountError) setInvalid(e.field === 'currentPassword' ? 'current' : e.field === 'password' ? 'password' : null);
      toast.error(problem(e), { id: 'password' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={submit} noValidate aria-labelledby="password-title">
      <header className={styles.header}>
        <h2 id="password-title" className={own.title}>
          Password
        </h2>
        <p>Changing it signs out every other device.</p>
      </header>
      <label className={styles.field}>
        <span className={styles.label}>Current password</span>
        <input
          className={styles.input}
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          aria-invalid={invalid === 'current' || undefined}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>New password</span>
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          aria-invalid={invalid === 'password' || undefined}
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
      <div className={own.actions}>
        <Button type="submit" variant="primary" busy={busy} tip="Save the new password and sign out every other device">
          Change password
        </Button>
      </div>
    </form>
  );
}

function DevicesCard() {
  const toast = useToast();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions(await currentSessionToken()));
    } catch (e) {
      toast.error(problem(e), { id: 'devices' });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.card} aria-labelledby="devices-title">
      <header className={styles.header}>
        <h2 id="devices-title" className={own.title}>
          Signed-in device
        </h2>
        <p>
          Your account is signed in on one device at a time: signing in somewhere else signs this one out. Signed out and
          it wasn't you? Change your password.
        </p>
      </header>
      {sessions === null ? (
        <p className={styles.help} role="status">
          Loading…
        </p>
      ) : (
        <ul className={own.devices}>
          {sessions.map((session) => (
            <li key={session.createdAt + session.userAgent}>
              <span className={own.device}>
                {describeDevice(session.userAgent)}
                {session.current && <span className={own.badgeOk}>This device</span>}
              </span>
              <span className={styles.help}>Last active {DATE_TIME.format(new Date(session.updatedAt))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
