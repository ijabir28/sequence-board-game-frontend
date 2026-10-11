import { BOARD_LAYOUT, isCorner, positionsOf, type Pos } from './board';
import { cardKind, cardShort, fullDeck, type CardName } from './cards';
import { emptyChipGrid, findNewSequences, isLocked, type Sequence } from './sequences';
import { handSizeFor, isSupportedTable, seatTeams, sequencesToWin, shuffle, type TeamCount, type TeamIndex } from './setup';

// Pure, immutable rules engine. Every function takes a state and returns a new one;
// nothing here knows about React, the network or the clock.

export interface Player {
  id: string;
  name: string;
  team: TeamIndex;
}

export type LogEntry =
  | { kind: 'place'; turn: number; player: string; team: TeamIndex; card: CardName; pos: Pos; wild: boolean }
  | { kind: 'remove'; turn: number; player: string; team: TeamIndex; card: CardName; pos: Pos; removedTeam: TeamIndex }
  | { kind: 'exchange'; turn: number; player: string; team: TeamIndex; card: CardName }
  | { kind: 'pass'; turn: number; player: string; team: TeamIndex }
  | { kind: 'sequence'; turn: number; team: TeamIndex; cells: Pos[] }
  | { kind: 'win'; turn: number; team: TeamIndex };

export interface GameState {
  teamCount: TeamCount;
  players: Player[];
  /** Hands by player index, in seat order. */
  hands: CardName[][];
  chips: (TeamIndex | null)[][];
  deck: CardName[];
  discard: CardName[];
  /** Index into `players` of whoever moves next. */
  current: number;
  /** Turn counter, starting at 1. */
  turn: number;
  /** A dead card may be exchanged once per turn, before playing. */
  exchangedThisTurn: boolean;
  sequences: Sequence[];
  winner: TeamIndex | null;
  log: LogEntry[];
}

export type Move =
  | { type: 'play'; handIndex: number; target: Pos }
  | { type: 'exchange'; handIndex: number }
  | { type: 'pass' };

export type RuleErrorCode =
  | 'GAME_OVER'
  | 'NO_SUCH_CARD'
  | 'CELL_MISMATCH'
  | 'CELL_OCCUPIED'
  | 'CORNER'
  | 'NOTHING_TO_REMOVE'
  | 'OWN_CHIP'
  | 'LOCKED_CHIP'
  | 'NOT_DEAD'
  | 'ALREADY_EXCHANGED'
  | 'HAS_MOVES';

export class RuleError extends Error {
  constructor(
    readonly code: RuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RuleError';
  }
}

export interface NewGameOptions {
  teamCount: number;
  playersPerTeam: number;
  /** Optional names in seat order; missing names default to "Player n". */
  playerNames?: string[];
  random?: () => number;
}

export function createGame({ teamCount, playersPerTeam, playerNames = [], random = Math.random }: NewGameOptions): GameState {
  if (!isSupportedTable(teamCount, playersPerTeam)) {
    throw new RangeError(`Unsupported table: ${teamCount} teams of ${playersPerTeam}`);
  }
  const teams = seatTeams(teamCount, playersPerTeam);
  const players: Player[] = teams.map((team, seat) => ({
    id: `p${seat + 1}`,
    name: playerNames[seat]?.trim() || `Player ${seat + 1}`,
    team,
  }));
  const handSize = handSizeFor(players.length)!;
  const deck = shuffle(fullDeck(), random);
  const hands = players.map(() => deck.splice(0, handSize));
  return {
    teamCount,
    players,
    hands,
    chips: emptyChipGrid(),
    deck,
    discard: [],
    current: 0,
    turn: 1,
    exchangedThisTurn: false,
    sequences: [],
    winner: null,
    log: [],
  };
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.current];
}

/** A dead card is a normal card whose two board cells are both covered. Jacks are never dead. */
export function isDeadCard(state: GameState, card: CardName): boolean {
  if (cardKind(card) !== 'normal') return false;
  return positionsOf(card).every((p) => state.chips[p.row][p.column] !== null);
}

/** Cells the current player may target with the card at `handIndex`. */
export function legalTargets(state: GameState, handIndex: number): Pos[] {
  if (state.winner !== null) return [];
  const card = state.hands[state.current]?.[handIndex];
  if (!card) return [];
  const team = currentPlayer(state).team;
  const targets: Pos[] = [];
  BOARD_LAYOUT.forEach((row, r) =>
    row.forEach((_, c) => {
      if (targetProblem(state, card, team, { row: r, column: c }) === null) targets.push({ row: r, column: c });
    }),
  );
  return targets;
}

/** Returns why `card` can't target `pos`, or null if it can. Codes only, so scanning the board stays cheap. */
function targetProblem(state: GameState, card: CardName, team: TeamIndex, pos: Pos): RuleErrorCode | null {
  if (isCorner(pos)) return 'CORNER';
  const occupant = state.chips[pos.row][pos.column];
  switch (cardKind(card)) {
    case 'one-eyed-jack':
      if (occupant === null) return 'NOTHING_TO_REMOVE';
      if (occupant === team) return 'OWN_CHIP';
      return isLocked(state.sequences, pos) ? 'LOCKED_CHIP' : null;
    case 'two-eyed-jack':
      return occupant === null ? null : 'CELL_OCCUPIED';
    case 'normal':
      if (BOARD_LAYOUT[pos.row][pos.column] !== card) return 'CELL_MISMATCH';
      return occupant === null ? null : 'CELL_OCCUPIED';
  }
}

