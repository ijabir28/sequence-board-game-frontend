import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './Tooltip.module.css';

/**
 * Tips are declared on the control itself, as data attributes (see `tipProps` and `Tooltip`), and drawn by one
 * TooltipLayer mounted at the app root. A single layer means no wrapper elements around controls, and because the
 * tip sits in the browser's top layer it shows above modal dialogs and is never clipped by a scroll container.
 */
export type TipSide = 'top' | 'bottom';
export type TipAlign = 'start' | 'center' | 'end';

export const TIP_ATTR = 'data-tip';
const SIDE_ATTR = 'data-tip-side';
const ALIGN_ATTR = 'data-tip-align';

/** Data attributes that give an element a tip. Use `Tooltip` instead when the text isn't already in its label. */
export function tipProps(text: string | null | undefined, side?: TipSide, align?: TipAlign): Record<string, string | undefined> {
  if (!text) return {};
  return { [TIP_ATTR]: text, [SIDE_ATTR]: side, [ALIGN_ATTR]: align };
}

const HOVER_DELAY_MS = 350;
/** Moving straight from one tipped control to the next shows the next tip at once. */
const WARM_MS = 400;
const EDGE = 8;
const GAP = 6;

interface Open {
  target: HTMLElement;
  /** Keyboard focus opened it, so only blur closes it, not the pointer leaving. */
  focus: boolean;
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? node.closest<HTMLElement>(`[${TIP_ATTR}]`) : null;
}

export function TooltipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [text, setText] = useState('');
  const openRef = useRef(open);
  openRef.current = open;

  // Pointer and focus tracking, for the whole document.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closedAt = 0;

    const show = (target: HTMLElement, focus: boolean, delay: number) => {
      clearTimeout(timer);
      const warm = openRef.current !== null || performance.now() - closedAt < WARM_MS;
      const go = () => setOpen({ target, focus });
      if (delay === 0 || warm) go();
      else timer = setTimeout(go, delay);
    };
    const hide = () => {
      clearTimeout(timer);
      if (openRef.current) closedAt = performance.now();
      setOpen(null);
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      // The pointer may rest on the tip itself without it closing (WCAG 1.4.13).
      if (ref.current?.contains(event.target as Node)) return clearTimeout(timer);
      const target = tipTarget(event.target);
      const current = openRef.current;
      if (current?.focus) return;
      if (!target) return hide();
      if (target !== current?.target) show(target, false, HOVER_DELAY_MS);
      else clearTimeout(timer);
    };
    const onPointerOut = (event: PointerEvent) => {
      // Leaving the window altogether.
      if (event.relatedTarget === null && event.pointerType !== 'touch' && !openRef.current?.focus) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement;
      const target = tipTarget(el);
      // Only keyboard focus: a mouse click already showed (or skipped) the hover tip.
      if (target && el.matches(':focus-visible')) show(target, true, 0);
    };
    const onFocusOut = () => {
      if (openRef.current?.focus) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openRef.current) hide();
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // Follow the target: its text may change ("Copied"), and it may move or leave the page while the tip is up.
  useEffect(() => {
    if (!open) return;
    const { target } = open;
    const read = () => {
      const next = target.getAttribute(TIP_ATTR);
      if (!next || !target.isConnected) setOpen(null);
      else setText(next);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(target, { attributes: true, attributeFilter: [TIP_ATTR] });
    let frame = requestAnimationFrame(function tick() {
      if (!target.isConnected) return setOpen(null);
      place(ref.current, target);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [open]);

  // In the top layer while open, so it stacks above any modal dialog opened before it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const visible = open !== null && text !== '';
    if (typeof el.showPopover === 'function') {
      if (visible && !el.matches(':popover-open')) el.showPopover();
      if (!visible && el.matches(':popover-open')) el.hidePopover();
    }
    if (visible && open) place(el, open.target);
  }, [open, text]);

  useLayoutEffect(() => ref.current?.setAttribute('popover', 'manual'), []);

  return (
    <div ref={ref} className={styles.tip} data-open={open !== null && text !== ''} aria-hidden="true">
      {text}
    </div>
  );
}

/** Puts the tip on the preferred side of its target, flipping if it doesn't fit, and keeps it on screen. */
function place(tip: HTMLElement | null, target: HTMLElement) {
  if (!tip) return;
  const box = target.getBoundingClientRect();
  const { width, height } = tip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  const preferred = (target.getAttribute(SIDE_ATTR) as TipSide | null) ?? 'bottom';
  const above = box.top - GAP - height;
  const below = box.bottom + GAP;
  const fitsAbove = above >= EDGE;
  const fitsBelow = below + height <= vh - EDGE;
  const side = preferred === 'top' ? (fitsAbove || !fitsBelow ? 'top' : 'bottom') : fitsBelow || !fitsAbove ? 'bottom' : 'top';
  const top = side === 'top' ? above : below;

  const align = (target.getAttribute(ALIGN_ATTR) as TipAlign | null) ?? 'center';
  const ideal = align === 'start' ? box.left : align === 'end' ? box.right - width : box.left + box.width / 2 - width / 2;
  const left = Math.min(Math.max(ideal, EDGE), Math.max(EDGE, vw - width - EDGE));

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(Math.min(Math.max(top, EDGE), vh - height - EDGE))}px`;
  tip.dataset.side = side;
}
