import { describe, expect, it } from 'vitest';
import { BAND_HEIGHT, findLane, freeIntervals, risePath, sidePath, wavyKeyframes } from './safeLane';

const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

describe('freeIntervals', () => {
  it('leaves the stretches nothing in the columns covers, with a margin', () => {
    expect(freeIntervals([rect(0, 100, 50, 200), rect(0, 150, 50, 300), rect(400, 0, 500, 1000)], 0, 100, 0, 500)).toEqual([
      [0, 96],
      [304, 500],
    ]);
  });
});

describe('findLane', () => {
  // A 375 × 812 phone's game: turn panel, board (with room above and below it), hand strip, chat button.
  const phone = [rect(0, 0, 375, 126), rect(12, 193, 363, 544), rect(0, 610, 375, 812), rect(315, 748, 363, 796)];

  it('uses the band nearest the bottom on a phone with room round the board', () => {
    expect(findLane(phone, 375, 812, 'right')).toEqual({ left: 0, top: 606 - BAND_HEIGHT, width: 375, height: BAND_HEIGHT, direction: 'row' });
  });

  it('has no lane on a phone whose board fills the screen', () => {
    expect(findLane([rect(0, 0, 375, 100), rect(0, 100, 375, 500), rect(0, 500, 375, 667)], 375, 667, 'right')).toBeNull();
  });

  it('uses a column beside the board on a wide screen, on the chat button\'s side', () => {
    // Header, board in the middle, rail on the right, chat button bottom-left.
    const wide = [rect(0, 0, 1440, 52), rect(400, 60, 1040, 700), rect(1060, 52, 1440, 900), rect(16, 836, 64, 884)];
    expect(findLane(wide, 1440, 900, 'left')).toEqual({ left: 0, top: 832 - 260, width: 220, height: 260, direction: 'column' });
  });
});

describe('risePath', () => {
  const board = rect(12, 175, 363, 526);
  const turn = rect(0, 0, 375, 126);

  it('starts on the board\'s top edge and leaves the screen, with the name confined to the gap above the board', () => {
    expect(risePath(board, turn, 375, 0)).toEqual({
      x: 30,
      start: 175,
      distance: 211,
      ms: 3200,
      nameBox: rect(0, 126, 375, 175),
      nameSide: 'right',
      wave: null,
    });
  });

  it('spreads reactions along the board, leaving room for the name', () => {
    expect(risePath(board, turn, 375, 1).x).toBe(267);
    expect(risePath(board, turn, 375, 0.5).x).toBe(149);
  });

  it('has no name when the turn container reaches the board', () => {
    expect(risePath(board, rect(0, 0, 375, 200), 375, 0.5).nameBox).toBeNull();
    expect(risePath(board, null, 375, 0.5).nameBox).toBeNull();
  });
});

describe('sidePath', () => {
  // A wide screen: header, board, rail on the right, chat button in the bottom-left corner.
  const board = rect(300, 60, 1000, 760);
  const walls = [rect(0, 0, 1440, 52), rect(1060, 52, 1440, 900)];
  const button = [rect(16, 836, 64, 884)];
  const always = (value: number) => () => value;

  it('rises up a narrow channel between the board and the rail, with no room for a name and a small wave', () => {
    // 44 px of channel: wide enough for the emoji, not for a name; the wave keeps to the 4 px left either side.
    expect(sidePath(board, walls, button, 1440, 'right', always(0))).toEqual({
      x: 1030,
      start: 724,
      distance: 760,
      ms: 3800,
      nameBox: null,
      nameSide: 'right',
      wave: { amplitude: 4, cycles: 1.5, phase: 0 },
    });
  });

  it('keeps a name beside the board where the channel is wide, its wave on the board\'s side', () => {
    const rise = sidePath(board, walls, button, 1440, 'left', always(0))!;
    expect(rise).toMatchObject({ x: 264, start: 724, nameSide: 'left', wave: { amplitude: 10 } });
    expect(rise.nameBox).toEqual(rect(8, 584, 292, 742));
  });

  it('starts above the chat button where it floats in the channel, without narrowing the channel', () => {
    // The board reaches down past the chat button's top.
    const rise = sidePath(rect(125, 69, 940, 884), walls, button, 1440, 'left', always(0.5))!;
    expect(rise).toMatchObject({ x: 80, start: 800, nameSide: 'left', wave: { amplitude: 19, cycles: 2.25, phase: 3.142 } });
    expect(rise.nameBox).toEqual(rect(8, 660, 117, 818));
  });

  it('never lets the wave carry the emoji out of its channel, whatever is drawn', () => {
    const draws = [0, 0.13, 0.5, 0.77, 0.999];
    for (const [side, lo, hi] of [['left', 8, 292], ['right', 1008, 1052]] as const) {
      for (const a of draws) {
        for (const b of draws) {
          const values = [a, b, a, b];
          const rise = sidePath(board, walls, button, 1440, side, () => values.shift() ?? 0)!;
          expect(rise.x - rise.wave!.amplitude - 18).toBeGreaterThanOrEqual(lo);
          expect(rise.x + rise.wave!.amplitude + 18).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it('has no channel where the board meets the screen edge', () => {
    expect(sidePath(rect(10, 60, 1430, 760), [], [], 1440, 'left', always(0))).toBeNull();
  });
});

describe('wavyKeyframes', () => {
  const across = (frame: Keyframe) => Number(/translate\((-?[\d.]+)px/.exec(String(frame.transform))![1]);
  const up = (frame: Keyframe) => Number(/, (-?[\d.]+)px\)/.exec(String(frame.transform))![1]);

  it('pops in where it starts, rises the whole distance and fades out', () => {
    const frames = wavyKeyframes(760, { amplitude: 20, cycles: 2, phase: 1 });
    expect(frames[0]).toMatchObject({ offset: 0, opacity: 0 });
    expect(across(frames[0])).toBe(0);
    expect(frames.at(-1)).toMatchObject({ offset: 1, opacity: 0 });
    expect(up(frames.at(-1)!)).toBe(-760);
  });

  it('waves across within its amplitude, and differently for another draw', () => {
    const one = wavyKeyframes(760, { amplitude: 20, cycles: 2, phase: 1 }).map(across);
    const other = wavyKeyframes(760, { amplitude: 20, cycles: 2.8, phase: 4 }).map(across);
    expect(Math.max(...one.map(Math.abs))).toBeLessThanOrEqual(20);
    expect(Math.max(...one)).toBeGreaterThan(15);
    expect(Math.min(...one)).toBeLessThan(-15);
    expect(other).not.toEqual(one);
  });
});
