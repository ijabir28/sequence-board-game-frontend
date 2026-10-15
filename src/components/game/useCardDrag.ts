import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Drag-to-rearrange for a row (or wrapped rows) of cards, with the same code for mouse, pen and touch.
//
// - A press that moves less than DRAG_THRESHOLD is a tap: the card's own click selects it as usual.
// - Past the threshold the card lifts and follows the pointer; whenever it is nearer another slot's centre, the
//   order changes (onMove) and the other cards glide to their new places (a FLIP animation).
// - On release the card settles into its slot (a CSS transition on the slot).
//
// Positions come from offsetLeft/offsetTop, which ignore transforms, so a card that is being dragged or animated
// never measures itself mid-move.

const DRAG_THRESHOLD = 8;
const GLIDE_MS = 180;

interface Press {
  pointerId: number;
  key: string;
  slot: number;
  startX: number;
  startY: number;
  /** Where the card was grabbed, relative to its top-left corner. */
  grabX: number;
  grabY: number;
  dragging: boolean;
}

export interface CardDrag {
  /** Spread on the element that holds the slots (it must be their offsetParent: position: relative). */
  containerProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => void;
  };
  /** Ref callback for each slot, by its stable key. */
  slotRef: (key: string) => (el: HTMLElement | null) => void;
  /** The key of the card being dragged. */
  draggingKey: string | null;
}

export function useCardDrag({ keys, enabled, onMove }: { keys: readonly string[]; enabled: boolean; onMove: (from: number, to: number) => void }): CardDrag {
  const slots = useRef(new Map<string, HTMLElement>());
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const lastPositions = useRef(new Map<string, { left: number; top: number }>());
  // Where the dragged card's top-left should be, relative to the container.
  const [dragging, setDragging] = useState<{ key: string; x: number; y: number } | null>(null);

  // FLIP: after the order changes, every card that moved (except the one in hand) starts where it was and glides
  // to its new place.
  const order = keys.join('|');
  useLayoutEffect(() => {
    const next = new Map<string, { left: number; top: number }>();
    slots.current.forEach((el, key) => {
      const now = { left: el.offsetLeft, top: el.offsetTop };
      next.set(key, now);
      const before = lastPositions.current.get(key);
      if (!before || key === press.current?.key || typeof el.animate !== 'function') return;
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (dx === 0 && dy === 0) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : GLIDE_MS,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    });
    lastPositions.current = next;
  }, [order]);

  // The dragged card follows the pointer. Applied after layout, so when the order changes mid-drag the offset is
  // taken from the card's new slot and it doesn't jump.
  useLayoutEffect(() => {
    if (!dragging) return;
    const el = slots.current.get(dragging.key);
    if (!el) return;
    el.style.transform = `translate(${dragging.x - el.offsetLeft}px, ${dragging.y - el.offsetTop}px)`;
    return () => {
      el.style.transform = '';
    };
  }, [dragging, order]);

  const slotOf = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest<HTMLElement>('[data-slot]');
    return el ? { el, slot: Number(el.dataset.slot), key: el.dataset.key ?? '' } : null;
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    const current = press.current;
    if (!current || current.pointerId !== event.pointerId) return;
    // A drag ends with a click on the card; don't let it select or deselect.
    suppressClick.current = current.dragging;
    press.current = null;
    setDragging(null);
  };

  return {
    containerProps: {
      onPointerDown(event) {
        if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const hit = slotOf(event.target);
        if (!hit) return;
        const box = event.currentTarget.getBoundingClientRect();
        press.current = {
          pointerId: event.pointerId,
          key: hit.key,
          slot: hit.slot,
          startX: event.clientX,
          startY: event.clientY,
          grabX: event.clientX - (box.left + hit.el.offsetLeft),
          grabY: event.clientY - (box.top + hit.el.offsetTop),
          dragging: false,
        };
      },
      onPointerMove(event) {
        const current = press.current;
        if (!current || current.pointerId !== event.pointerId) return;
        if (!current.dragging) {
          if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_THRESHOLD) return;
          current.dragging = true;
          try {
            // Keeps the drag going when the finger or mouse strays outside the hand.
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Not every pointer can be captured; the drag still works inside the hand.
          }
        }
        const box = event.currentTarget.getBoundingClientRect();
        // The card's top-left, where the pointer would put it, relative to the container.
        const x = event.clientX - box.left - current.grabX;
        const y = event.clientY - box.top - current.grabY;

        // Move into the slot whose centre is nearest the card's centre.
        const el = slots.current.get(current.key);
        if (el) {
          const centreX = x + el.offsetWidth / 2;
          const centreY = y + el.offsetHeight / 2;
          let nearest = current.slot;
          let best = Infinity;
          slots.current.forEach((other) => {
            const distance = Math.hypot(other.offsetLeft + other.offsetWidth / 2 - centreX, other.offsetTop + other.offsetHeight / 2 - centreY);
            if (distance < best) {
              best = distance;
              nearest = Number(other.dataset.slot);
            }
          });
          if (nearest !== current.slot) {
            onMove(current.slot, nearest);
            current.slot = nearest;
          }
          setDragging({ key: current.key, x, y });
        }
      },
      onPointerUp: end,
      onPointerCancel: end,
      onClickCapture(event) {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
    slotRef: (key) => (el) => {
      if (el) slots.current.set(key, el);
      else slots.current.delete(key);
    },
    draggingKey: dragging?.key ?? null,
  };
}
