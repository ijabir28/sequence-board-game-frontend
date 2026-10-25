import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendStatus, getInviteStatus, inviteToTable, type InviteStatus } from '../api/friends';
import { errorMessage } from '../api/http';
import { isSeated, type Room } from '../api/rooms';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { useFriends } from '../friends/FriendsContext';
import styles from './Forms.module.css';
import own from './FriendsPage.module.css';

/** "10 s", "4 min", "1 h 20 min": how long until `at`, rounded up (to the second under a minute). */
export function waitLabel(at: string, now: number): string {
  const seconds = Math.max(1, Math.ceil((Date.parse(at) - now) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} min` : minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

/**
 * Asks friends to this table: each invited friend gets a message with a link to it, and sees it under Table
 * invitations on their friends page until they sit down or dismiss it. Online friends first. A friend who dismissed
 * an invitation here can be asked again only after a wait that grows each time, and not at all after five re-invites;
 * one the host removed can be invited back by the host.
 */
export function InviteFriendsDialog({ open, onClose, room, host }: { open: boolean; onClose: () => void; room: Room; host: boolean }) {
  const { overview, refresh } = useFriends();
  // Sent from here, until the room (which lists who is invited) catches up.
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<InviteStatus>({ dismissed: [], removed: [] });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    getInviteStatus(room.id)
      .then(setStatus)
      .catch(() => setStatus({ dismissed: [], removed: [] }));
  }, [room.id]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    // Who is online changes; read the list again each time the dialog opens.
    void refresh();
    loadStatus();
    // Waits count down while the dialog is open; the shortest are seconds long.
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, refresh, loadStatus]);

  // The room says who is invited now: someone who dismissed theirs, or was removed, can be asked again.
  useEffect(() => {
    setInvited(new Set());
    if (open) loadStatus();
  }, [room.invited, room.standing, open, loadStatus]);

  const friends = [...(overview?.friends ?? [])].sort((a, b) => Number(b.online) - Number(a.online));

  const invite = async (handle: string) => {
    setBusy(handle);
    setError(null);
    try {
      await inviteToTable(room.id, handle);
      setInvited((prev) => new Set(prev).add(handle));
    } catch (e) {
      setError(errorMessage(e));
      loadStatus();
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
          You haven't added any friends yet. <Link to="/friends">Find players to add</Link>, or share the table's code.
        </p>
      )}
      {friends.length > 0 && (
        <ul className={[own.list, own.inviteList].join(' ')} aria-label="Your friends">
          {friends.map((friend) => {
            const atTable = isSeated(room, friend.handle) || room.standing.some((p) => p.handle === friend.handle);
            const done = invited.has(friend.handle) || room.invited.some((p) => p.handle === friend.handle);
            const removed = status.removed.includes(friend.handle);
            const dismissed = status.dismissed.find((d) => d.handle === friend.handle);
            const waitUntil = dismissed?.retryAt && Date.parse(dismissed.retryAt) > now ? dismissed.retryAt : null;
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
                  {atTable ? (
                    <span className={own.tag}>At this table</span>
                  ) : done ? (
                    <span className={own.tag}>
                      <Icon name="check" size={16} />
                      Invited
                    </span>
                  ) : dismissed?.limitReached ? (
                    <span className={own.mutedTag} {...tipProps(`${friend.name} turned down every invitation to this table, so it can't be sent again`)}>
                      Turned down
                    </span>
                  ) : waitUntil ? (
                    <span className={own.mutedTag} {...tipProps(`${friend.name} turned down an invitation to this table. Each time, the wait before asking again grows.`)}>
                      Ask again in {waitLabel(waitUntil, now)}
                    </span>
                  ) : removed && host ? (
                    <Button
                      size="sm"
                      variant="primary"
                      busy={busy === friend.handle}
                      disabled={busy !== null}
                      onClick={() => void invite(friend.handle)}
                      tip={`You removed ${friend.name} from this table. Inviting them back lets them sit down again.`}
                    >
                      Invite back
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      busy={busy === friend.handle}
                      disabled={busy !== null}
                      onClick={() => void invite(friend.handle)}
                      tip={`Send ${friend.name} a link to this table`}
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
