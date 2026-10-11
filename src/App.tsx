import { Navigate, Route, Routes } from 'react-router-dom';
import { LocalGamePage } from './screens/LocalGamePage';

// SPA routes must not start with a proxied backend prefix (/user, /room, /game, /board, /images).
export function App() {
  return (
    <Routes>
      <Route path="/local" element={<LocalGamePage />} />
      <Route path="*" element={<Navigate to="/local" replace />} />
    </Routes>
  );
}
