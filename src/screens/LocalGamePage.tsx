import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BackToDashboard } from '../components/BackToDashboard';
import { DevAdapterToggle } from '../components/game/DevAdapterToggle';
import { GameScreen } from '../components/game/GameScreen';
import { tipProps } from '../components/ui/TooltipLayer';
import { LocalGameAdapter } from '../game/local/LocalGameAdapter';
import { LocalSetup, type LocalConfig } from './LocalSetup';
import own from './LocalGamePage.module.css';

/** /local: set up a hot-seat game, then play it. A table setup can be passed in router state. */
export function LocalGamePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const location = useLocation();
  const preset = (location.state as { preset?: Partial<LocalConfig> } | null)?.preset;
  const [config, setConfig] = useState<LocalConfig | null>(null);
  const [round, setRound] = useState(0);

  const adapter = useMemo(
    () =>
      config
        ? new LocalGameAdapter({
            ...config,
            rules: {
              autoDrawDead: config.settings.autoDrawDead,
              deadCards: config.settings.deadCards,
              exchangesPerTurn: config.settings.exchangesPerTurn,
            },
            turnSeconds: config.settings.turnSeconds,
            settings: {
              highlights: config.settings.highlights,
              history: config.settings.history,
              deadCards: config.settings.deadCards,
            },
          })
        : null,
    [config, round],
  );
  useEffect(() => () => adapter?.dispose(), [adapter]);

  if (!config || !adapter) {
    return (
      <LocalSetup
        initial={preset ?? undefined}
        onStart={setConfig}
        // Signed out there is no dashboard, so only the plain Back (to sign-in) is offered.
        topAction={profile && <BackToDashboard className={own.back} tip="Go back to the dashboard without starting a game" />}
        backAction={
          <Link to="/" {...tipProps('Go back without starting a game')}>
            Back
          </Link>
        }
      />
    );
  }

  return (
    <GameScreen
      key={round}
      adapter={adapter}
      modeLabel="Hot-seat"
      onNewGame={() => setRound((r) => r + 1)}
      headerExtra={<DevAdapterToggle current="local" />}
      onExit={() => {
        setConfig(null);
        navigate('/local', { replace: true, state: { preset: config } });
      }}
    />
  );
}
