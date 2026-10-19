import { posKey, samePos, type Pos } from '../engine/board';
import { fullDeck, type CardName } from '../engine/cards';
import { createGame, sequenceCount, type GameRules, type GameState, type Move, type Player } from '../engine/game';
import { emptyChipGrid, type Sequence } from '../engine/sequences';
import { seededRandom, shuffle, type TeamIndex } from '../engine/setup';
import type { PlaySettings } from '../game/types';

/*
 * The interactive training: short lessons against a bot, each a staged position on the real board and played with
 * the real rules engine, so every rule message is the one a live table gives. Each lesson sets one rulebook corner
 * case as a task; a legal move that misses the point is turned down with the reason. A quiz checks the rules that
 * can't be staged, and a practice match against the bot closes the training.
 */

export const YOU = 0;
export const BOT = 1;
const PLAYERS: Player[] = [
  { id: 'you', name: 'You', team: 0 },
  { id: 'bot', name: 'Bot', team: 1 },
];

/** What the player did, with the state before and after it. */
export interface Attempt {
  before: GameState;
  move: Move;
  after: GameState;
}

export interface BoardLesson {
  kind: 'board';
  id: string;
  title: string;
  /** The task, in a sentence or two. */
  goal: string;
  /** The rule it practises, shown under the task. */
  rule: string;
  /** Said once the task is done. */
  success: string;
  settings: PlaySettings;
  setup: () => GameState;
  /** Turns down a legal move that misses the task, with the reason; null lets it stand. */
  check?: (attempt: Attempt) => string | null;
  /** The task is done. */
  done: (attempt: Attempt) => boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  /** Why the answer is right, shown once the question is answered. */
  why: string;
}

export interface QuizLesson {
  kind: 'quiz';
  id: string;
  title: string;
  goal: string;
  questions: QuizQuestion[];
}

export type Lesson = BoardLesson | QuizLesson;

const pos = (row: number, column: number): Pos => ({ row, column });

interface Stage {
  /** Chips as [row, column, team]. */
  chips: [number, number, TeamIndex][];
  /** Completed sequences (their chips must be in `chips`). */
  sequences?: Sequence[];
  hand: CardName[];
  botHand: CardName[];
  rules?: Partial<GameRules>;
  /** Fixes the draw pile's order, so a lesson plays the same every time. */
  seed: number;
}

/** A position mid-game, You (green) to move against the Bot (blue). */
function stage({ chips, sequences = [], hand, botHand, rules = {}, seed }: Stage): GameState {
  const grid = emptyChipGrid();
  chips.forEach(([row, column, team]) => (grid[row][column] = team));
  const deck = fullDeck();
  [...hand, ...botHand].forEach((card) => deck.splice(deck.indexOf(card), 1));
  return {
    teamCount: 2,
    rules: { autoDrawDead: false, exchangesPerTurn: 1, ...rules },
    players: PLAYERS,
    hands: [hand, botHand],
    chips: grid,
    deck: shuffle(deck, seededRandom(seed)),
    discard: [],
    current: YOU,
    turn: 9,
    exchangesThisTurn: 0,
    sequences,
    winner: null,
    log: [],
  };
}

const placedAt = ({ move }: Attempt, at: Pos) => move.type === 'play' && samePos(move.target, at);
const playedCard = ({ before, move }: Attempt) => (move.type === 'play' ? before.hands[YOU][move.handIndex] : undefined);
const line = (row: number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => pos(row, from + i));
const column = (col: number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => pos(from + i, col));

const LESSON_SETTINGS: PlaySettings = { mode: 'standard', highlights: true, history: true, deadCards: 'indicator' };

