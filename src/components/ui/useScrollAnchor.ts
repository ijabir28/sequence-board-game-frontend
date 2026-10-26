import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Chrome and Firefox keep what you are looking at in place when content above it changes (CSS scroll anchoring). */
const nativeAnchoring = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('overflow-anchor', 'auto');

/**
 * Picks what to hold still: the focused element if it is on screen, else the first section or list item whose top is
 * on screen. Null at the top of the page, where content growing below is expected.
 */
export function pickAnchor(root: HTMLElement, viewportHeight: number, scrollY: number, active: Element | null): HTMLElement | null {
  if (scrollY <= 0) return null;
  const onScreen = (element: Element) => {
    const { top, bottom } = element.getBoundingClientRect();
    return bottom > 0 && top < viewportHeight;
  };
  if (active instanceof HTMLElement && active !== root && root.contains(active) && onScreen(active)) return active;
  for (const element of root.querySelectorAll<HTMLElement>('section, li')) {
    const { top } = element.getBoundingClientRect();
    if (top >= 0 && top < viewportHeight) return element;
  }
  return null;
}

/**
 * Where the browser has no scroll anchoring (Safari), keeps the page from jumping when `value` changes and content
 * above what you are reading grows or shrinks: measures an anchor before React applies the change, and scrolls by
 * however far it moved.
 */
export function useScrollAnchor(container: RefObject<HTMLElement | null>, value: unknown) {
  const committed = useRef(value);
  const snapshot = useRef<{ value: unknown; anchor: HTMLElement; top: number } | null>(null);

  // Measured while rendering, the one moment the page still shows the previous value.
  if (!nativeAnchoring && value !== committed.current && snapshot.current?.value !== value && container.current) {
    const anchor = pickAnchor(container.current, window.innerHeight, window.scrollY, document.activeElement);
    snapshot.current = anchor ? { value, anchor, top: anchor.getBoundingClientRect().top } : null;
  }

  useLayoutEffect(() => {
    committed.current = value;
    const taken = snapshot.current;
    snapshot.current = null;
    if (!taken || taken.value !== value || !taken.anchor.isConnected) return;
    const moved = taken.anchor.getBoundingClientRect().top - taken.top;
    if (Math.abs(moved) >= 1) window.scrollBy(0, moved);
  }, [value]);
}
