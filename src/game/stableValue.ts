import { useRef } from 'react';
import type { HandCardView } from './types';

/** Same cards, in the same places, with the same dead marks. */
export function sameHand(a: readonly HandCardView[], b: readonly HandCardView[]): boolean {
  return a.length === b.length && a.every((h, i) => h.card === b[i].card && h.dead === b[i].dead);
}

export function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/**
 * `value`, or the one from the last render when `same` says nothing changed. Game sources send a fresh snapshot on
 * every update, so this keeps an unchanged hand the same object and lets memoised components skip re-rendering.
 */
export function useStableValue<T>(value: T, same: (a: T, b: T) => boolean): T {
  const kept = useRef(value);
  if (kept.current !== value && !same(kept.current, value)) kept.current = value;
  return kept.current;
}
