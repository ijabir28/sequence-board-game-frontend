import { memo, useState, type CSSProperties } from 'react';
import { useDeck, type DeckId } from '../../decks/decks';
import { cardKind, cardLabel, type CardName } from '../../engine/cards';
import { DrawnCard } from '../cards/DrawnCard';
import { NumberedCard } from '../cards/NumberedCard';
import { tipProps } from '../ui/TooltipLayer';
import styles from './HandCard.module.css';

interface HandCardProps {
  card: CardName;
  /** The card's index in the real hand, passed back to onSelect. */
  handIndex: number;
  /** Where it is shown (the player may have rearranged their hand): its number key is index + 1. */
  index: number;
  selected: boolean;
  dead: boolean;
  /** This card is in the move drafted for the player's next turn. */
  drafted?: boolean;
  disabled?: boolean;
  /** Called with handIndex. A stable function lets an unchanged card skip re-rendering. */
  onSelect: (handIndex: number) => void;
}

const JACK_BADGE = { 'two-eyed-jack': 'Wild', 'one-eyed-jack': 'Remove' } as const;
const JACK_HINT = {
  'two-eyed-jack': 'two-eyed jack, place on any empty cell',
  'one-eyed-jack': "one-eyed jack, remove an opponent's chip",
} as const;

const JACK_TIP = {
  'two-eyed-jack': 'Wild: place a chip on any empty cell.',
  'one-eyed-jack': "Remove an opponent's chip that isn't in a sequence.",
} as const;

// Decks whose images failed to load, remembered for the whole session so a missing backend (the original deck comes
// from it) doesn't cause a burst of 404s. Their cards are drawn instead.
const unavailableDecks = new Set<DeckId>();

/** One card in the player's hand. Memoised: it re-renders only when its own props change, not on every game update. */
export const HandCard = memo(function HandCard({ card, handIndex, index, selected, dead, drafted = false, disabled = false, onSelect }: HandCardProps) {
  const [deck] = useDeck();
  const [, setFailures] = useState(0);
  const image = deck.image && !unavailableDecks.has(deck.id) ? deck.image(card) : null;
  const kind = cardKind(card);
  const hint = kind === 'normal' ? (dead ? 'dead card, both cells taken' : null) : JACK_HINT[kind];
  const notation = deck.notation;
  const tip = `${cardLabel(card, notation)}. ${
    drafted
      ? 'Queued for your next turn. Pick it again to cancel the drafted move.'
      : kind !== 'normal'
      ? JACK_TIP[kind]
      : dead
        ? 'Dead: both of its cells are taken. Pick it, then Exchange dead.'
        : 'Pick it, then place a chip on one of its two cells.'
  } Key ${index + 1}.`;

  return (
    <button
      type="button"
      className={[styles.card, selected && styles.selected, dead && styles.dead, drafted && styles.drafted].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-label={[`${cardLabel(card, notation)}`, hint, drafted && 'drafted for your next turn, pick again to cancel', `key ${index + 1}`].filter(Boolean).join(', ')}
      disabled={disabled}
      style={{ '--card-aspect': deck.aspect } as CSSProperties}
      onClick={() => onSelect(handIndex)}
      {...tipProps(tip, 'top')}
    >
      {image ? (
        <img
          key={image}
          className={styles.image}
          src={image}
          alt=""
          draggable={false}
          onError={() => {
            unavailableDecks.add(deck.id);
            setFailures((n) => n + 1);
          }}
        />
      ) : notation === 'numbers' ? (
        <NumberedCard card={card} />
      ) : (
        <DrawnCard card={card} />
      )}
      {/* A numbered jack already says Wild or Remove on its face. */}
      {kind !== 'normal' && notation !== 'numbers' && (
        <span className={[styles.badge, kind === 'one-eyed-jack' ? styles.badgeRemove : styles.badgeWild].join(' ')} aria-hidden="true">
          {JACK_BADGE[kind]}
        </span>
      )}
      {drafted && (
        <span className={[styles.badge, styles.badgeQueued].join(' ')} aria-hidden="true">
          Queued
        </span>
      )}
      {dead && (
        <span className={[styles.badge, styles.badgeDead].join(' ')} aria-hidden="true">
          Dead
        </span>
      )}
    </button>
  );
});
