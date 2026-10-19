import { bench, describe } from 'vitest';
import { applyMove, createGame, legalTargets, type GameState } from './game';
import { suggestMove } from './hints';
import { seededRandom } from './setup';

// How long the Bot's thinking (suggestMove) and a move (applyMove) take, on positions from Bot-vs-Bot games.
// The answer decides whether they need a worker or WebAssembly: see docs/performance.md.
//
//   npx vitest bench --run

function positions(teamCount: 2 | 3, playersPerTeam: number): GameState[] {
  const random = seededRandom(7);
  let state = createGame({ teamCount, playersPerTeam, random });
  const seen: GameState[] = [];
  while (state.winner === null && state.turn < 300) {
    seen.push(state);
    const hint = suggestMove(state)!;
    state = applyMove(state, hint.type === 'pass' ? { type: 'pass' } : hint.type === 'exchange' ? { type: 'exchange', handIndex: hint.handIndex } : { type: 'play', handIndex: hint.handIndex, target: hint.target }, random);
  }
  return seen;
}

describe.each([
  [2, 1],
  [3, 2],
] as const)('%i teams of %i', (teamCount, playersPerTeam) => {
  const games = positions(teamCount, playersPerTeam);
  let i = 0;
  const next = () => games[i++ % games.length];

  bench('suggestMove (one Bot turn)', () => {
    suggestMove(next());
  });

  bench('legalTargets for a whole hand', () => {
    const state = next();
    state.hands[state.current].forEach((_, handIndex) => legalTargets(state, handIndex));
  });

  bench('applyMove', () => {
    const state = next();
    const hint = suggestMove(state)!;
    if (hint.type === 'play') applyMove(state, { type: 'play', handIndex: hint.handIndex, target: hint.target }, seededRandom(1));
  });
});
