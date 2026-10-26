import { describe, expect, it } from 'vitest';
import { followDraft } from './RoomOptions';

describe('followDraft', () => {
  it('keeps what was typed when it already reads as the saved number', () => {
    expect(followDraft('045', 45)).toBe('045');
    expect(followDraft('45', 45)).toBe('45');
  });

  it('takes the saved number when the field says something else, or nothing', () => {
    expect(followDraft('4', 45)).toBe('45');
    expect(followDraft('', 0)).toBe('0');
  });
});
