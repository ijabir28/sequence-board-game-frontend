import type { Suit } from '../../engine/cards';

// The four suits as vector shapes on a 24px grid. Unlike the ♠♥♦♣ characters they look the same on every device
// (some phones draw ♥ and ♦ as emoji) and stay sharp at any size. They are filled with currentColor.
const SHAPES: Record<Suit, JSX.Element> = {
  Heart: (
    <path d="M12 21.5C5 16 1.5 12.3 1.5 7.9 1.5 4.6 4 2.2 7 2.2c2.1 0 4 1.2 5 3.1 1-1.9 2.9-3.1 5-3.1 3 0 5.5 2.4 5.5 5.7 0 4.4-3.5 8.1-10.5 13.6z" />
  ),
  Diamond: <path d="M12 1.5c2.4 3.9 5.2 7.4 8.5 10.5-3.3 3.1-6.1 6.6-8.5 10.5-2.4-3.9-5.2-7.4-8.5-10.5C6.8 8.9 9.6 5.4 12 1.5z" />,
  Spade: (
    <path d="M12 1.5c-3.2 4.3-10 8.3-10 13 0 2.8 2.2 4.8 4.9 4.8 1.8 0 3.3-.9 4.2-2.3-.2 2.3-1.2 4.1-3 5.5h7.8c-1.8-1.4-2.8-3.2-3-5.5.9 1.4 2.4 2.3 4.2 2.3 2.7 0 4.9-2 4.9-4.8 0-4.7-6.8-8.7-10-13z" />
  ),
  Club: (
    <>
      <circle cx="12" cy="6.6" r="4.6" />
      <circle cx="6.6" cy="14" r="4.6" />
      <circle cx="17.4" cy="14" r="4.6" />
      <path d="M10.2 9.5h3.6l.1 5.4c.3 3 1.5 5.4 3.4 7.6H6.7c1.9-2.2 3.1-4.6 3.4-7.6z" />
    </>
  ),
};

/** A suit pip. Decorative: the card or cell it is on carries the accessible name. */
export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {SHAPES[suit]}
    </svg>
  );
}
