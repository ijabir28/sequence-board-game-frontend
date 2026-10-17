import { useEffect, useRef } from 'react';
import { saveCardDeck } from '../api/user';
import { currentDeck, DEFAULT_DECK, isDeckId, onDeckChange, setDeck, type DeckId } from './decks';

/**
 * What to do when an account's profile arrives: show its deck on this device, upload this device's deck (an account
 * that never chose one, from someone who picked a deck before decks were saved), or nothing.
 */
export function reconcileDeck(accountDeck: string | null, deviceDeck: DeckId): { apply: DeckId } | { upload: DeckId } | null {
  // A deck this app no longer has is left alone on the account; the device keeps its own.
  if (accountDeck !== null) return isDeckId(accountDeck) && accountDeck !== deviceDeck ? { apply: accountDeck } : null;
  return deviceDeck !== DEFAULT_DECK ? { upload: deviceDeck } : null;
}

/**
 * Keeps the signed-in player's hand card deck on their account, so it follows them to every device: the account's
 * deck replaces this device's when they sign in, and a deck picked here is saved to the account. Signed out (or in
 * hot-seat play) the deck is only remembered on this device.
 */
export function useAccountDeck(handle: string | null, accountDeck: string | null, onSaveFailed: () => void) {
  // The deck the account is known to have, so changes made here are saved once and the account's own isn't echoed.
  const saved = useRef<string | null>(null);
  const failed = useRef(onSaveFailed);
  failed.current = onSaveFailed;

  useEffect(() => {
    if (handle === null) return;
    const save = (deck: DeckId) => {
      saved.current = deck;
      saveCardDeck(deck).catch(() => {
        saved.current = null;
        failed.current();
      });
    };
    saved.current = accountDeck;
    const step = reconcileDeck(accountDeck, currentDeck());
    if (step && 'apply' in step) {
      saved.current = step.apply;
      setDeck(step.apply);
    } else if (step) {
      save(step.upload);
    }
    return onDeckChange(() => {
      const deck = currentDeck();
      if (deck !== saved.current) save(deck);
    });
  }, [handle, accountDeck]);
}
