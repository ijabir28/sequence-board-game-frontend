import { describe, expect, it } from 'vitest';
import { centerSquare } from './avatarImage';

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
