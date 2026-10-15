import { useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cardShort } from '../../engine/cards';
import { movedOrder, shuffledOrder, sortedOrder } from '../../game/handOrder';
import type { HandCardView } from '../../game/types';
import { HandCard } from '../hand/HandCard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import styles from './HandPanel.module.css';

interface HandPanelProps {
  title: string;
  hand: HandCardView[];
  /** Display order: order[slot] is the hand index shown in that slot. */
  order: readonly number[];
  /** Rearranges the hand in this view only. Without it the hand can't be rearranged. */
  onReorder?: (order: number[]) => void;
  /** Hand index of the selected card. */
  selected: number | null;
  onSelect: (index: number) => void;
  /** Hot-seat: the hand stays face down until its owner reveals it. */
  cover: { playerName: string; onReveal: () => void } | null;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Contextual hint and buttons under the cards. */
  footer?: ReactNode;
  /** Replaces the cards entirely (for example the game-over panel). */
  replaceWith?: ReactNode;
  /** Overrides the collapsed-strip summary. */
  summary?: string;
}

/**
 * The player's hand. On wide screens it sits in the side rail; on phones and tablets it is a
 * horizontal strip docked at the bottom that can be collapsed to give the board more room.
 */
export function HandPanel({
  title,
  hand,
  order,
  onReorder,
  selected,
  onSelect,
  cover,
  open,
  onToggle,
  disabled,
  footer,
  replaceWith,
  summary: summaryOverride,
}: HandPanelProps) {
  const bodyId = useId();
  const arrange = !cover && onReorder ? onReorder : null;
  const selectedSlot = selected === null ? -1 : order.indexOf(selected);
  const drag = useRef<{ slot: number; x: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  const move = (from: number, to: number) => arrange?.(movedOrder(order, from, to));

  // Alt+Left/Right moves the focused card. Its button keeps focus, since cards are keyed by identity.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!arrange || !event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    const slot = Number((event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot);
    if (Number.isNaN(slot)) return;
    event.preventDefault();
    move(slot, slot + (event.key === 'ArrowLeft' ? -1 : 1));
  };

  // Mouse and pen drag a card along the hand. Touch keeps scrolling and uses the move buttons instead.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!arrange || event.pointerType === 'touch' || event.button !== 0) return;
    const slot = Number((event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot);
    if (!Number.isNaN(slot)) drag.current = { slot, x: event.clientX, moved: false, pointerId: event.pointerId };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.abs(event.clientX - current.x) < 8) return;
    if (!current.moved) event.currentTarget.setPointerCapture(event.pointerId);
    current.moved = true;
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
    const to = over ? Number(over.dataset.slot) : NaN;
    if (!Number.isNaN(to) && to !== current.slot) {
      move(current.slot, to);
      current.slot = to;
    }
  };
  const onPointerEnd = () => {
    // A drag ends with a click on the card; don't let it select or deselect.
    suppressClick.current = drag.current?.moved ?? false;
    drag.current = null;
  };

  const selectedCard = selected !== null ? hand[selected]?.card : undefined;
  const summary = summaryOverride
    ? summaryOverride
    : cover
    ? `${cover.playerName}'s turn`
    : selectedCard
      ? `${cardShort(selectedCard)} selected`
      : `${hand.length} card${hand.length === 1 ? '' : 's'}`;

  return (
    <section className={styles.panel} data-open={open} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className={styles.toggleTitle}>{title}</span>
        <span className={styles.summary}>{summary}</span>
        <Icon name={open ? 'chevronDown' : 'chevronUp'} />
        <span className="visually-hidden">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      <div id={bodyId} className={styles.body}>
        {replaceWith ?? (
          <>
            {arrange && (
              <div className={styles.arrange} role="toolbar" aria-label="Arrange your hand">
                <span className={styles.arrangeLabel}>Arrange</span>
                <Tooltip text="Sort by suit and rank, jacks last. Only you see your order." side="top" align="start">
                  <Button size="sm" variant="ghost" onClick={() => arrange(sortedOrder(hand.map((h) => h.card)))}>
                    <Icon name="sort" size={16} />
                    Sort
                  </Button>
                </Tooltip>
                <Tooltip text="Mix up the order of your cards. Drag a card to move it." side="top">
                  <Button size="sm" variant="ghost" onClick={() => arrange(shuffledOrder(order))}>
                    <Icon name="shuffle" size={16} />
                    Shuffle
                  </Button>
                </Tooltip>
                {selectedSlot !== -1 && (
                  <span className={styles.moveButtons}>
                    <Tooltip text="Move left (Alt+←)" side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={selectedSlot === 0}
                        onClick={() => move(selectedSlot, selectedSlot - 1)}
                        aria-label="Move the selected card left"
                      >
                        <Icon name="chevronLeft" size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip text="Move right (Alt+→)" side="top" align="end">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={selectedSlot === order.length - 1}
                        onClick={() => move(selectedSlot, selectedSlot + 1)}
                        aria-label="Move the selected card right"
                      >
                        <Icon name="chevronRight" size={16} />
                      </Button>
                    </Tooltip>
                  </span>
                )}
              </div>
            )}
            <div
              className={[styles.cards, arrange && styles.arrangeable].filter(Boolean).join(' ')}
              role="group"
              aria-label="Cards in hand"
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClickCapture={(event) => {
                if (!suppressClick.current) return;
                suppressClick.current = false;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {cover
                ? hand.map((_, i) => <span key={i} className={styles.back} aria-hidden="true" />)
                : order.map((handIndex, slot) => {
                    const h = hand[handIndex];
                    return (
                      // Keyed by the hand index, so a card keeps its element (and focus) when it moves.
                      <div key={`${handIndex}-${h.card}`} className={styles.slot} data-slot={slot}>
                        <HandCard
                          card={h.card}
                          index={slot}
                          dead={h.dead}
                          selected={selected === handIndex}
                          disabled={disabled}
                          onSelect={() => onSelect(handIndex)}
                        />
                      </div>
                    );
                  })}
              {cover && (
                <div className={styles.cover}>
                  <p>
                    Pass the device to <strong>{cover.playerName}</strong>.
                  </p>
                  <Button variant="primary" onClick={cover.onReveal}>
                    <Icon name="eye" />
                    Show {cover.playerName}'s hand
                  </Button>
                </div>
              )}
            </div>
            {!cover && footer}
          </>
        )}
      </div>
    </section>
  );
}
