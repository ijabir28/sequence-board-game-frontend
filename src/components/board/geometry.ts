import { BOARD_SIZE } from '../../engine/board';

// The board is square. Its grid is inset from the edge and has gaps between cells; both are in percent of the
// board's width, and must match Board.module.css (.grid inset 1.1cqw, gap 0.6cqw).
export const BOARD_INSET = 1.1;
export const BOARD_GAP = 0.6;
const GRID = 100 - 2 * BOARD_INSET;
const CELL = (GRID - (BOARD_SIZE - 1) * BOARD_GAP) / BOARD_SIZE;

/**
 * Where the centre of row or column `index` is, in a 0–100 box covering the grid (the sequence lines' viewBox).
 * Allows for the gaps, so lines pass exactly through the chips.
 */
export function cellCentre(index: number): number {
  return ((index * (CELL + BOARD_GAP) + CELL / 2) / GRID) * 100;
}
