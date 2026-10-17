import { parseCard, type CardName } from '../../engine/cards';
import { SuitIcon } from './SuitIcon';
import styles from './DrawnCard.module.css';

const COURTS = new Set(['J', 'Q', 'K']);

/**
 * A card face drawn with HTML and SVG instead of an image: the Minimal deck, and the stand-in when a deck's images
 * can't be loaded. Corner indices top-left and (turned round) bottom-right, a big pip in the middle, and a framed
 * letter for the court cards. It fills its parent and scales with it.
 */
export function DrawnCard({ card, className }: { card: CardName; className?: string }) {
  const { rank, suit } = parseCard(card);
  const court = COURTS.has(rank);
  const index = (
    <>
      <span className={styles.rank}>{rank}</span>
      <SuitIcon suit={suit} className={styles.indexPip} />
    </>
  );
  return (
    <span className={[styles.face, className].filter(Boolean).join(' ')} data-suit={suit} aria-hidden="true">
      <span className={styles.index}>{index}</span>
      <span className={[styles.index, styles.turned].join(' ')}>{index}</span>
      {court ? (
        <span className={styles.court}>
          <span className={styles.courtLetter}>{rank}</span>
          <SuitIcon suit={suit} className={styles.courtPip} />
        </span>
      ) : (
        <SuitIcon suit={suit} className={styles.pip} />
      )}
    </span>
  );
}
