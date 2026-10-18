import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Profile } from '../api/user';
import { useAuth } from '../auth/AuthContext';
import { useMediaQuery } from '../game/useMediaQuery';
import { Avatar } from './Avatar';
import { Drawer } from './ui/Drawer';
import { Icon, type IconName } from './ui/Icon';
import { tipProps } from './ui/TooltipLayer';
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
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const entries = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  // Opening moves focus to the first entry; a press anywhere outside closes the menu.
  useEffect(() => {
    if (!open) return;
    entries()[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const list = entries();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        {...(open ? {} : tipProps('Your account: profile settings and sign out', 'bottom', 'end'))}
      >
        <Avatar name={profile.name} handle={profile.handle} image={profile.image} size={32} />
        <span className={styles.name}>{profile.name}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className={styles.caret} />
      </button>
      {open && (
        <div ref={menu} id={menuId} role="menu" aria-label="Account" className={styles.menu} onKeyDown={onMenuKeyDown}>
          <div className={styles.menuHeader} role="presentation">
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
            const className = [styles.menuItem, item.key === 'signout' && styles.signOut].filter(Boolean).join(' ');
            return 'to' in item ? (
              <Link
                key={item.key}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                className={className}
                aria-current={pathname === item.to ? 'page' : undefined}
                onClick={() => setOpen(false)}
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
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {content}
              </button>
            );
          })}
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
        {...tipProps('Your account: profile settings and sign out', 'bottom', 'end')}
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
      </Drawer>
    </>
  );
}
