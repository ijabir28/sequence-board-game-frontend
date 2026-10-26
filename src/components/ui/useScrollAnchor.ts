import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** Chrome and Firefox keep what you are looking at in place when content above it changes (CSS scroll anchoring). */
const nativeAnchoring = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('overflow-anchor', 'auto');

function onScreen(element: Element, viewportHeight: number): boolean {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < viewportHeight;
}

/**
 * Picks what to hold still: the focused control, else the one last touched or clicked (a phone doesn't focus a tapped
 * radio or button), if it is on screen; else, without native anchoring, the first section or list item whose top is
 * on screen. Null at the top of the page, where content growing below is expected.
 */
export function pickAnchor(root: HTMLElement, viewportHeight: number, scrollY: number, active: Element | null, touched: Element | null): HTMLElement | null {
  if (scrollY <= 0) return null;
  for (const element of [active, touched]) {
    if (element instanceof HTMLElement && element !== root && element.isConnected && root.contains(element) && onScreen(element, viewportHeight)) return element;
  }
  if (nativeAnchoring) return null;
  for (const element of root.querySelectorAll<HTMLElement>('section, li')) {
    const { top } = element.getBoundingClientRect();
    if (top >= 0 && top < viewportHeight) return element;
  }
  return null;
}

/**
 * Keeps the page from jumping when `value` changes and content above what you are using grows or shrinks: measures an
 * anchor before React applies the change, and scrolls by however far it moved. Native scroll anchoring isn't enough on
 * its own: it holds the first thing on screen still, so on a phone a team added under the top of the screen still
 * pushes the host's table options, which they are tapping, down the page.
 */
export function useScrollAnchor(container: RefObject<HTMLElement | null>, value: unknown) {
  const committed = useRef(value);
  const snapshot = useRef<{ value: unknown; anchor: HTMLElement; top: number } | null>(null);
  const touched = useRef<Element | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const onPointerDown = (event: PointerEvent) => {
      touched.current = event.target instanceof Element ? event.target : null;
    };
    root.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => root.removeEventListener('pointerdown', onPointerDown);
  }, [container]);

  // Measured while rendering, the one moment the page still shows the previous value.
  if (value !== committed.current && snapshot.current?.value !== value && container.current) {
    const anchor = pickAnchor(container.current, window.innerHeight, window.scrollY, document.activeElement, touched.current);
    snapshot.current = anchor ? { value, anchor, top: anchor.getBoundingClientRect().top } : null;
  }

  useLayoutEffect(() => {
    committed.current = value;
    const taken = snapshot.current;
    snapshot.current = null;
    if (!taken || taken.value !== value || !taken.anchor.isConnected) return;
    // Read after the browser's own anchoring (if any) has had its say, so the two never add up.
    const moved = taken.anchor.getBoundingClientRect().top - taken.top;
    if (Math.abs(moved) >= 1) window.scrollBy(0, moved);
  }, [value]);
}
