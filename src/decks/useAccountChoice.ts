import { useEffect, useRef } from 'react';
import { saveBoardStyle, saveCardDeck } from '../api/user';
import {
  currentBoardStyle,
  currentDeck,
  DEFAULT_BOARD_STYLE,
  DEFAULT_DECK,
  isBoardStyle,
  isDeckId,
  onBoardStyleChange,
  onDeckChange,
  setBoardStyle,
  setDeck,
} from './decks';

/** A display choice remembered on this device that a signed-in player also keeps on their account. */
export interface AccountChoice<T extends string> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
  /** Whether this app still has an option by that id. */
  known: (id: string | null) => id is T;
  fallback: T;
  save: (value: T) => Promise<void>;
}

export const CARD_DECK_CHOICE: AccountChoice<ReturnType<typeof currentDeck>> = {
  get: currentDeck,
  set: setDeck,
  subscribe: onDeckChange,
  known: isDeckId,
  fallback: DEFAULT_DECK,
  save: saveCardDeck,
};

export const BOARD_STYLE_CHOICE: AccountChoice<ReturnType<typeof currentBoardStyle>> = {
  get: currentBoardStyle,
  set: setBoardStyle,
  subscribe: onBoardStyleChange,
  known: isBoardStyle,
  fallback: DEFAULT_BOARD_STYLE,
  save: saveBoardStyle,
};

/**
 * What to do when an account's profile arrives: show its choice on this device, upload this device's choice (an
 * account that never chose, from someone who picked before choices were saved), or nothing.
 */
export function reconcileChoice<T extends string>(
  account: string | null,
  device: T,
  { known, fallback }: Pick<AccountChoice<T>, 'known' | 'fallback'>,
): { apply: T } | { upload: T } | null {
  // An option this app no longer has is left alone on the account; the device keeps its own.
  if (account !== null) return known(account) && account !== device ? { apply: account } : null;
  return device !== fallback ? { upload: device } : null;
}

/**
 * Keeps a display choice (the card deck, the board style) on the signed-in player's account, so it follows them to
 * every device: the account's choice replaces this device's when they sign in, and one made here is saved to the
 * account. Signed out (or in hot-seat play) it is only remembered on this device.
 */
export function useAccountChoice<T extends string>(
  handle: string | null,
  account: string | null,
  choice: AccountChoice<T>,
  onSaveFailed: () => void,
) {
  // The value the account is known to have, so changes made here are saved once and the account's own isn't echoed.
  const saved = useRef<string | null>(null);
  const failed = useRef(onSaveFailed);
  failed.current = onSaveFailed;

  useEffect(() => {
    if (handle === null) return;
    const save = (value: T) => {
      saved.current = value;
      choice.save(value).catch(() => {
        saved.current = null;
        failed.current();
      });
    };
    saved.current = account;
    const step = reconcileChoice(account, choice.get(), choice);
    if (step && 'apply' in step) {
      saved.current = step.apply;
      choice.set(step.apply);
    } else if (step) {
      save(step.upload);
    }
    return choice.subscribe(() => {
      const value = choice.get();
      if (value !== saved.current) save(value);
    });
  }, [handle, account, choice]);
}