function targetMessage(code: RuleErrorCode, card: CardName): string {
  switch (code) {
    case 'CORNER':
      return 'Corners are free spaces for every team, so no chip can go there.';
    case 'NOTHING_TO_REMOVE':
      return 'A one-eyed jack removes a chip, and this cell is empty. Pick an opponent\'s chip.';
    case 'OWN_CHIP':
      return "A one-eyed jack can't remove your own team's chip. Pick an opponent's chip.";
    case 'LOCKED_CHIP':
      return "That chip is part of a completed sequence and can't be removed. Pick another chip.";
    case 'CELL_MISMATCH':
      return `${cardShort(card)} can only go on a ${cardShort(card)} cell. Pick one of the highlighted cells.`;
    case 'CELL_OCCUPIED':
      return 'That cell already has a chip. Pick an empty cell.';
    default:
      return 'That move is not allowed.';
  }
}

export function hasLegalPlay(state: GameState): boolean {
  return state.hands[state.current].some((_, i) => legalTargets(state, i).length > 0);
}

export function canExchange(state: GameState): boolean {
  return state.winner === null && !state.exchangedThisTurn && state.hands[state.current].some((c) => isDeadCard(state, c));
}

/** Applies a move for the current player. Throws RuleError for illegal moves. */
export function applyMove(state: GameState, move: Move, random: () => number = Math.random): GameState {
  if (state.winner !== null) throw new RuleError('GAME_OVER', 'The game is over. Start a new game to keep playing.');
  switch (move.type) {
    case 'play':
      return play(state, move.handIndex, move.target, random);
    case 'exchange':
      return exchange(state, move.handIndex, random);
    case 'pass': {
      if (hasLegalPlay(state) || canExchange(state)) {
        throw new RuleError('HAS_MOVES', 'You still have a card you can play, so you cannot pass.');
      }
      const { name, team } = currentPlayer(state);
      return endTurn({ ...state, log: [...state.log, { kind: 'pass', turn: state.turn, player: name, team }] });
    }
  }
}

function play(state: GameState, handIndex: number, target: Pos, random: () => number): GameState {
  const player = currentPlayer(state);
  const card = state.hands[state.current][handIndex];
  if (!card) throw new RuleError('NO_SUCH_CARD', 'That card is not in your hand.');
  const problem = targetProblem(state, card, player.team, target);
  if (problem) throw new RuleError(problem, targetMessage(problem, card));

  const chips = state.chips.map((row) => [...row]);
  const log = [...state.log];
  let sequences = state.sequences;
  let winner: TeamIndex | null = null;

  if (cardKind(card) === 'one-eyed-jack') {
    const removedTeam = chips[target.row][target.column]!;
    chips[target.row][target.column] = null;
    log.push({ kind: 'remove', turn: state.turn, player: player.name, team: player.team, card, pos: target, removedTeam });
  } else {
    chips[target.row][target.column] = player.team;
    log.push({ kind: 'place', turn: state.turn, player: player.name, team: player.team, card, pos: target, wild: cardKind(card) === 'two-eyed-jack' });
    const found = findNewSequences(chips, sequences, player.team, target);
    if (found.length > 0) {
      sequences = [...sequences, ...found];
      found.forEach((s) => log.push({ kind: 'sequence', turn: state.turn, team: s.team, cells: s.cells }));
      if (sequences.filter((s) => s.team === player.team).length >= sequencesToWin(state.teamCount)) {
        winner = player.team;
        log.push({ kind: 'win', turn: state.turn, team: player.team });
      }
    }
  }

  const drawn = replaceCard({ ...state, chips, sequences, log }, handIndex, random);
  return winner !== null ? { ...drawn, winner } : endTurn(drawn);
}

function exchange(state: GameState, handIndex: number, random: () => number): GameState {
  const card = state.hands[state.current][handIndex];
  if (!card) throw new RuleError('NO_SUCH_CARD', 'That card is not in your hand.');
  if (state.exchangedThisTurn) throw new RuleError('ALREADY_EXCHANGED', 'You can exchange one dead card per turn. Play a card instead.');
  if (!isDeadCard(state, card)) throw new RuleError('NOT_DEAD', `${cardShort(card)} still has an open cell, so it isn't dead.`);
  const player = currentPlayer(state);
  const next = replaceCard(state, handIndex, random);
  return {
    ...next,
    exchangedThisTurn: true,
    log: [...next.log, { kind: 'exchange', turn: state.turn, player: player.name, team: player.team, card }],
  };
}

/** Discards hand[handIndex] and draws into the same slot, reshuffling the discard pile if the deck is empty. */
function replaceCard(state: GameState, handIndex: number, random: () => number): GameState {
  const hand = [...state.hands[state.current]];
  const [played] = hand.splice(handIndex, 1);
  let deck = state.deck;
  let discard = [...state.discard, played];
  if (deck.length === 0) {
    deck = shuffle(discard, random);
    discard = [];
  }
  deck = [...deck];
  const drawn = deck.shift();
  if (drawn) hand.splice(handIndex, 0, drawn);
  const hands = state.hands.map((h, i) => (i === state.current ? hand : h));
  return { ...state, hands, deck, discard };
}

function endTurn(state: GameState): GameState {
  return { ...state, current: (state.current + 1) % state.players.length, turn: state.turn + 1, exchangedThisTurn: false };
}

export function sequenceCount(state: GameState, team: TeamIndex): number {
  return state.sequences.filter((s) => s.team === team).length;
}
