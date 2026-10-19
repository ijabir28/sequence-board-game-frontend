import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage, request } from '../api/http';
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
import { BackToDashboard } from '../components/BackToDashboard';
import { PoweredBy } from '../components/PoweredBy';
import { BoardStylePicker, DeckPicker } from '../components/cards/DeckPicker';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import menuStyles from '../components/ui/Menu.module.css';
import { tipProps } from '../components/ui/TooltipLayer';
import { useMenu } from '../components/ui/useMenu';
import { AvatarCropDialog } from '../profile/AvatarCropDialog';
import { AVATAR_ACCEPT, AvatarError, makeAvatar, type Crop } from '../profile/avatarImage';
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
        <BackToDashboard className={own.back} tip="Go back to the dashboard: your tables and games" />
        <div className={own.grid}>
          <div className={own.column}>
            <IdentityCard profile={profile} refresh={refresh} />
            <NameCard profile={profile} refresh={refresh} />
            <EmailCard profile={profile} />
            <DevicesCard />
          </div>
          <div className={own.column}>
            <PasswordCard />
            <DeckCard />
          </div>
        </div>
        <PoweredBy />
      </div>
    </>
  );
}

type CardProps = { profile: Profile; refresh: () => Promise<Profile | null> };

function IdentityCard({ profile, refresh }: CardProps) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'load' | 'upload' | 'remove' | null>(null);
  const menu = useMenu();
  const { played, won, playing } = profile.stats;

  // A chosen picture waits here while the player crops it.
  const [picked, setPicked] = useState<File | null>(null);
  const forgetPicked = () => {
    setPicked(null);
    // Choosing the same file again should open the crop again.
    if (input.current) input.current.value = '';
  };

  const upload = async (file: File, crop: Crop) => {
    setBusy('upload');
    try {
      await uploadAvatar(await makeAvatar(file, crop));
      await refresh();
      forgetPicked();
      toast.success('Picture updated.', { id: 'avatar' });
    } catch (e) {
      toast.error(e instanceof AvatarError ? e.message : problem(e), { id: 'avatar' });
    } finally {
      setBusy(null);
    }
  };

  // Re-crop the current picture: it is fetched back and opened in the same dialog as a new one.
  const adjust = async () => {
    if (!profile.image) return;
    setBusy('load');
    try {
      const response = await request(profile.image);
      if (!response.ok) throw new AvatarError("Your picture couldn't be loaded. Try again.");
      const blob = await response.blob();
      setPicked(new File([blob], 'avatar', { type: blob.type }));
    } catch (e) {
      toast.error(e instanceof AvatarError ? e.message : problem(e), { id: 'avatar' });
    } finally {
      setBusy(null);
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
        <div ref={menu.rootRef} className={own.avatarBox}>
          <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={96} />
          <button
            type="button"
            className={own.editAvatar}
            aria-label="Edit picture"
            disabled={busy !== null}
            aria-busy={busy !== null || undefined}
            {...menu.triggerProps}
            {...(menu.open ? {} : tipProps(profile.image ? 'Change, crop or remove your picture' : 'Upload a picture', 'bottom', 'start'))}
          >
            {busy ? <span className={own.spinner} aria-hidden="true" /> : <Icon name="edit" size={16} />}
          </button>
          {menu.open && (
            <div {...menu.menuProps} aria-label="Picture" className={[menuStyles.menu, menuStyles.start].join(' ')}>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={menuStyles.item}
                onClick={() => {
                  menu.close();
                  input.current?.click();
                }}
              >
                <Icon name="image" size={18} />
                <span>{profile.image ? 'Change picture' : 'Upload a picture'}</span>
              </button>
              {profile.image && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={menuStyles.item}
                  onClick={() => {
                    menu.close();
                    void adjust();
                  }}
                >
                  <Icon name="crop" size={18} />
                  <span>Adjust crop</span>
                </button>
              )}
              {profile.image && (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={[menuStyles.item, menuStyles.danger].join(' ')}
                  onClick={() => {
                    menu.close();
                    void remove();
                  }}
                >
                  <Icon name="trash" size={18} />
                  <span>Remove picture</span>
                </button>
              )}
            </div>
          )}
          <input
            ref={input}
            type="file"
            accept={AVATAR_ACCEPT}
            className={own.fileInput}
            onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        <AvatarCropDialog
          file={picked}
          busy={busy === 'upload'}
          onCancel={forgetPicked}
          onSave={(crop) => picked && void upload(picked, crop)}
          onError={(message) => {
            forgetPicked();
            toast.error(message, { id: 'avatar' });
          }}
        />
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
          Cards and board
        </h2>
        <p>
          The design of the cards in your hand and how the board looks. Only you see them, and you can change them any
          time, also from the game menu in the middle of a game. They are saved to your account, so they follow you to
          every device.
        </p>
      </header>
      <DeckPicker />
      <h3 className={own.subtitle}>Board cells</h3>
      <BoardStylePicker />
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
