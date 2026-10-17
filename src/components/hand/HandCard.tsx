import { memo, useState } from 'react';
import { cardImageUrl, cardKind, cardLabel, isRedSuit, parseCard, SUIT_SYMBOL, type CardName } from '../../engine/cards';
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

// Remember failures for the whole session so a missing backend doesn't cause a burst of 404s.
let imagesUnavailable = false;

/** One card in the player's hand. Memoised: it re-renders only when its own props change, not on every game update. */
export const HandCard = memo(function HandCard({ card, handIndex, index, selected, dead, disabled = false, onSelect }: HandCardProps) {
  const [imageFailed, setImageFailed] = useState(imagesUnavailable);
  const kind = cardKind(card);
  const { rank, suit } = parseCard(card);
  const hint = kind === 'normal' ? (dead ? 'dead card, both cells taken' : null) : JACK_HINT[kind];
  const tip = `${cardLabel(card)}. ${
    kind !== 'normal'
      ? JACK_TIP[kind]
      : dead
        ? 'Dead: both of its cells are taken. Pick it, then Exchange dead.'
        : 'Pick it, then place a chip on one of its two cells.'
  } Key ${index + 1}.`;

  return (
    <button
      type="button"
      className={[styles.card, selected && styles.selected, dead && styles.dead].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-label={[`${cardLabel(card)}`, hint, `key ${index + 1}`].filter(Boolean).join(', ')}
      disabled={disabled}
      onClick={() => onSelect(handIndex)}
      {...tipProps(tip, 'top')}
    >
      {imageFailed ? (
        <span className={[styles.face, isRedSuit(suit) && styles.red].filter(Boolean).join(' ')} aria-hidden="true">
          <span className={styles.index}>
            {rank}
            <br />
            {SUIT_SYMBOL[suit]}
          </span>
          <span className={styles.pip}>{SUIT_SYMBOL[suit]}</span>
        </span>
      ) : (
        <img
          className={styles.image}
          src={cardImageUrl(card)}
          alt=""
          draggable={false}
          onError={() => {
            imagesUnavailable = true;
            setImageFailed(true);
          }}
        />
      )}
      {kind !== 'normal' && (
        <span className={[styles.badge, kind === 'one-eyed-jack' ? styles.badgeRemove : styles.badgeWild].join(' ')} aria-hidden="true">
          {JACK_BADGE[kind]}
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
