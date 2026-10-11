import { useCallback, useSyncExternalStore } from 'react';
import type { GameAdapter, GameView } from './types';

/** Subscribes a component to an adapter's state. Whoever creates the adapter disposes it. */
export function useGame(adapter: GameAdapter): GameView {
  const subscribe = useCallback((listener: () => void) => adapter.subscribe(listener), [adapter]);
  const getSnapshot = useCallback(() => adapter.getState(), [adapter]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
