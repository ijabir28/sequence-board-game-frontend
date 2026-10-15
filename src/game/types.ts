import type { Pos } from '../engine/board';
import type { BoardCardName, CardName } from '../engine/cards';
import type { LogEntry } from '../engine/game';
import type { Sequence } from '../engine/sequences';
import type { TeamIndex } from '../engine/setup';

// The UI only talks to a GameAdapter. LocalGameAdapter runs the rules engine on this
// device (hot-seat); RemoteGameAdapter talks to the backend. Both expose the same view.

export interface CellView {
  row: number;
  column: number;
  card: BoardCardName;
  chip: TeamIndex | null;
  /** Chip belongs to a completed sequence and can't be removed. */
  locked: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  team: TeamIndex;
}

export interface HandCardView {
  card: CardName;
  /** Both board cells for this card are taken; it can be exchanged. */
  dead: boolean;
}

export interface TeamView {
  index: TeamIndex;
  sequences: number;
}

export type GameStatus = 'loading' | 'ready' | 'error';

/** How the game is shown, chosen with the table (or the hot-seat setup). */
export interface PlaySettings {
  /** Light up the legal cells for the selected card. */
  highlights: boolean;
  /** Show the move log. Off: only the latest move is known. */
  history: boolean;
}

export const DEFAULT_PLAY_SETTINGS: PlaySettings = { highlights: true, history: true };

export interface GameView {
  status: GameStatus;
  /** Set when status is 'error': what happened and what to do next. */
  error?: string;
  /** Non-blocking information to show above the board (for example backend limitations). */
  notice?: string;
  board: CellView[][];
  teams: TeamView[];
  sequencesToWin: number | null;
  players: PlayerView[];
  /** Whose turn it is, or null when the source can't tell (the backend has no turn order). */
  currentPlayerId: string | null;
  /** The player whose hand is shown. */
  viewer: PlayerView | null;
  hand: HandCardView[];
  canExchange: boolean;
  /** No legal play and no exchange left; the player may pass. */
  canPass: boolean;
  deckCount: number | null;
  sequences: Sequence[];
  log: LogEntry[];
  winner: TeamIndex | null;
  turn: number | null;
  settings: PlaySettings;
  /** The table's name, when the game belongs to one. */
  title?: string;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export interface GameAdapter {
  readonly mode: 'local' | 'remote';
  /** Several people share this device, so hands must be hidden between turns. */
  readonly hotSeat: boolean;
  getState(): GameView;
  /** Calls `listener` whenever getState() would return a new snapshot. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Cells the viewer may target with the hand card at `handIndex`. */
  legalTargets(handIndex: number): Pos[];
  playCard(handIndex: number, target: Pos): Promise<ActionResult>;
  exchangeDeadCard(handIndex: number): Promise<ActionResult>;
  pass(): Promise<ActionResult>;
  /** Re-reads state from the source (no-op for local games). */
  refresh(): Promise<void>;
  dispose(): void;
}
