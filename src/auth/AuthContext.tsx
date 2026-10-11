import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signIn as apiSignIn, type Profile } from '../api/user';

// The backend has no sign-out and the session cookie is HttpOnly, so the app can't ask
// "am I signed in?" without risking GET /user/profile (which crashes the server with no
// session). The profile from the last successful sign-in is remembered locally instead.

const STORAGE_KEY = 'sequence.profile';

interface AuthValue {
  profile: Profile | null;
  signIn: (handle: string, password: string) => Promise<Profile>;
  /** Forgets the profile on this device. The server session simply expires (1 hour). */
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Profile) : null;
    return parsed?.handle ? { handle: parsed.handle, name: parsed.name } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);

  const signIn = useCallback(async (handle: string, password: string) => {
    const next = await apiSignIn(handle, password);
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode); the session still works for this tab.
    }
    return next;
  }, []);

  const signOut = useCallback(() => {
    setProfile(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ profile, signIn, signOut }), [profile, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** Sends signed-out visitors to /signin and brings them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  if (!profile) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
