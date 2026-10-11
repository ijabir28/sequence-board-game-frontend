import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DevAdapterToggle } from '../components/game/DevAdapterToggle';
import { GameScreen } from '../components/game/GameScreen';
import { RemoteGameAdapter } from '../game/remote/RemoteGameAdapter';

/** /server-game: the backend's single global legacy game, for the signed-in player. */
export function ServerGamePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [adapter, setAdapter] = useState<RemoteGameAdapter | null>(null);

  // Created in an effect (not during render) so StrictMode's double mount disposes the spare.
  useEffect(() => {
    if (!profile) return;
    const next = new RemoteGameAdapter({ handle: profile.handle, displayName: profile.name });
    setAdapter(next);
    return () => next.dispose();
  }, [profile]);

  if (!adapter) return null;
  return (
    <GameScreen
      key={profile?.handle}
      adapter={adapter}
      modeLabel="Server"
      onExit={() => navigate('/lobby')}
      headerExtra={<DevAdapterToggle current="remote" />}
    />
  );
}
