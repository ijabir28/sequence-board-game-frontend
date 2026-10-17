import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onSignedInElsewhere } from '../api/socket';
import { getProfile, signIn as apiSignIn, signOut as apiSignOut, signUp as apiSignUp, type Profile } from '../api/user';
import { useToast } from '../components/toast/Toaster';
import styles from '../screens/Forms.module.css';

// The session cookie is HttpOnly, so the app asks the server who is signed in (GET /user/profile)
// when it loads, and keeps the answer here.

interface AuthValue {
  /** undefined while the first check is running, null when signed out. */
  profile: Profile | null | undefined;
  signIn: (handle: string, password: string) => Promise<Profile>;
  /** Creates the account; it signs in only after its email is confirmed. */
  signUp: (handle: string, name: string, email: string, password: string) => Promise<void>;
  /** Asks the server again who is signed in, e.g. after an emailed link signed the player in. */
  refresh: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const SIGNED_IN_ELSEWHERE = 'You were signed out here because your account signed in on another device.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getProfile()
      // Server unreachable: show the sign-in page, which explains that when the user tries.
      .catch(() => null)
      .then((current) => {
        if (!cancelled) setProfile(current);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // An account is signed in on one device at a time: signing in elsewhere ends this session on the server. The server
  // announces it, and this page checks its own session (the announcement is public, so it isn't trusted on its own).
  // Coming back to the tab checks again, in case the announcement was missed while offline.
  const toast = useToast();
  const handle = profile?.handle ?? null;
  useEffect(() => {
    if (handle === null) return;
    const check = async (elsewhere: boolean) => {
      // A network failure isn't a sign-out: keep the session until the server says otherwise.
      const current = await getProfile().catch(() => undefined);
      if (current !== null) return;
      setProfile(null);
      if (elsewhere) toast.info(SIGNED_IN_ELSEWHERE, { id: 'session' });
    };
    const stop = onSignedInElsewhere((who) => {
      if (who === handle) void check(true);
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [handle, toast]);

  const signIn = useCallback(async (handle: string, password: string) => {
    const next = await apiSignIn(handle, password);
    setProfile(next);
    return next;
  }, []);

  const signUp = useCallback(async (handle: string, name: string, email: string, password: string) => {
    await apiSignUp(handle, name, email, password);
  }, []);

  const refresh = useCallback(async () => {
    const next = await getProfile().catch(() => null);
    setProfile(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      // Even if the server can't be reached, this device stops acting as the user.
      setProfile(null);
    }
  }, []);

  const value = useMemo(() => ({ profile, signIn, signUp, refresh, signOut }), [profile, signIn, signUp, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** Shown while the app asks the server whether there is a session. */
export function SessionCheck() {
  return (
    <div className={styles.page}>
      <p className={styles.help} role="status">
        Checking your session…
      </p>
    </div>
  );
}

/** Sends signed-out visitors to /signin and brings them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  if (profile === undefined) return <SessionCheck />;
  if (!profile) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
