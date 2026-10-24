import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  acceptFriendRequest,
  deleteFriendRequest,
  dismissInvitation,
  friendStatus,
  removeFriend,
  searchPlayers,
  sendFriendRequest,
  SEARCH_MIN_LENGTH,
  type Friend,
  type Player,
  type SearchResult,
} from '../api/friends';
import { errorMessage } from '../api/http';
import { AppHeader } from '../components/AppHeader';
import { Avatar } from '../components/Avatar';
import { BackToDashboard } from '../components/BackToDashboard';
import { PoweredBy } from '../components/PoweredBy';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { useFriends } from '../friends/FriendsContext';
import styles from './Forms.module.css';
import own from './FriendsPage.module.css';

/** How long typing must pause before a search is sent. */
const SEARCH_DELAY_MS = 300;
const NOTICE_TOAST = 'friends-notice';

type Search =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'error'; query: string; message: string }
  | { status: 'ready'; query: string; players: SearchResult[] };

/**
 * Friends: find players by name or username and ask them, answer requests and table invitations, and see who is
 * online or playing. Friends can be invited to a table from its page, and the leaderboard ranks you among them.
 */
export function FriendsPage() {
  const { overview, refresh } = useFriends();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>({ status: 'idle' });

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setSearch({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setSearch({ status: 'loading', query: trimmed });
    const timer = setTimeout(() => {
      searchPlayers(trimmed)
        .then((players) => !cancelled && setSearch({ status: 'ready', query: trimmed, players }))
        .catch((e) => !cancelled && setSearch({ status: 'error', query: trimmed, message: errorMessage(e) }));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Runs an action on a row (`key` marks it busy), then reads the list again, and the search's answers too.
  const act = async (key: string, action: () => Promise<string | void>) => {
    setBusy(key);
    toast.dismiss(NOTICE_TOAST);
    try {
      const done = await action();
      if (done) toast.success(done, { id: NOTICE_TOAST });
      await refresh();
      if (search.status === 'ready') {
        const players = await searchPlayers(search.query).catch(() => null);
        if (players) setSearch({ status: 'ready', query: search.query, players });
      }
    } catch (e) {
      toast.error(errorMessage(e), { id: NOTICE_TOAST });
    } finally {
      setBusy(null);
    }
  };

  const add = (player: Player) =>
    act(`add-${player.handle}`, async () =>
      (await sendFriendRequest(player.handle)) === 'friends'
        ? `You and ${player.name} are now friends.`
        : `Request sent. ${player.name} will see it next time they look.`,
    );
  const accept = (player: Player) =>
    act(`accept-${player.handle}`, async () => {
      await acceptFriendRequest(player.handle);
      return `You and ${player.name} are now friends.`;
    });
  const decline = (player: Player, mine: boolean) =>
    act(`decline-${player.handle}`, async () => {
      await deleteFriendRequest(player.handle);
      return mine ? `Request to ${player.name} cancelled.` : undefined;
    });
  const unfriend = (friend: Friend) => {
    if (!window.confirm(`Remove ${friend.name} from your friends? You'll stop seeing each other on the leaderboard.`)) return;
    void act(`remove-${friend.handle}`, async () => {
      await removeFriend(friend.handle);
      return `${friend.name} is no longer your friend.`;
    });
  };

  const loading = overview === null;
  const friends = overview?.friends ?? [];
  const incoming = overview?.incoming ?? [];
  const outgoing = overview?.outgoing ?? [];
  const invitations = overview?.invitations ?? [];
  const online = friends.filter((f) => f.online).length;

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <BackToDashboard className={own.back} tip="Go back to the dashboard: your rooms and games" />
        <section className={[styles.card, styles.wide, own.card].join(' ')} aria-labelledby="friends-title">
          <header className={styles.header}>
            <h1 id="friends-title" className={own.title}>
              <Icon name="users" size={26} />
              Friends
            </h1>
            <p>
              Add the people you play with. You can invite friends straight to your room, and the{' '}
              <Link to="/leaderboard">leaderboard</Link> ranks you among them.
            </p>
          </header>

          <div className={own.searchBox}>
            <label className={styles.field}>
              <span className={styles.label}>Find a player</span>
              <input
                className={styles.input}
                type="search"
                value={query}
                maxLength={50}
                placeholder="Name or username"
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH && (
              <p className={styles.help}>Type at least {SEARCH_MIN_LENGTH} letters.</p>
            )}
            {search.status === 'loading' && (
              <p className={styles.help} role="status">
                Searching…
              </p>
            )}
            {search.status === 'error' && (
              <p className={styles.error} role="alert">
                <Icon name="alert" size={18} />
                <span>{search.message}</span>
              </p>
            )}
            {search.status === 'ready' && search.players.length === 0 && (
              <p className={styles.help}>Nobody called “{search.query}”. Check the spelling, or ask them for their username.</p>
            )}
            {search.status === 'ready' && search.players.length > 0 && (
              <ul className={own.list} aria-label="Players found">
                {search.players.map((player) => (
                  <PlayerRow key={player.handle} player={player}>
                    <SearchAction
                      player={player}
                      busy={busy}
                      onAdd={() => void add(player)}
                      onAccept={() => void accept(player)}
                      onCancel={() => void decline(player, true)}
                    />
                  </PlayerRow>
                ))}
              </ul>
            )}
          </div>

          {invitations.length > 0 && (
            <Section title="Room invitations" count={invitations.length}>
              <ul className={own.list}>
                {invitations.map((invitation) => (
                  <PlayerRow
                    key={invitation.roomId}
                    player={invitation.from}
                    detail={`Invited you to “${invitation.roomName}” · ${invitation.seatsTaken}/${invitation.seats} seats taken`}
                  >
                    <Button size="sm" variant="primary" onClick={() => navigate(`/table/${invitation.roomId}`)} tip="Open the room and take a seat">
                      Join
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={busy === `dismiss-${invitation.roomId}`}
                      disabled={busy !== null}
                      onClick={() => void act(`dismiss-${invitation.roomId}`, () => dismissInvitation(invitation.roomId))}
                      tip="You won't come: remove this invitation"
                    >
                      Dismiss
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            </Section>
          )}

          {incoming.length > 0 && (
            <Section title="Friend requests" count={incoming.length}>
              <ul className={own.list}>
                {incoming.map((request) => (
                  <PlayerRow key={request.handle} player={request} detail="Wants to be your friend">
                    <Button
                      size="sm"
                      variant="primary"
                      busy={busy === `accept-${request.handle}`}
                      disabled={busy !== null}
                      onClick={() => void accept(request)}
                      tip={`Become friends with ${request.name}`}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={busy === `decline-${request.handle}`}
                      disabled={busy !== null}
                      onClick={() => void decline(request, false)}
                      tip="Say no. They aren't told; they just stop seeing the request as waiting."
                    >
                      Decline
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Your friends" count={friends.length} note={friends.length > 0 ? `${online} online` : undefined}>
            {loading && (
              <p className={styles.help} role="status">
                Loading your friends…
              </p>
            )}
            {!loading && friends.length === 0 && (
              <p className={styles.help}>No friends yet. Find the people you play with above and send them a request.</p>
            )}
            {friends.length > 0 && (
              <ul className={own.list}>
                {friends.map((friend) => (
                  <PlayerRow key={friend.handle} player={friend} status={friend}>
                    {/* Only when the friend has turned on "Friends can watch my games" in their profile. */}
                    {friend.watch && (
                      <Link to={`/watch/${friend.watch}`} className={own.linkButton} {...tipProps(`Watch ${friend.name}'s game live`)}>
                        <Icon name="eye" size={16} />
                        Watch
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={busy === `remove-${friend.handle}`}
                      disabled={busy !== null}
                      onClick={() => unfriend(friend)}
                      aria-label={`Remove ${friend.name} from your friends`}
                      tip="Remove from your friends"
                    >
                      <Icon name="trash" size={16} />
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            )}
          </Section>

          {outgoing.length > 0 && (
            <Section title="Sent requests" count={outgoing.length}>
              <ul className={own.list}>
                {outgoing.map((request) => (
                  <PlayerRow key={request.handle} player={request} detail="Waiting for an answer">
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={busy === `decline-${request.handle}`}
                      disabled={busy !== null}
                      onClick={() => void decline(request, true)}
                      tip="Take the request back"
                    >
                      Cancel
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            </Section>
          )}
        </section>
        <PoweredBy />
      </div>
    </>
  );
}

function Section({ title, count, note, children }: { title: string; count: number; note?: string; children: ReactNode }) {
  return (
    <section className={own.section} aria-label={title}>
      <h2 className={own.sectionTitle}>
        {title}
        <span className={own.count}>{count}</span>
        {note && <span className={own.note}>{note}</span>}
      </h2>
      {children}
    </section>
  );
}

function PlayerRow({
  player,
  detail,
  status,
  children,
}: {
  player: Player;
  detail?: string;
  status?: Friend;
  children?: ReactNode;
}) {
  return (
    <li className={own.row}>
      <span className={own.avatar}>
        <Avatar name={player.name} handle={player.handle} image={player.image} size={40} />
        {status && <span className={[own.presence, status.online && own.online, status.away && own.away].filter(Boolean).join(' ')} aria-hidden="true" />}
      </span>
      <span className={own.who}>
        <span className={own.name}>{player.name}</span>
        <span className={own.handle}>
          @{player.handle}
          {status && <> · {friendStatus(status)}</>}
          {detail && <> · {detail}</>}
        </span>
      </span>
      <span className={own.actions}>{children}</span>
    </li>
  );
}

function SearchAction({
  player,
  busy,
  onAdd,
  onAccept,
  onCancel,
}: {
  player: SearchResult;
  busy: string | null;
  onAdd: () => void;
  onAccept: () => void;
  onCancel: () => void;
}) {
  if (player.relationship === 'friends') {
    return (
      <span className={own.tag}>
        <Icon name="check" size={16} />
        Friends
      </span>
    );
  }
  if (player.relationship === 'incoming') {
    return (
      <Button size="sm" variant="primary" busy={busy === `accept-${player.handle}`} disabled={busy !== null} onClick={onAccept} tip={`${player.name} asked you: accept`}>
        Accept
      </Button>
    );
  }
  if (player.relationship === 'outgoing') {
    return (
      <Button size="sm" variant="ghost" busy={busy === `decline-${player.handle}`} disabled={busy !== null} onClick={onCancel} tip="Requested. Take the request back.">
        Requested
      </Button>
    );
  }
  return (
    <Button size="sm" variant="primary" busy={busy === `add-${player.handle}`} disabled={busy !== null} onClick={onAdd} tip={`Ask ${player.name} to be your friend`}>
      <Icon name="plus" size={16} />
      Add friend
    </Button>
  );
}
