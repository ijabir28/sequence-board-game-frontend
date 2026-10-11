import { describe, expect, it } from 'vitest';
import type { Pos } from './board';
import { emptyChipGrid, findNewSequences, isLocked, type Sequence } from './sequences';
import type { TeamIndex } from './setup';

const p = (row: number, column: number): Pos => ({ row, column });

function grid(cells: Pos[], team: TeamIndex = 0) {
  const chips = emptyChipGrid();
  cells.forEach((c) => (chips[c.row][c.column] = team));
  return chips;
}

const line = (row: number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => p(row, from + i));

describe('findNewSequences', () => {
  it('finds a horizontal sequence of five', () => {
    const chips = grid(line(4, 2, 6));
    const found = findNewSequences(chips, [], 0, p(4, 4));
    expect(found).toHaveLength(1);
    expect(found[0].cells).toEqual(line(4, 2, 6));
  });

  it('finds vertical and both diagonal sequences', () => {
    const vertical = Array.from({ length: 5 }, (_, i) => p(2 + i, 3));
    expect(findNewSequences(grid(vertical), [], 0, p(6, 3))).toHaveLength(1);

    const down = Array.from({ length: 5 }, (_, i) => p(1 + i, 1 + i));
    expect(findNewSequences(grid(down), [], 0, p(3, 3))).toHaveLength(1);

    const up = Array.from({ length: 5 }, (_, i) => p(1 + i, 8 - i));
    expect(findNewSequences(grid(up), [], 0, p(5, 4))).toHaveLength(1);
  });

  it('does not count four in a row', () => {
    expect(findNewSequences(grid(line(4, 2, 5)), [], 0, p(4, 5))).toHaveLength(0);
  });

  it('does not count chips of another team', () => {
    const chips = grid(line(4, 2, 5));
    chips[4][6] = 1;
    expect(findNewSequences(chips, [], 0, p(4, 5))).toHaveLength(0);
  });

  it('counts a corner as a chip for every team', () => {
    const cells = line(0, 1, 4); // (0,0) is a corner
    expect(findNewSequences(grid(cells, 0), [], 0, p(0, 4))[0].cells).toEqual(line(0, 0, 4));
    expect(findNewSequences(grid(cells, 2), [], 2, p(0, 4))).toHaveLength(1);
  });

  it('finds a diagonal through a corner', () => {
    const cells = Array.from({ length: 4 }, (_, i) => p(1 + i, 1 + i));
    const found = findNewSequences(grid(cells), [], 0, p(4, 4));
    expect(found).toHaveLength(1);
    expect(found[0].cells[0]).toEqual(p(0, 0));
  });

  it('does not count a sixth chip in the same line as a new sequence', () => {
    const existing: Sequence[] = [{ team: 0, cells: line(4, 1, 5) }];
    expect(findNewSequences(grid(line(4, 1, 6)), existing, 0, p(4, 6))).toHaveLength(0);
  });

  it('allows a second sequence in the same line that shares one chip', () => {
    const existing: Sequence[] = [{ team: 0, cells: line(4, 0, 4) }];
    const found = findNewSequences(grid(line(4, 0, 8)), existing, 0, p(4, 8));
    expect(found).toHaveLength(1);
    expect(found[0].cells).toEqual(line(4, 4, 8));
  });

  it('rejects a second sequence that shares two chips', () => {
    const existing: Sequence[] = [{ team: 0, cells: line(4, 0, 4) }];
    expect(findNewSequences(grid(line(4, 0, 7)), existing, 0, p(4, 7))).toHaveLength(0);
  });

  it('finds two sequences at once when the middle of a 9-long line is filled', () => {
    const found = findNewSequences(grid(line(4, 0, 8)), [], 0, p(4, 4));
    expect(found.map((s) => s.cells)).toEqual([line(4, 0, 4), line(4, 4, 8)]);
  });

  it('finds two crossing sequences that share the new chip', () => {
    const cells = [...line(5, 1, 5), ...Array.from({ length: 5 }, (_, i) => p(1 + i, 3))];
    const found = findNewSequences(grid(cells), [], 0, p(5, 3));
    expect(found).toHaveLength(2);
  });

  it('lets a crossing sequence share one chip with an existing one', () => {
    const existing: Sequence[] = [{ team: 0, cells: line(5, 1, 5) }];
    const cells = [...line(5, 1, 5), ...Array.from({ length: 5 }, (_, i) => p(1 + i, 3))];
    expect(findNewSequences(grid(cells), existing, 0, p(1, 3))).toHaveLength(1);
  });

  it('ignores sequences of other teams when counting shared chips', () => {
    const existing: Sequence[] = [{ team: 1, cells: line(4, 2, 6) }];
    expect(findNewSequences(grid(line(4, 2, 6)), existing, 0, p(4, 6))).toHaveLength(1);
  });
});

describe('isLocked', () => {
  it('reports chips that belong to a sequence', () => {
    const seqs: Sequence[] = [{ team: 0, cells: line(4, 2, 6) }];
    expect(isLocked(seqs, p(4, 3))).toBe(true);
    expect(isLocked(seqs, p(4, 7))).toBe(false);
  });
});
