import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFriends, type FriendsOverview } from '../api/friends';
import { getSocket, onFriendsUpdated, onTableInvitation, reconnectSocket } from '../api/socket';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/toast/Toaster';

// The signed-in player's friends, requests and table invitations, kept for every page: the friends page lists them,
// the account menu counts what's waiting, and a table page offers its friends an invitation. The server says when
// something changed (`friends_updated`, on this player's own sockets), and the list is read again; also on
// reconnecting and on coming back to the tab, in case a message was missed while offline.

interface FriendsValue {
  /** null until loaded (or when signed out). */
  overview: FriendsOverview | null;
  /** Requests and invitations waiting for an answer. */
  waiting: number;
  refresh: () => Promise<void>;
}

const FriendsContext = createContext<FriendsValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const handle = profile === undefined ? undefined : (profile?.handle ?? null);
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const toast = useToast();
  // useNavigate() changes with every page; the ref keeps the effects below from re-running on each one.
  const navigateNow = useNavigate();
  const navigateRef = useRef(navigateNow);
  navigateRef.current = navigateNow;
  const navigate = useCallback((to: string) => navigateRef.current(to), []);
  // Who asked before the latest read, so a new request is announced once. null until the first read.
  const seenRequests = useRef<Set<string> | null>(null);

  // The socket says who it is when it connects; after signing in or out it connects again (see reconnectSocket).
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (previous.current !== undefined && previous.current !== handle) reconnectSocket();
    previous.current = handle;
  }, [handle]);

  const refresh = useCallback(async () => {
    if (!handle) return;
    const next = await getFriends().catch(() => null);
    if (!next) return;
    setOverview(next);
    const seen = seenRequests.current;
    if (seen !== null) {
      const fresh = next.incoming.filter((request) => !seen.has(request.handle));
      if (fresh.length === 1) {
        toast.info(`${fresh[0].name} wants to be your friend.`, {
          id: 'friend-request',
          action: { label: 'View', onClick: () => navigate('/friends') },
        });
      } else if (fresh.length > 1) {
        toast.info(`${fresh.length} players want to be your friend.`, {
          id: 'friend-request',
          action: { label: 'View', onClick: () => navigate('/friends') },
        });
      }
    }
    seenRequests.current = new Set(next.incoming.map((request) => request.handle));
  }, [handle, toast, navigate]);

  useEffect(() => {
    setOverview(null);
    seenRequests.current = null;
    if (!handle) return;
    void refresh();
    const s = getSocket();
    const onConnect = () => void refresh();
    s.on('connect', onConnect);
    const stopUpdates = onFriendsUpdated(() => void refresh());
    const stopInvitations = onTableInvitation((event) => {
      toast.info(`${event.fromName} invited you to their table “${event.roomName}”.`, {
        id: `invitation-${event.roomId}`,
        durationMs: 12000,
        action: { label: 'Join', onClick: () => navigate(`/table/${event.roomId}`) },
      });
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      s.off('connect', onConnect);
      stopUpdates();
      stopInvitations();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [handle, refresh, toast, navigate]);

  const waiting = overview ? overview.incoming.length + overview.invitations.length : 0;
  const value = useMemo(() => ({ overview, waiting, refresh }), [overview, waiting, refresh]);
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends(): FriendsValue {
  const value = useContext(FriendsContext);
  if (!value) throw new Error('useFriends must be used inside FriendsProvider');
  return value;
}
