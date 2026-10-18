import { describe, expect, it } from 'vitest';
import { centerSquare, clampCrop, cropSquare, initialCrop, MAX_ZOOM, panCrop } from './avatarImage';

describe('centerSquare', () => {
  it('crops the middle of a wide picture', () => {
    expect(centerSquare(400, 200)).toEqual([100, 0, 200]);
  });

  it('crops the middle of a tall picture', () => {
    expect(centerSquare(200, 401)).toEqual([0, 100, 200]);
  });

  it('keeps a square picture whole', () => {
    expect(centerSquare(256, 256)).toEqual([0, 0, 256]);
  });
});

describe('cropSquare', () => {
  it('starts as the largest centred square', () => {
    expect(cropSquare(initialCrop(400, 200), 400, 200)).toEqual([100, 0, 200]);
  });

  it('shrinks the square around its centre when zoomed in', () => {
    expect(cropSquare({ cx: 200, cy: 100, zoom: 2 }, 400, 200)).toEqual([150, 50, 100]);
  });

  it('keeps the square inside the picture', () => {
    expect(cropSquare({ cx: 0, cy: 999, zoom: 2 }, 400, 200)).toEqual([0, 100, 100]);
  });
});

describe('clampCrop', () => {
  it('keeps the zoom between 1 and MAX_ZOOM', () => {
    expect(clampCrop({ cx: 50, cy: 50, zoom: 0.5 }, 100, 100).zoom).toBe(1);
    expect(clampCrop({ cx: 50, cy: 50, zoom: 99 }, 100, 100).zoom).toBe(MAX_ZOOM);
  });
});

describe('panCrop', () => {
  it('moves the picture with the pointer, so the square moves the other way', () => {
    // A 200 px frame over a 200 px-high picture: one screen pixel is one picture pixel at zoom 1.
    expect(panCrop(initialCrop(400, 200), 50, 0, 200, 400, 200)).toEqual({ cx: 150, cy: 100, zoom: 1 });
  });

  it('moves in finer steps when zoomed in', () => {
    expect(panCrop({ cx: 200, cy: 100, zoom: 2 }, 0, 20, 200, 400, 200)).toEqual({ cx: 200, cy: 90, zoom: 2 });
  });

  it('stops at the edge of the picture', () => {
    expect(panCrop(initialCrop(400, 200), -999, 0, 200, 400, 200)).toEqual({ cx: 300, cy: 100, zoom: 1 });
  });
});
