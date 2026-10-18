import { describe, expect, it } from 'vitest';
import { BOARD_STYLE_CHOICE, CARD_DECK_CHOICE, reconcileChoice } from './useAccountChoice';

describe('reconcileChoice', () => {
  it("shows the account's choice on this device", () => {
    expect(reconcileChoice('classic', 'original', CARD_DECK_CHOICE)).toEqual({ apply: 'classic' });
    expect(reconcileChoice('cards', 'dark', BOARD_STYLE_CHOICE)).toEqual({ apply: 'cards' });
  });

  it('does nothing when both already agree', () => {
    expect(reconcileChoice('classic', 'classic', CARD_DECK_CHOICE)).toBeNull();
  });

  it("uploads this device's choice to an account that never chose", () => {
    expect(reconcileChoice(null, 'jumbo', CARD_DECK_CHOICE)).toEqual({ upload: 'jumbo' });
    expect(reconcileChoice(null, 'cards', BOARD_STYLE_CHOICE)).toEqual({ upload: 'cards' });
  });

  it('leaves an account that never chose alone while this device has the default', () => {
    expect(reconcileChoice(null, 'original', CARD_DECK_CHOICE)).toBeNull();
    expect(reconcileChoice(null, 'dark', BOARD_STYLE_CHOICE)).toBeNull();
  });

  it('ignores an option this app no longer has, keeping the device its own', () => {
    expect(reconcileChoice('retired-deck', 'jumbo', CARD_DECK_CHOICE)).toBeNull();
    expect(reconcileChoice('neon', 'cards', BOARD_STYLE_CHOICE)).toBeNull();
  });
});
