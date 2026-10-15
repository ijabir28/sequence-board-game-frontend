import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth, SessionCheck, useAuth } from './auth/AuthContext';
import { LocalGamePage } from './screens/LocalGamePage';
import { Lobby } from './screens/Lobby';
import { RoomGamePage } from './screens/RoomGamePage';
import { RoomPage } from './screens/RoomPage';
import { ServerGamePage } from './screens/ServerGamePage';
import { SignIn } from './screens/SignIn';

// SPA routes must not start with a proxied backend prefix (/user, /room, /game, /board, /images).
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
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
  );
}

function Home() {
  const { profile } = useAuth();
  if (profile === undefined) return <SessionCheck />;
  return <Navigate to={profile ? '/lobby' : '/signin'} replace />;
}
