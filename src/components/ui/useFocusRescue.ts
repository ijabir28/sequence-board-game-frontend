import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Keeps keyboard focus inside `container` when a live update takes the focused control away (a team dropped, a seat
 * row gone) or disables it: focus moves to the nearest ancestor still on the page, without scrolling, so the next Tab
 * carries on from there instead of from the top of the page.
 */
export function useFocusRescue(container: RefObject<HTMLElement | null>) {
  // The focused element, then its ancestors up to the container, as the page was before this render.
  const trail = useRef<HTMLElement[]>([]);

  // Noted while rendering, before React changes the page (focus events can't be relied on: a window without focus
  // moves document.activeElement without firing them).
  const root = container.current;
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (root && active instanceof HTMLElement && active !== root && root.contains(active)) {
    const path: HTMLElement[] = [];
    for (let element: HTMLElement | null = active; element && element !== root.parentElement; element = element.parentElement) path.push(element);
    trail.current = path;
  }

  // After every commit: React has changed the page, the browser hasn't painted yet.
  useLayoutEffect(() => {
    const [focused, ...ancestors] = trail.current;
    trail.current = [];
    if (!focused) return;
    const now = document.activeElement;
    const lost = focused.isConnected ? focused.matches(':disabled') && (now === focused || now === document.body) : now === null || now === document.body;
    if (!lost) return;
    const target = ancestors.find((element) => element.isConnected);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    target.focus({ preventScroll: true });
  });
}
