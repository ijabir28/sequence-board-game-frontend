import { describe, expect, it } from 'vitest';
import { reconcileDeck } from './useAccountDeck';

describe('reconcileDeck', () => {
  it("shows the account's deck on this device", () => {
    expect(reconcileDeck('classic', 'original')).toEqual({ apply: 'classic' });
  });

  it('does nothing when both already agree', () => {
    expect(reconcileDeck('classic', 'classic')).toBeNull();
  });

  it("uploads this device's deck to an account that never chose one", () => {
    expect(reconcileDeck(null, 'jumbo')).toEqual({ upload: 'jumbo' });
  });

  it('leaves an account without a deck alone while this device has the default', () => {
    expect(reconcileDeck(null, 'original')).toBeNull();
  });

  it('ignores a deck this app no longer has, keeping the device its own', () => {
    expect(reconcileDeck('retired-deck', 'jumbo')).toBeNull();
  });
});
