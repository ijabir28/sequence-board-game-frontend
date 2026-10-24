import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { GameScreen } from '../components/game/GameScreen';
import { Button } from '../components/ui/Button';
import { watchLink } from '../api/rooms';
import { RoomGameAdapter } from '../game/remote/RoomGameAdapter';
import { TableChat } from '../chat/TableChat';

/**
 * /watch/:id: a table's game, live and read-only, for anyone with the link (signed in or not). The board, the turns and
 * every move arrive as they happen; no hand is ever shown, and the server refuses a spectator's moves. A player who
 * opens their own table's watch link is taken to their seat instead.
 */
export function WatchGamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [adapter, setAdapter] = useState<RoomGameAdapter | null>(null);

  // Created in an effect (not during render) so StrictMode's double mount disposes the spare.
  useEffect(() => {
    const next = new RoomGameAdapter({ roomId: id });
    setAdapter(next);
    return () => next.dispose();
  }, [id]);

  useEffect(() => {
    if (!adapter) return;
    const toSeat = () => {
      if (adapter.getState().viewer) navigate(`/table/${encodeURIComponent(id)}/game`, { replace: true });
    };
    toSeat();
    return adapter.subscribe(toSeat);
  }, [adapter, id, navigate]);

  if (!adapter) return null;
  const signedIn = Boolean(profile);
  return (
    <>
      <GameScreen
        key={id}
        adapter={adapter}
        modeLabel={`Room ${id}`}
        handOrderKey={`sequence:hand-order:${id}`}
        watchLink={watchLink(id)}
        spectatorExtra={
          signedIn ? undefined : (
            <Button variant="primary" size="sm" onClick={() => navigate('/signup')} tip="Make an account to open your own rooms and play">
              Sign up to play
            </Button>
          )
        }
        onExit={() => navigate(signedIn ? `/table/${encodeURIComponent(id)}` : '/')}
        onDashboard={signedIn ? () => navigate('/lobby') : undefined}
      />
      <TableChat roomId={id} you={profile?.handle ?? null} placement="game" />
    </>
  );
}
