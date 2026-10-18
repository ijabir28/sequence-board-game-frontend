import { cardKind, numberedLabel, parseCard, type CardName } from '../../engine/cards';
import styles from './NumberedCard.module.css';

/**
 * A card face of the Numbered deck: its number (1 to 48) in the corners and large in the middle, or for a jack what
 * it does, Wild or Remove. Each suit's run of twelve numbers keeps the suit's colour, so the four ranges are easy to
 * tell apart. Like DrawnCard it fills its parent and scales with it.
 */
export function NumberedCard({ card, className }: { card: CardName; className?: string }) {
  const { suit } = parseCard(card);
  const label = numberedLabel(card);
  const jack = cardKind(card) !== 'normal';
  return (
    <span className={[styles.face, className].filter(Boolean).join(' ')} data-suit={suit} aria-hidden="true">
      {jack ? (
        <span className={styles.power}>{label}</span>
      ) : (
        <>
          <span className={styles.index}>{label}</span>
          <span className={[styles.index, styles.turned].join(' ')}>{label}</span>
          <span className={styles.number}>{label}</span>
        </>
      )}
    </span>
  );
}
