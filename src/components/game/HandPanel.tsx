import { useId, type ReactNode } from 'react';
import { cardShort } from '../../engine/cards';
import type { HandCardView } from '../../game/types';
import { HandCard } from '../hand/HandCard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './HandPanel.module.css';

interface HandPanelProps {
  title: string;
  hand: HandCardView[];
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
export function HandPanel({ title, hand, selected, onSelect, cover, open, onToggle, disabled, footer, replaceWith, summary: summaryOverride }: HandPanelProps) {
  const bodyId = useId();
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
            <div className={styles.cards} role="group" aria-label="Cards in hand">
              {cover
                ? hand.map((_, i) => <span key={i} className={styles.back} aria-hidden="true" />)
                : hand.map((h, i) => (
                    <HandCard
                      key={`${i}-${h.card}`}
                      card={h.card}
                      index={i}
                      dead={h.dead}
                      selected={selected === i}
                      disabled={disabled}
                      onSelect={() => onSelect(i)}
                    />
                  ))}
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
