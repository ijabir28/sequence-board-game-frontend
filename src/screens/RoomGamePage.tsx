import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameScreen } from '../components/game/GameScreen';
import { ShareWatchLink } from '../components/game/ShareWatchLink';
import { RoomGameAdapter } from '../game/remote/RoomGameAdapter';

/** /table/:id/game: the table's game, run by the server and shared by everyone seated. */
export function RoomGamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [adapter, setAdapter] = useState<RoomGameAdapter | null>(null);

  // Created in an effect (not during render) so StrictMode's double mount disposes the spare.
  useEffect(() => {
    const next = new RoomGameAdapter({ roomId: id });
    setAdapter(next);
    return () => next.dispose();
  }, [id]);

  if (!adapter) return null;
  return (
    <GameScreen
      key={id}
      adapter={adapter}
      modeLabel={`Table ${id}`}
      handOrderKey={`sequence:hand-order:${id}`}
      headerExtra={<ShareWatchLink roomId={id} />}
      onExit={() => navigate(`/table/${id}`)}
      onDashboard={() => navigate('/lobby')}
    />
  );
}
