import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, SessionCheck, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/toast/Toaster';
import { TooltipLayer } from './components/ui/TooltipLayer';
import { FriendsProvider } from './friends/FriendsContext';
import { Lobby } from './screens/Lobby';
import { SignIn } from './screens/SignIn';
import { SignUp } from './screens/SignUp';
import { UpdateNotice } from './pwa/UpdateNotice';

// The pages a visit starts on (signing in, the lobby) are in the main bundle; the rest load when first opened, so the
// first page doesn't wait for the game screen, the training or the profile editor. The service worker caches every
// chunk, so after the first visit they open at once, offline too.
const LocalGamePage = lazy(() => import('./screens/LocalGamePage').then((m) => ({ default: m.LocalGamePage })));
const QuickMatchPage = lazy(() => import('./screens/QuickMatchPage').then((m) => ({ default: m.QuickMatchPage })));
const FriendsPage = lazy(() => import('./screens/FriendsPage').then((m) => ({ default: m.FriendsPage })));
const LeaderboardPage = lazy(() => import('./screens/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('./screens/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const RoomGamePage = lazy(() => import('./screens/RoomGamePage').then((m) => ({ default: m.RoomGamePage })));
const WatchGamePage = lazy(() => import('./screens/WatchGamePage').then((m) => ({ default: m.WatchGamePage })));
const RoomPage = lazy(() => import('./screens/RoomPage').then((m) => ({ default: m.RoomPage })));
const EmailVerified = lazy(() => import('./screens/EmailVerified').then((m) => ({ default: m.EmailVerified })));
const HowToPlay = lazy(() => import('./screens/HowToPlay').then((m) => ({ default: m.HowToPlay })));
const ForgotPassword = lazy(() => import('./screens/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./screens/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const ServerGamePage = lazy(() => import('./screens/ServerGamePage').then((m) => ({ default: m.ServerGamePage })));
const TrainingPage = lazy(() => import('./tutorial/TrainingPage').then((m) => ({ default: m.TrainingPage })));

// SPA routes must not start with a proxied backend prefix (/api/, /user/, /room/, /game/, /board/, /images/,
// /matchmaking/, /friends/). Bare /friends is the friends page: the backend answers nothing there but the app.
export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FriendsProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            {/* Emailed links land on these two (the backend's auth.js names the paths). */}
            <Route path="/email-verified" element={<EmailVerified />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/lobby"
              element={
                <RequireAuth>
                  <Lobby />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/quick-match"
              element={
                <RequireAuth>
                  <QuickMatchPage />
                </RequireAuth>
              }
            />
            <Route
              path="/friends"
              element={
                <RequireAuth>
                  <FriendsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <RequireAuth>
                  <LeaderboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/table/:id"
              element={
                <RequireAuth>
                  <RoomPage />
                </RequireAuth>
              }
            />
            <Route
              path="/table/:id/game"
              element={
                <RequireAuth>
                  <RoomGamePage />
                </RequireAuth>
              }
            />
            {/* Spectators: anyone with the link may watch a table's game live, without signing in. */}
            <Route path="/watch/:id" element={<WatchGamePage />} />
            <Route
              path="/server-game"
              element={
                <RequireAuth>
                  <ServerGamePage />
                </RequireAuth>
              }
            />
            <Route path="/how-to-play" element={<HowToPlay />} />
            <Route path="/how-to-play/training" element={<TrainingPage />} />
            <Route path="/local" element={<LocalGamePage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
        </FriendsProvider>
      </AuthProvider>
      <TooltipLayer />
      <UpdateNotice />
    </ToastProvider>
  );
}

function Home() {
  const { profile } = useAuth();
  if (profile === undefined) return <SessionCheck />;
  return <Navigate to={profile ? '/lobby' : '/signin'} replace />;
}
