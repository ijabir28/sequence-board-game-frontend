import layoutJson from './board-layout.json';
import { BLANK, type BoardCardName, type CardName } from './cards';

// board-layout.json is a verbatim copy of the backend's data/board_deck.json:
// a 10×10 grid indexed [row][column] from the top-left.

export const BOARD_SIZE = 10;

export interface Pos {
  row: number;
  column: number;
}

export const BOARD_LAYOUT: readonly (readonly BoardCardName[])[] = (layoutJson as { name: string }[][]).map((row) =>
  row.map((cell) => cell.name as BoardCardName),
);

export function isCorner(pos: Pos): boolean {
  return BOARD_LAYOUT[pos.row][pos.column] === BLANK;
}

export function inBounds(pos: Pos): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.column >= 0 && pos.column < BOARD_SIZE;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.column === b.column;
}

export function posKey(pos: Pos): string {
  return `${pos.row},${pos.column}`;
}

const POSITIONS_BY_CARD = new Map<CardName, Pos[]>();
BOARD_LAYOUT.forEach((row, r) =>
  row.forEach((name, c) => {
    if (name === BLANK) return;
    const list = POSITIONS_BY_CARD.get(name) ?? [];
    list.push({ row: r, column: c });
    POSITIONS_BY_CARD.set(name, list);
  }),
);

/** Both board cells showing this card (empty for jacks, which are not on the board). */
export function positionsOf(card: CardName): readonly Pos[] {
  return POSITIONS_BY_CARD.get(card) ?? [];
}
