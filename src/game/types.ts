import type { Pos } from '../engine/board';
import type { BoardCardName, CardName } from '../engine/cards';
import type { GameMode } from '../api/rooms';
import type { DeadCardMode, LogEntry } from '../engine/game';
import type { Hint } from '../engine/hints';
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
  /** Both board cells for this card are taken; it can be exchanged. Always false when players spot dead cards themselves. */
  dead: boolean;
}

export interface TeamView {
  index: TeamIndex;
  sequences: number;
}

export type GameStatus = 'loading' | 'ready' | 'error';

/** How the game is shown, chosen with the table (or the hot-seat setup). */
export interface PlaySettings {
  /** Training games show hints; standard games never do. */
  mode: GameMode;
  /** Light up the legal cells for the selected card. */
  highlights: boolean;
  /** Show the move log. Off: only the latest move is known. */
  history: boolean;
  /** 'manual': dead cards aren't marked; players ask to exchange a card they think is dead. 'indicator': they're marked. */
  deadCards: DeadCardMode;
}

export const DEFAULT_PLAY_SETTINGS: PlaySettings = { mode: 'standard', highlights: true, history: true, deadCards: 'indicator' };

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
  /** The viewer may exchange a dead card now (with manual dead cards: they have exchanges left, dead card or not). */
  canExchange: boolean;
  /** Exchanges the viewer has left this turn; null when unlimited or unknown. */
  exchangesLeft: number | null;
  /** No legal play and no exchange left; the player may pass. */
  canPass: boolean;
  deckCount: number | null;
  sequences: Sequence[];
  log: LogEntry[];
  winner: TeamIndex | null;
  turn: number | null;
  settings: PlaySettings;
  /** The suggested move for the viewer: only in training games, only on the viewer's turn. */
  hint: Hint | null;
  /** When the current turn began, in this device's clock (ms since epoch); null when unknown. */
  turnStartedAt: number | null;
  /** When the current turn's timer runs out, in this device's clock; null when there is no timer or it is paused. */
  turnDeadline: number | null;
  /** The current player has left the table, so the game waits on their turn (table games). */
  turnPaused: boolean;
  /** While paused: how long the current player will have when they're back (ms). */
  turnTimeLeft: number | null;
  /** Ids of the players who aren't at the table right now. */
  away: string[];
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
  /**
   * The viewer stepped away from the board (a menu or the leave dialog is open) or came back. Table games treat it
   * like leaving the table: the viewer's turn pauses until they're back. Optional; others ignore it.
   */
  stepAway?(away: boolean): void;
  dispose(): void;
}
