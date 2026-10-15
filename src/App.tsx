import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, SessionCheck, useAuth } from './auth/AuthContext';
import { ToastProvider } from './components/toast/Toaster';
import { TooltipLayer } from './components/ui/TooltipLayer';
import { LocalGamePage } from './screens/LocalGamePage';
import { Lobby } from './screens/Lobby';
import { RoomGamePage } from './screens/RoomGamePage';
import { RoomPage } from './screens/RoomPage';
import { ServerGamePage } from './screens/ServerGamePage';
import { SignIn } from './screens/SignIn';
import { SignUp } from './screens/SignUp';

// SPA routes must not start with a proxied backend prefix (/user, /room, /game, /board, /images).
export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
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
