import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DevAdapterToggle } from '../components/game/DevAdapterToggle';
import { GameScreen } from '../components/game/GameScreen';
import { tipProps } from '../components/ui/TooltipLayer';
import { LocalGameAdapter } from '../game/local/LocalGameAdapter';
import { LocalSetup, type LocalConfig } from './LocalSetup';

/** /local: set up a hot-seat game, then play it. A table setup can be passed in router state. */
export function LocalGamePage() {
  const navigate = useNavigate();
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
              mode: config.settings.mode,
              highlights: config.settings.highlights,
              history: config.settings.history,
              deadCards: config.settings.deadCards,
            },
          })
        : null,
    [config, round],
  );
  useEffect(() => () => adapter?.dispose(), [adapter]);

  if (!config || !adapter) return <LocalSetup initial={preset ?? undefined} onStart={setConfig} backAction={
        <Link to="/" {...tipProps('Go back without starting a game')}>
          Back
        </Link>
      } />;

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
