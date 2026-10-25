import type { TeamIndex } from '../../engine/setup';
import { failureMessage } from '../../api/http';

/*
 * Every workaround for the current backend lives here (see backend docs/known-issues.md).
 * When the backend is fixed, update or delete the matching entry and the adapter follows.
 */

/** The legacy game has four hard-coded players; any other handle makes /game/hand_cards return 500. */
export const LEGACY_PLAYERS: Record<string, TeamIndex> = {
  jabir: 0,
  sakib: 0,
  habiba: 1,
  humaira: 1,
};

/** `occupied_by` uses legacy team handles, not the TEAM_n handles rooms use. */
export function teamFromOccupiedBy(value: string | undefined): TeamIndex | null {
  if (!value) return null;
  const match = /^team_?(\d+)$/i.exec(value);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index >= 0 && index <= 2 ? (index as TeamIndex) : null;
}

/** No socket events exist for games, so the board and hand are polled. */
export const POLL_INTERVAL_MS = 3000;

export type PlayOutcome =
  | { kind: 'applied' }
  | { kind: 'invalid' }
  | { kind: 'server-error'; status: number };

/** Interprets GET /game/play: a valid move is 200 {verdict: "Valid"}, an invalid one is 404 "Invalid Move". */
export function interpretPlay(status: number, body: string): PlayOutcome {
  if (status === 200) return { kind: 'applied' };
  if (status === 404 && /invalid move/i.test(body)) return { kind: 'invalid' };
  return { kind: 'server-error', status };
}

export const PLAY_MESSAGES = {
  invalid: "That move isn't allowed. Pick a highlighted cell and try again.",
  serverError: (status: number) => `${failureMessage(status)} Your move wasn't made.`,
} as const;

/** What the server game can't do yet, shown above the board. */
export const SERVER_LIMITATIONS =
  "Server test game: one shared board for the whole server, with no turn order, sequences or dead cards. Open a table to play a full game.";

export const UNSUPPORTED = {
  exchange: "The server can't exchange dead cards yet.",
  pass: "The server can't pass a turn yet.",
} as const;
