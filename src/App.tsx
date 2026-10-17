import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, SessionCheck, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/toast/Toaster';
import { TooltipLayer } from './components/ui/TooltipLayer';
import { LocalGamePage } from './screens/LocalGamePage';
import { Lobby } from './screens/Lobby';
import { RoomGamePage } from './screens/RoomGamePage';
import { RoomPage } from './screens/RoomPage';
import { EmailVerified } from './screens/EmailVerified';
import { ForgotPassword } from './screens/ForgotPassword';
import { ResetPassword } from './screens/ResetPassword';
import { ServerGamePage } from './screens/ServerGamePage';
import { SignIn } from './screens/SignIn';
import { SignUp } from './screens/SignUp';

// SPA routes must not start with a proxied backend prefix (/api, /user, /room, /game, /board, /images).
export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
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
          <Route
            path="/server-game"
            element={
              <RequireAuth>
                <ServerGamePage />
              </RequireAuth>
            }
          />
          <Route path="/local" element={<LocalGamePage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
      <TooltipLayer />
    </ToastProvider>
  );
}

function Home() {
  const { profile } = useAuth();
  if (profile === undefined) return <SessionCheck />;
  return <Navigate to={profile ? '/lobby' : '/signin'} replace />;
}
