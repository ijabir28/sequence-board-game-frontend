import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendStatus, inviteToTable } from '../api/friends';
import { errorMessage } from '../api/http';
import { isSeated, type Room } from '../api/rooms';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import { useFriends } from '../friends/FriendsContext';
import styles from './Forms.module.css';
import own from './FriendsPage.module.css';

/**
 * Asks friends to this table: each invited friend gets a message with a link to it, and sees it under Table
 * invitations on their friends page until they sit down or dismiss it. Online friends first.
 */
export function InviteFriendsDialog({ open, onClose, room }: { open: boolean; onClose: () => void; room: Room }) {
  const { overview, refresh } = useFriends();
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    // Who is online changes; read the list again each time the dialog opens.
    void refresh();
  }, [open, refresh]);

  const friends = [...(overview?.friends ?? [])].sort((a, b) => Number(b.online) - Number(a.online));

  const invite = async (handle: string) => {
    setBusy(handle);
    setError(null);
    try {
      await inviteToTable(room.id, handle);
      setInvited((prev) => new Set(prev).add(handle));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite friends"
      actions={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className={styles.help}>Your friends get a message with a link to “{room.name}”, to take one of its open seats.</p>
      {error && (
        <p className={styles.error} role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </p>
      )}
      {overview === null && (
        <p className={styles.help} role="status">
          Loading your friends…
        </p>
      )}
      {overview !== null && friends.length === 0 && (
        <p className={styles.help}>
          You haven't added any friends yet. <Link to="/friends">Find players to add</Link>, or share the room's code.
        </p>
      )}
      {friends.length > 0 && (
        <ul className={[own.list, own.inviteList].join(' ')} aria-label="Your friends">
          {friends.map((friend) => {
            const seated = isSeated(room, friend.handle);
            const done = invited.has(friend.handle);
            return (
              <li key={friend.handle} className={own.row}>
                <span className={own.avatar}>
                  <Avatar name={friend.name} handle={friend.handle} image={friend.image} size={36} />
                  <span className={[own.presence, friend.online && own.online, friend.away && own.away].filter(Boolean).join(' ')} aria-hidden="true" />
                </span>
                <span className={own.who}>
                  <span className={own.name}>{friend.name}</span>
                  <span className={own.handle}>
                    @{friend.handle} · {friendStatus(friend)}
                  </span>
                </span>
                <span className={own.actions}>
                  {seated ? (
                    <span className={own.tag}>In this room</span>
                  ) : done ? (
                    <span className={own.tag}>
                      <Icon name="check" size={16} />
                      Invited
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      busy={busy === friend.handle}
                      disabled={busy !== null}
                      onClick={() => void invite(friend.handle)}
                      tip={`Send ${friend.name} a link to this room`}
                    >
                      Invite
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
