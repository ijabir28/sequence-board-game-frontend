import { BOARD_SIZE, inBounds, isCorner, posKey, type Pos } from './board';
import type { TeamIndex } from './setup';

export type ChipGrid = readonly (readonly (TeamIndex | null)[])[];

export interface Sequence {
  team: TeamIndex;
  cells: Pos[];
}

export const SEQUENCE_LENGTH = 5;

export const DIRECTIONS: readonly Pos[] = [
  { row: 0, column: 1 }, // horizontal
  { row: 1, column: 0 }, // vertical
  { row: 1, column: 1 }, // diagonal ↘
  { row: 1, column: -1 }, // diagonal ↙
];

/** Corners are free spaces that count for every team. */
export function countsFor(chips: ChipGrid, pos: Pos, team: TeamIndex): boolean {
  return isCorner(pos) || chips[pos.row][pos.column] === team;
}

/** Contiguous cells owned by `team` through `origin` along one direction, in board order. */
function runThrough(chips: ChipGrid, origin: Pos, dir: Pos, team: TeamIndex): Pos[] {
  let start = origin;
  for (;;) {
    const prev = { row: start.row - dir.row, column: start.column - dir.column };
    if (!inBounds(prev) || !countsFor(chips, prev, team)) break;
    start = prev;
  }
  const run: Pos[] = [];
  for (let p = start; inBounds(p) && countsFor(chips, p, team); p = { row: p.row + dir.row, column: p.column + dir.column }) {
    run.push(p);
  }
  return run;
}

/**
 * New sequences completed by `team` placing a chip at `placed`.
 *
 * Every 5-long window of owned cells through the new chip is a candidate. A candidate is
 * accepted if it shares at most one cell with the team's sequences so far (existing ones
 * plus any accepted in this same move). That allows exactly one chip to be shared between
 * two sequences, e.g. a 9-long line or two lines crossing at the new chip, and stops a
 * 6-long line from counting twice.
 */
export function findNewSequences(chips: ChipGrid, existing: readonly Sequence[], team: TeamIndex, placed: Pos): Sequence[] {
  if (!countsFor(chips, placed, team)) return [];
  const claimed = new Set(existing.filter((s) => s.team === team).flatMap((s) => s.cells.map(posKey)));
  const found: Sequence[] = [];

  for (const dir of DIRECTIONS) {
    const run = runThrough(chips, placed, dir, team);
    if (run.length < SEQUENCE_LENGTH) continue;
    const at = run.findIndex((p) => p.row === placed.row && p.column === placed.column);
    const firstStart = Math.max(0, at - (SEQUENCE_LENGTH - 1));
    const lastStart = Math.min(at, run.length - SEQUENCE_LENGTH);
    for (let start = firstStart; start <= lastStart; start++) {
      const cells = run.slice(start, start + SEQUENCE_LENGTH);
      const shared = cells.filter((p) => claimed.has(posKey(p))).length;
      if (shared > 1) continue;
      found.push({ team, cells });
      cells.forEach((p) => claimed.add(posKey(p)));
    }
  }
  return found;
}

/** Whether the chip at `pos` belongs to a completed sequence (and so can't be removed). */
export function isLocked(sequences: readonly Sequence[], pos: Pos): boolean {
  return sequences.some((s) => s.cells.some((p) => p.row === pos.row && p.column === pos.column));
}

export function emptyChipGrid(): (TeamIndex | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array<TeamIndex | null>(BOARD_SIZE).fill(null));
}
