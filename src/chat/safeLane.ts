// Where reactions may float without covering anything that matters. Pages mark what must stay visible (the board, the
// hand, the turn panel, the game's buttons) with `data-chat-avoid`; a lane is a strip of the screen none of them
// touches. Reactions use a full-width band if there is one (on a tall phone, the gap between the board and the hand),
// else a column along the chat button's side of the screen (beside the board on a wide screen). Where neither fits,
// there is no lane and the chat button itself shows the reaction.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Lane {
  left: number;
  top: number;
  width: number;
  height: number;
  /** A band shows reactions side by side; a column stacks them. */
  direction: 'row' | 'column';
}

/** One row of reactions. */
export const BAND_HEIGHT = 34;
/** A column's widest, and narrowest useful, width. */
export const COLUMN_WIDTH = 220;
const MIN_COLUMN_WIDTH = 120;
const MIN_COLUMN_HEIGHT = 96;
const MAX_COLUMN_HEIGHT = 260;
/** Space kept between a lane and whatever it avoids. */
const MARGIN = 4;

/** The stretches of [y0, y1] that no rect overlapping the columns [x0, x1] covers, top to bottom. */
export function freeIntervals(rects: Rect[], x0: number, x1: number, y0: number, y1: number): Array<[number, number]> {
  const blocked = rects
    .filter((r) => r.right > x0 && r.left < x1 && r.bottom > y0 && r.top < y1)
    .map((r): [number, number] => [Math.max(y0, r.top - MARGIN), Math.min(y1, r.bottom + MARGIN)])
    .sort((a, b) => a[0] - b[0]);
  const free: Array<[number, number]> = [];
  let cursor = y0;
  for (const [top, bottom] of blocked) {
    if (top > cursor) free.push([cursor, top]);
    cursor = Math.max(cursor, bottom);
  }
  if (cursor < y1) free.push([cursor, y1]);
  return free;
}

/**
 * The lane for reactions on a `width` × `height` screen, keeping clear of `avoid`, or null. `side` is the screen edge
 * the chat button is on: a column goes there first.
 */
export function findLane(avoid: Rect[], width: number, height: number, side: 'left' | 'right'): Lane | null {
  // The band nearest the bottom of the screen, where the chat button is.
  const bands = freeIntervals(avoid, 0, width, 0, height).filter(([top, bottom]) => bottom - top >= BAND_HEIGHT);
  const band = bands.at(-1);
  if (band) return { left: 0, top: band[1] - BAND_HEIGHT, width, height: BAND_HEIGHT, direction: 'row' };

  const columnWidth = Math.min(COLUMN_WIDTH, Math.floor(width * 0.3));
  if (columnWidth < MIN_COLUMN_WIDTH) return null;
  const sides = side === 'left' ? (['left', 'right'] as const) : (['right', 'left'] as const);
  for (const edge of sides) {
    const x0 = edge === 'left' ? 0 : width - columnWidth;
    const stretch = freeIntervals(avoid, x0, x0 + columnWidth, 0, height)
      .filter(([top, bottom]) => bottom - top >= MIN_COLUMN_HEIGHT)
      .at(-1);
    if (!stretch) continue;
    const columnHeight = Math.min(MAX_COLUMN_HEIGHT, stretch[1] - stretch[0]);
    return { left: x0, top: stretch[1] - columnHeight, width: columnWidth, height: columnHeight, direction: 'column' };
  }
  return null;
}

/** The lane on the current screen, avoiding every `[data-chat-avoid]` element and `extra` (the chat's own button). */
export function currentLane(side: 'left' | 'right', extra: Element[] = []): Lane | null {
  const elements = [...document.querySelectorAll('[data-chat-avoid]'), ...extra];
  const rects = elements
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map(({ left, top, right, bottom }) => ({ left, top, right, bottom }));
  return findLane(rects, window.innerWidth, window.innerHeight, side);
}

/** Where a reaction rises on a phone's game: from the board's top edge, up and off the screen. */
export interface Rise {
  /** The emoji's centre, across the screen. */
  x: number;
  /** Where it starts: the board's top edge. */
  start: number;
  /** How far it travels to leave the screen. */
  distance: number;
  /** The blank space between the turn container and the board: the only place the sender's name shows. */
  gapTop: number;
  gapHeight: number;
}

/** Room left beside the emoji for the sender's name. */
const NAME_ROOM = 96;
/** A rising emoji is this tall, so it travels this much further to be fully off the screen. */
const RISE_SIZE = 36;

/**
 * The rise for a reaction over `board`, under the turn container `turn` (if any). `spot` (0 to 1) picks where along
 * the board's top edge it starts, so reactions sent together don't stack.
 */
export function risePath(board: Rect, turn: Rect | null, spot: number): Rise {
  const left = board.left + RISE_SIZE / 2;
  const right = Math.max(left, board.right - NAME_ROOM);
  const gapTop = turn ? Math.min(turn.bottom, board.top) : board.top;
  return {
    x: Math.round(left + (right - left) * Math.min(1, Math.max(0, spot))),
    start: board.top,
    distance: board.top + RISE_SIZE,
    gapTop,
    gapHeight: board.top - gapTop,
  };
}

/** The rise on the current screen, or null where there is no board (the lobby) to rise from. */
export function currentRise(spot: number): Rise | null {
  const board = document.querySelector('[data-chat-anchor="board"]')?.getBoundingClientRect();
  if (!board || board.width === 0) return null;
  const turn = document.querySelector('[data-chat-anchor="turn"]')?.getBoundingClientRect();
  return risePath(board, turn && turn.height > 0 ? turn : null, spot);
}
