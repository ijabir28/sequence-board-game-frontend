import type { KeyboardEvent, ReactNode } from 'react';
import { cardShort } from '../../engine/cards';
import { movedOrder } from '../../game/handOrder';
import type { HandCardView } from '../../game/types';
import { HandCard } from '../hand/HandCard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './HandPanel.module.css';
import { useCardDrag } from './useCardDrag';

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
  disabled?: boolean;
  /** Contextual hint and buttons under the cards. */
  footer?: ReactNode;
  /** Replaces the cards entirely (for example the game-over panel). */
  replaceWith?: ReactNode;
  /** Overrides the summary next to the title in the docked strip. */
  summary?: string;
}

/**
 * The player's hand. On wide screens it sits in the side rail; on phones and tablets it is a
 * horizontal strip docked at the bottom, always open.
 */
export function HandPanel({
  title,
  hand,
  order,
  onReorder,
  selected,
  onSelect,
  cover,
  disabled,
  footer,
  replaceWith,
  summary: summaryOverride,
}: HandPanelProps) {
  const arrange = !cover && onReorder ? onReorder : null;
  const move = (from: number, to: number) => arrange?.(movedOrder(order, from, to));
  const keys = order.map((handIndex) => `${handIndex}-${hand[handIndex]?.card}`);
  // Drag a card to a new place (mouse, pen or touch); the other cards glide out of the way.
  const drag = useCardDrag({ keys, enabled: arrange !== null, onMove: move });

  // Alt+Left/Right moves the focused card. Its button keeps focus, since cards are keyed by identity.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!arrange || !event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    const slot = Number((event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot);
    if (Number.isNaN(slot)) return;
    event.preventDefault();
    move(slot, slot + (event.key === 'ArrowLeft' ? -1 : 1));
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
    <section className={styles.panel} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      {/* The docked strip's heading: the title with what is selected. */}
      <div className={styles.bar}>
        <span className={styles.barTitle}>{title}</span>
        <span className={styles.summary}>{summary}</span>
      </div>
      <div className={styles.body}>
        {replaceWith ?? (
          <>
            <div
              className={[styles.cards, arrange && styles.arrangeable].filter(Boolean).join(' ')}
              role="group"
              aria-label="Cards in hand"
              onKeyDown={onKeyDown}
              {...drag.containerProps}
            >
              {cover
                ? hand.map((_, i) => <span key={i} className={styles.back} aria-hidden="true" />)
                : order.map((handIndex, slot) => {
                    const h = hand[handIndex];
                    const key = keys[slot];
                    return (
                      // Keyed by the hand index, so a card keeps its element (and focus) when it moves.
                      <div
                        key={key}
                        ref={drag.slotRef(key)}
                        className={styles.slot}
                        data-slot={slot}
                        data-key={key}
                        data-dragging={drag.draggingKey === key || undefined}
                      >
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
