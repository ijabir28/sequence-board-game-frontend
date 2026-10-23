import { describe, expect, it } from 'vitest';
import { BAND_HEIGHT, findLane, freeIntervals } from './safeLane';

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