export const LESSONS: Lesson[] = [
  {
    kind: 'board',
    id: 'place',
    title: 'Place a chip',
    goal: 'Play your 7♠. Pick it in your hand, then put your chip on its open cell.',
    rule: 'Every card is on the board twice. When one cell is taken, the other is still yours to use.',
    success: 'One 7♠ cell was taken by the Bot, so the other one was the only place for it.',
    settings: LESSON_SETTINGS,
    setup: () =>
      stage({
        seed: 1,
        chips: [
          [1, 8, BOT],
          [4, 4, BOT],
          [5, 5, YOU],
        ],
        hand: ['7-Spade', '3-Club', 'K-Heart', '2-Diamond', '9-Club', '4-Heart', 'Q-Spade'],
        botHand: ['6-Heart', '8-Club', 'A-Spade', '10-Diamond', '5-Club', 'K-Club', '2-Spade'],
      }),
    check: (attempt) => (playedCard(attempt) === '7-Spade' ? null : 'Not that one yet: this lesson is about the 7♠. Pick it in your hand.'),
    done: (attempt) => placedAt(attempt, pos(9, 3)),
  },
  {
    kind: 'board',
    id: 'corner',
    title: 'Corners count for everyone',
    goal: 'Make a sequence along the top edge. You only have three chips there… look at the corner.',
    rule: "The four star corners take no chip, but count as one of yours. A corner plus four chips is a sequence. Try tapping the corner: nothing can go on it.",
    success: 'Corner, 6♦, 7♦, 8♦ and 9♦: five in a row, so a sequence. Its chips are now locked.',
    settings: LESSON_SETTINGS,
    setup: () =>
      stage({
        seed: 2,
        chips: [
          [0, 1, YOU],
          [0, 2, YOU],
          [0, 3, YOU],
          [1, 1, BOT],
          [2, 3, BOT],
          [3, 3, YOU],
        ],
        hand: ['9-Diamond', '4-Club', 'Q-Heart', '7-Heart', '3-Spade', 'A-Club', '6-Club'],
        botHand: ['K-Diamond', '2-Heart', '8-Heart', '5-Spade', '10-Club', '9-Heart', '4-Diamond'],
      }),
    check: (attempt) =>
      sequenceCount(attempt.after, 0) > 0 ? null : 'That works, but there is a sequence to make this turn. Which 9♦ cell finishes the top row?',
    done: (attempt) => sequenceCount(attempt.after, 0) > 0,
  },
  {
    kind: 'board',
    id: 'wild',
    title: 'Two-eyed jacks are wild',
    goal: 'The Bot has four in a row across the middle. Block it before its next turn.',
    rule: 'Two-eyed jacks (♣ and ♦) are not on the board: they put your chip on any empty cell. None of your other cards fits the cell you need.',
    success: 'Blocked. The wild jack went where no card in your hand could, and the Bot’s line is stuck at four.',
    settings: LESSON_SETTINGS,
    setup: () =>
      stage({
        seed: 3,
        chips: [
          [6, 3, BOT],
          [6, 4, BOT],
          [6, 5, BOT],
          [6, 6, BOT],
          [6, 7, YOU],
          [3, 4, YOU],
          [2, 5, BOT],
        ],
        hand: ['J-Club', '3-Heart', '9-Spade', 'Q-Club', 'K-Spade', '5-Heart', 'A-Diamond'],
        botHand: ['8-Diamond', '7-Club', '6-Diamond', '4-Spade', 'Q-Diamond', '10-Heart', '3-Diamond'],
      }),
    check: (attempt) =>
      placedAt(attempt, pos(6, 2))
        ? null
        : 'The Bot holds an 8♦ and finishes its row next turn. Find the empty cell at the end of its four and put a chip there.',
    done: (attempt) => placedAt(attempt, pos(6, 2)),
  },
  {
    kind: 'board',
    id: 'remove',
    title: 'One-eyed jacks remove',
    goal: 'The Bot has one sequence and needs a second to win. It is one 2♥ away. Break its column with your one-eyed jack.',
    rule:
      'One-eyed jacks (♠ and ♥) take an opponent’s chip off instead of placing one. They can’t take your own chips, or a chip in a finished sequence: it is locked. Highlights are off here, so try a few cells and read what the rules say.',
    success: 'The column is broken. The bottom chip stays: it belongs to the Bot’s finished sequence, so it is locked.',
    settings: { ...LESSON_SETTINGS, highlights: false },
    setup: () =>
      stage({
        seed: 4,
        chips: [
          ...line(8, 1, 5).map(({ row, column }) => [row, column, BOT] as [number, number, TeamIndex]),
          [7, 5, BOT],
          [6, 5, BOT],
          [5, 5, BOT],
          [9, 5, YOU],
          [7, 2, YOU],
          [3, 6, BOT],
        ],
        sequences: [{ team: BOT, cells: line(8, 1, 5) }],
        hand: ['J-Spade', '3-Club', 'K-Diamond', '6-Spade', '10-Club', 'A-Heart', '7-Diamond'],
        botHand: ['2-Heart', '9-Diamond', '4-Club', 'Q-Spade', '8-Spade', '5-Diamond', 'K-Club'],
      }),
    check: (attempt) => {
      const card = playedCard(attempt);
      if (card !== 'J-Spade') return 'Your one-eyed jack is the card for this. Pick the J♠.';
      const breaks = column(5, 5, 7).map(posKey);
      return attempt.move.type === 'play' && breaks.includes(posKey(attempt.move.target))
        ? null
        : 'That chip comes off, but the Bot’s column still finishes with a 2♥. Take a chip out of the column itself.';
    },
    done: (attempt) => attempt.move.type === 'play' && column(5, 5, 7).some((p) => placedAt(attempt, p)),
  },
  {
    kind: 'board',
    id: 'dead',
    title: 'Dead cards',
    goal: 'One card in your hand is dead: both its cells are taken. Find it, exchange it, then play a card.',
    rule:
      'Nothing marks dead cards here, as on most tables: you spot them. Pick a card and press Exchange dead; the rules check it. You may exchange before you play, one card a turn unless the table allows more.',
    success: 'The 5♣ was dead (both 5♣ cells were taken). You swapped it, and still had your turn to play.',
    settings: { ...LESSON_SETTINGS, deadCards: 'manual' },
    setup: () =>
      stage({
        seed: 5,
        chips: [
          [6, 6, BOT],
          [8, 8, YOU],
          [4, 6, YOU],
          [3, 6, YOU],
          [2, 6, BOT],
        ],
        hand: ['8-Heart', '5-Club', '2-Club', '9-Heart', 'Q-Diamond', '4-Spade', '10-Spade'],
        botHand: ['3-Diamond', '6-Club', 'A-Heart', 'K-Heart', '7-Spade', '9-Club', 'Q-Club'],
      }),
    check: ({ before, move }) =>
      move.type === 'play' && before.exchangesThisTurn === 0
        ? 'Exchange the dead card first: once you play, your turn is over and the dead card stays in your hand.'
        : null,
    done: ({ before, move }) => move.type === 'play' && before.exchangesThisTurn > 0,
  },
  {
    kind: 'board',
    id: 'win',
    title: 'Two sequences win',
    goal: 'You have one sequence along the bottom. Make your second and win the round.',
    rule:
      'With two teams you need two sequences. Two of yours may share one chip, never two, so the end of your first sequence can start the next. The corner counts too.',
    success: 'You win! The new five shares just one chip with your first sequence, which the rules allow.',
    settings: LESSON_SETTINGS,
    setup: () =>
      stage({
        seed: 6,
        chips: [
          ...line(9, 1, 5).map(({ row, column }) => [row, column, YOU] as [number, number, TeamIndex]),
          [9, 6, YOU],
          [9, 7, YOU],
          [8, 6, BOT],
          [8, 7, BOT],
          [7, 6, BOT],
          [1, 3, BOT],
        ],
        sequences: [{ team: YOU, cells: line(9, 1, 5) }],
        hand: ['2-Spade', '7-Heart', 'A-Club', 'Q-Heart', '3-Heart', 'K-Spade', '8-Club'],
        botHand: ['5-Club', '4-Heart', '6-Diamond', '9-Spade', '10-Diamond', '2-Diamond', 'A-Spade'],
      }),
    check: (attempt) => (attempt.after.winner === YOU ? null : 'You can win right now. Your bottom row only needs one more chip.'),
    done: (attempt) => attempt.after.winner === YOU,
  },
  {
    kind: 'quiz',
    id: 'quiz',
    title: 'Rules check',
    goal: 'A few rules that come up in every game. Answer them all to finish.',
    questions: [
      {
        question: 'Your team has a sequence of five. You add a sixth chip to the same line. How many sequences is that?',
        options: ['One', 'Two', 'It depends on the cards'],
        answer: 0,
        why: 'Two sequences may share only one chip. A line of six shares four, so it is still one; a line of nine is two.',
      },
      {
        question: 'Three teams are playing. How many sequences does a team need to win?',
        options: ['One', 'Two', 'Three'],
        answer: 0,
        why: 'Two teams play to two sequences; three teams play to one.',
      },
      {
        question: 'No card in your hand can be played and you can’t exchange one. What happens?',
        options: ['You must play a jack', 'You pass your turn', 'You draw until you can play'],
        answer: 1,
        why: 'Pass turn appears only then. While any card can be played, you can’t pass.',
      },
      {
        question: 'Your turn timer runs out. What happens?',
        options: ['You lose the round', 'Your turn is skipped', 'A random legal move is played for you'],
        answer: 2,
        why: 'A random playable card goes on a random legal cell (or a dead card is exchanged, or you pass). Draft your move early to choose it yourself.',
      },
      {
        question: 'Can you tell your teammate which cards you hold?',
        options: ['Yes, any time', 'No, never', 'Only on your own turn'],
        answer: 1,
        why: 'Talking about your hand with your team is against the rules.',
      },
      {
        question: 'Who may use a star corner in a sequence?',
        options: ['Whoever covers it first', 'Every team', 'No one'],
        answer: 1,
        why: 'Corners take no chip and count for every team at once.',
      },
    ],
  },
  {
    kind: 'board',
    id: 'match',
    title: 'Practice match',
    goal: 'A full game against the Bot, from a fresh deal. First to two sequences wins. Stuck? Press Hint.',
    rule: 'Everything you practised, in a real game. Moves are checked by the same rules as a live table.',
    success: 'Game over. You have played every rule: you are ready for a live table.',
    settings: { mode: 'training', highlights: true, history: true, deadCards: 'indicator' },
    setup: () => {
      const game = createGame({ teamCount: 2, playersPerTeam: 1, rules: { exchangesPerTurn: 1 } });
      return { ...game, players: PLAYERS };
    },
    done: ({ after }) => after.winner !== null,
  },
];
