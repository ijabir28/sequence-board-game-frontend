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

/**
 * Where a reaction rises on a game, up and off the screen: on a phone from the board's top edge, on a wider screen up
 * a free channel beside the board.
 */
export interface Rise {
  /** The emoji's centre, across the screen. */
  x: number;
  /** Where it starts, down the screen. */
  start: number;
  /** How far it travels to leave the screen. */
  distance: number;
  /** How long that takes. */
  ms: number;
  /**
   * The only place the sender's name shows (it is cut to this box), or null for no name: on a phone the blank space
   * between the turn container and the board, beside the board the first stretch of the channel.
   */
  nameBox: Rect | null;
  /** Which side of the emoji the name goes: away from the board. */
  nameSide: 'left' | 'right';
}

/** A rising emoji is this wide and tall, so it travels this much further to be fully off the screen. */
const RISE_SIZE = 36;
/** Room left beside a phone's emoji for the sender's name. */
const NAME_ROOM = 96;
/** The narrowest a name may be beside the board, and how far up the channel it rides before it is gone. */
const MIN_NAME_WIDTH = 56;
const NAME_SPAN = 140;
/** Space kept between a channel's emoji and name and the board or the channel's edge. */
const CHANNEL_INSET = 8;
/** Phones rise 3.2 s; the longer channels beside a board keep about the same speed, within limits. */
const PHONE_RISE_MS = 3200;
const RISE_PX_PER_S = 200;
const MAX_RISE_MS = 5200;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * A phone: the rise for a reaction over `board`, under the turn container `turn` (if any), on a `width`-wide screen.
 * `spot` (0 to 1) picks where along the board's top edge it starts, so reactions sent together don't stack.
 */
export function risePath(board: Rect, turn: Rect | null, width: number, spot: number): Rise {
  const left = board.left + RISE_SIZE / 2;
  const right = Math.max(left, board.right - NAME_ROOM);
  const gapTop = turn ? Math.min(turn.bottom, board.top) : board.top;
  return {
    x: Math.round(left + (right - left) * clamp(spot, 0, 1)),
    start: board.top,
    distance: board.top + RISE_SIZE,
    ms: PHONE_RISE_MS,
    nameBox: board.top > gapTop ? { left: 0, top: gapTop, right: width, bottom: board.top } : null,
    nameSide: 'right',
  };
}

/**
 * A wider screen: the rise up the free channel on `side` of `board`, between it and the screen's edge or the nearest
 * of `walls` beside it (the side rail), or null if the channel is too narrow for an emoji. It starts near the board's
 * bottom, above anything of `below` in the channel there (the chat button, which floats over the channel rather than
 * bounding it). The name shows beside the emoji, away from the board, over the first stretch of the rise, where the
 * channel is wide enough for one.
 */
export function sidePath(board: Rect, walls: Rect[], below: Rect[], width: number, side: 'left' | 'right', spot: number): Rise | null {
  const beside = walls.filter((r) => r.bottom > board.top && r.top < board.bottom);
  const outer =
    side === 'left'
      ? Math.max(0, ...beside.filter((r) => r.right <= board.left + 1).map((r) => r.right))
      : Math.min(width, ...beside.filter((r) => r.left >= board.right - 1).map((r) => r.left));
  const lo = (side === 'left' ? outer : board.right) + CHANNEL_INSET;
  const hi = (side === 'left' ? board.left : outer) - CHANNEL_INSET;
  if (hi - lo < RISE_SIZE) return null;

  // Above the chat button, if it is in the channel.
  const floor = Math.min(
    board.bottom - RISE_SIZE,
    ...below.filter((r) => r.right > lo && r.left < hi && r.top >= board.top).map((r) => r.top - RISE_SIZE),
  );
  const start = Math.round(floor);
  const withName = hi - lo >= RISE_SIZE + CHANNEL_INSET + MIN_NAME_WIDTH;
  // With a name, the emoji keeps to the board's side of the channel and the name takes the rest; without one, it
  // drifts a little across the channel so a stream of reactions doesn't stack.
  const near = side === 'left' ? hi - RISE_SIZE / 2 : lo + RISE_SIZE / 2;
  const sway = withName ? 0 : (hi - lo - RISE_SIZE) * clamp(spot, 0, 1);
  const x = Math.round(side === 'left' ? near - sway : near + sway);
  const distance = start + RISE_SIZE;
  return {
    x,
    start,
    distance,
    ms: Math.round(clamp((distance / RISE_PX_PER_S) * 1000, PHONE_RISE_MS, MAX_RISE_MS)),
    nameBox: withName ? { left: lo, top: Math.max(0, start - NAME_SPAN), right: hi, bottom: start + RISE_SIZE / 2 } : null,
    nameSide: side === 'left' ? 'left' : 'right',
  };
}

/**
 * The rise on the current screen for the `count`th reaction, or null where there is no board (the lobby) or no room
 * beside it. `extra` are the chat's own elements (its button), kept clear of like the game's.
 */
export function currentRise(count: number, phone: boolean, extra: Element[] = []): Rise | null {
  const boardElement = document.querySelector('[data-chat-anchor="board"]');
  const board = boardElement?.getBoundingClientRect();
  if (!board || board.width === 0) return null;
  // The golden ratio spreads one reaction's spot from the next.
  const spot = (count * 0.618034) % 1;
  if (phone) {
    const turn = document.querySelector('[data-chat-anchor="turn"]')?.getBoundingClientRect();
    return risePath(board, turn && turn.height > 0 ? turn : null, window.innerWidth, spot);
  }
  const rects = (elements: Element[]) => elements.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  const walls = rects([...document.querySelectorAll('[data-chat-avoid]')].filter((el) => el !== boardElement));
  const below = rects(extra);
  // Alternate sides, falling back to whichever has room.
  const sides = count % 2 === 0 ? (['right', 'left'] as const) : (['left', 'right'] as const);
  for (const side of sides) {
    const rise = sidePath(board, walls, below, window.innerWidth, side, spot);
    if (rise) return rise;
  }
  return null;
}
