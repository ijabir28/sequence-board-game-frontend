import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Profile } from '../api/user';
import { useInstallOption } from '../pwa/install';
import { useAuth } from '../auth/AuthContext';
import { useFriends } from '../friends/FriendsContext';
import { useMediaQuery } from '../game/useMediaQuery';
import { Avatar } from './Avatar';
import { PoweredBy } from './PoweredBy';
import { useToast } from './toast/Toaster';
import { Drawer } from './ui/Drawer';
import { Icon, type IconName } from './ui/Icon';
import { tipProps } from './ui/TooltipLayer';
import { useMenu } from './ui/useMenu';
import menuStyles from './ui/Menu.module.css';
import styles from './AccountMenu.module.css';

/** `badge`: how many things wait there for an answer, shown as a count. */
type Item = { key: string; icon: IconName; label: string; tip: string; badge?: number } & ({ to: string } | { onSelect: () => void });

/** The account's places and actions, the same list in the desktop dropdown and the phone drawer. */
function useItems(): Item[] {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const install = useInstallOption();
  const { waiting } = useFriends();
  const installItem: Item[] = !install
    ? []
    : [
        {
          key: 'install',
          icon: 'download',
          label: 'Install app',
          tip: 'Add Sequence to your home screen or desktop, to open in its own window and play hot-seat offline',
          onSelect:
            install.kind === 'prompt'
              ? () => void install.install()
              : () => toast.info(install.steps, { id: 'install-ios', durationMs: 10000 }),
        },
      ];
  return [
    {
      key: 'profile',
      icon: 'user',
      label: 'Profile settings',
      tip: 'Your profile: picture, name, email, password and devices',
      to: '/profile',
    },
    {
      key: 'friends',
      icon: 'users',
      label: 'Friends',
      tip: waiting > 0 ? `Friends: ${waiting} request${waiting === 1 ? '' : 's'} or invitation${waiting === 1 ? '' : 's'} waiting` : 'Find players, add friends and invite them to your tables',
      to: '/friends',
      badge: waiting,
    },
    {
      key: 'leaderboard',
      icon: 'trophy',
      label: 'Leaderboard',
      tip: 'How you rank among your friends: ratings, wins and win rates, all time, this week and today',
      to: '/leaderboard',
    },
    {
      key: 'howto',
      icon: 'book',
      label: 'How to play',
      tip: 'The rules, step by step: sequences, jacks, dead cards and winning',
      to: '/how-to-play',
    },
    ...installItem,
    {
      key: 'signout',
      icon: 'exit',
      label: 'Sign out',
      tip: 'Sign out on this device. Your rooms and games stay saved.',
      onSelect: () => void signOut().finally(() => navigate('/signin')),
    },
  ];
}

/** The signed-in player's picture and name. Opens a dropdown on wide screens and a side drawer on phones. */
export function AccountMenu({ profile }: { profile: Profile }) {
  const phone = useMediaQuery('(max-width: 600px)');
  return phone ? <AccountDrawer profile={profile} /> : <AccountDropdown profile={profile} />;
}

/** A count of what's waiting, or nothing. */
function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className={styles.badge} aria-label={`${count} waiting`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

/** A dot on the menu's button while something waits inside. */
function WaitingDot() {
  const { waiting } = useFriends();
  if (waiting === 0) return null;
  return <span className={styles.dot} aria-label={`${waiting} friend request${waiting === 1 ? '' : 's'} or invitation${waiting === 1 ? '' : 's'} waiting`} />;
}

function AccountDropdown({ profile }: { profile: Profile }) {
  const items = useItems();
  const { pathname } = useLocation();
  const { open, close, rootRef, triggerProps, menuProps } = useMenu();

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        {...triggerProps}
        {...(open ? {} : tipProps('Your account: profile settings, friends, leaderboard, how to play and sign out', 'bottom', 'end'))}
      >
        <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={32} />
        <WaitingDot />
        <span className={styles.name}>{profile.name}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className={styles.caret} />
      </button>
      {open && (
        <div {...menuProps} aria-label="Account" className={menuStyles.menu}>
          <div className={menuStyles.header} role="presentation">
            <strong>{profile.name}</strong>
            <span>@{profile.handle}</span>
          </div>
          {items.map((item) => {
            const content = (
              <>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                <Badge count={item.badge} />
              </>
            );
            const className = [menuStyles.item, item.key === 'signout' && menuStyles.danger].filter(Boolean).join(' ');
            return 'to' in item ? (
              <Link
                key={item.key}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                className={className}
                aria-current={pathname === item.to ? 'page' : undefined}
                onClick={close}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={className}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {content}
              </button>
            );
          })}
          <PoweredBy className={styles.menuCredit} />
        </div>
      )}
    </div>
  );
}

function AccountDrawer({ profile }: { profile: Profile }) {
  const items = useItems();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={[styles.trigger, styles.avatarOnly].join(' ')}
        aria-label={`Account menu for ${profile.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        {...tipProps('Your account: profile settings, friends, leaderboard, how to play and sign out', 'bottom', 'end')}
      >
        <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={32} />
        <WaitingDot />
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className={styles.drawerTitle}>
            <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={36} />
            <span>
              <strong>{profile.name}</strong>
              <small>@{profile.handle}</small>
            </span>
          </span>
        }
      >
        {items.map((item) => {
          const content = (
            <>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <Badge count={item.badge} />
            </>
          );
          const className = [styles.drawerItem, item.key === 'signout' && styles.drawerSignOut].filter(Boolean).join(' ');
          return 'to' in item ? (
            <Link
              key={item.key}
              to={item.to}
              className={className}
              aria-current={pathname === item.to ? 'page' : undefined}
              onClick={() => setOpen(false)}
              {...tipProps(item.tip)}
            >
              {content}
            </Link>
          ) : (
            <button
              key={item.key}
              type="button"
              className={className}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              {...tipProps(item.tip)}
            >
              {content}
            </button>
          );
        })}
        <PoweredBy className={styles.drawerCredit} />
      </Drawer>
    </>
  );
}
