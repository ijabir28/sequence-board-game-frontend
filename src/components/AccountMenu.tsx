import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Profile } from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { useMediaQuery } from '../game/useMediaQuery';
import { Avatar } from './Avatar';
import { PoweredBy } from './PoweredBy';
import { Drawer } from './ui/Drawer';
import { Icon, type IconName } from './ui/Icon';
import { tipProps } from './ui/TooltipLayer';
import { useMenu } from './ui/useMenu';
import menuStyles from './ui/Menu.module.css';
import styles from './AccountMenu.module.css';

type Item = { key: string; icon: IconName; label: string; tip: string } & ({ to: string } | { onSelect: () => void });

/** The account's places and actions, the same list in the desktop dropdown and the phone drawer. */
function useItems(): Item[] {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return [
    {
      key: 'profile',
      icon: 'user',
      label: 'Profile settings',
      tip: 'Your profile: picture, name, email, password and devices',
      to: '/profile',
    },
    {
      key: 'howto',
      icon: 'book',
      label: 'How to play',
      tip: 'The rules, step by step: sequences, jacks, dead cards and winning',
      to: '/how-to-play',
    },
    {
      key: 'signout',
      icon: 'exit',
      label: 'Sign out',
      tip: 'Sign out on this device. Your tables and games stay saved.',
      onSelect: () => void signOut().finally(() => navigate('/signin')),
    },
  ];
}

/** The signed-in player's picture and name. Opens a dropdown on wide screens and a side drawer on phones. */
export function AccountMenu({ profile }: { profile: Profile }) {
  const phone = useMediaQuery('(max-width: 600px)');
  return phone ? <AccountDrawer profile={profile} /> : <AccountDropdown profile={profile} />;
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
        {...(open ? {} : tipProps('Your account: profile settings, how to play and sign out', 'bottom', 'end'))}
      >
        <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={32} />
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
        {...tipProps('Your account: profile settings, how to play and sign out', 'bottom', 'end')}
      >
        <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={32} />
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
