import type { Pos } from '../engine/board';
import type { BoardCardName, CardName } from '../engine/cards';
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

/** How one player did in a round (or, in a summary, over every round). */
export interface PlayerStats {
  id: string;
  name: string;
  team: TeamIndex;
  /** Cards played: chips placed or removed. */
  plays: number;
  /** Two-eyed jacks played. */
  wilds: number;
  /** One-eyed jacks played: opponents' chips taken off. */
  removals: number;
  /** Dead cards exchanged. */
  exchanges: number;
  passes: number;
  /** Moves made for them when their turn timer ran out. */
  timedOut: number;
}

export interface TeamRoundStats {
  team: TeamIndex;
  sequences: number;
  /** Chips on the board when the round ended. */
  chips: number;
  /** Chips put down, wild jacks included. */
  placed: number;
  /** Opponents' chips taken off. */
  removed: number;
}

export interface RoundResult {
  round: number;
  winner: TeamIndex | null;
  /** How long the round took, in ms; null when unknown. */
  durationMs: number | null;
  /** Null for a round won before statistics were kept. */
  stats: {
    turns: number;
    /** Who moved first in the round. */
    firstPlayerId: string;
    teams: TeamRoundStats[];
    players: PlayerStats[];
  } | null;
}

/** A won round to look back on: its statistics, the board as it ended and every move. */
export interface RoundDetail {
  result: RoundResult;
  board: CellView[][];
  sequences: Sequence[];
  log: LogEntry[];
}

export interface TeamSeriesStats {
  team: TeamIndex;
  roundsWon: number;
  sequences: number;
  placed: number;
  removed: number;
}

/** Every round added up, once the host ended the rounds. */
export interface SeriesSummary {
  roundsPlayed: number;
  turns: number;
  teams: TeamSeriesStats[];
  players: PlayerStats[];
  /** The team with the most round wins; null with several leaders (a draw), all listed in `leaders`. */
  winner: TeamIndex | null;
  leaders: TeamIndex[];
}

/** Where a table is in its rounds (table games only). */
export interface RoundsView {
  /** The current round, from 1. */
  round: number;
  /** The host ended the rounds: `summary` is the final result. */
  over: boolean;
  /** The won rounds, in order (the current one too once it's won). */
  results: RoundResult[];
  summary: SeriesSummary | null;
  /** The host deals each round and decides whether another follows. */
  hostId: string | null;
  /** The viewer is the host. */
  isHost: boolean;
}

/**
 * `training` gives the player whose turn it is hints: only the practice match of the interactive training plays it.
 * Tables and hot-seat games are always `standard`.
 */
export type GameMode = 'standard' | 'training';

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
  /** Table games are played in rounds; null for games without them (hot-seat, older servers). */
  rounds?: RoundsView | null;
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
  /** Table games, the host only: once a round is won, deal the next one with the same teams. */
  nextRound?(): Promise<ActionResult>;
  /** Table games, the host only: once a round is won, end the rounds there for the final result. */
  endRounds?(): Promise<ActionResult>;
  /** Table games: a won round's statistics, final board and move log. Rejects with a readable message. */
  roundDetail?(round: number): Promise<RoundDetail>;
  dispose(): void;
}
