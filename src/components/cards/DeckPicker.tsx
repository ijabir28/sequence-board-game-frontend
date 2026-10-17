import { useId, useState, type CSSProperties } from 'react';
import { BOARD_STYLES, DECKS, useBoardStyle, useDeck, type Deck } from '../../decks/decks';
import { parseCard, type CardName } from '../../engine/cards';
import { DrawnCard } from './DrawnCard';
import { SuitIcon } from './SuitIcon';
import styles from './DeckPicker.module.css';

// A spread that shows off each deck: a pip card of each colour and two court cards.
const SAMPLE: readonly CardName[] = ['A-Spade', '10-Diamond', 'K-Heart', 'J-Club'];

/** A sample card of `deck`, drawn instead if its image can't be loaded. */
function SampleCard({ deck, card }: { deck: Deck; card: CardName }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={styles.card} style={{ '--card-aspect': deck.aspect } as CSSProperties}>
      {deck.image && !failed ? (
        <img src={deck.image(card)} alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <DrawnCard card={card} />
      )}
    </span>
  );
}

/**
 * Chooses the design of the cards in your hand. The change applies at once, also to a game in progress, and is
 * remembered on this device and on a signed-in player's account.
 */
export function DeckPicker({ onPicked }: { onPicked?: (deck: Deck) => void }) {
  const [current, setDeck] = useDeck();
  const name = useId();
  return (
    <div className={styles.list} role="radiogroup" aria-label="Card deck">
      {DECKS.map((deck) => (
        <label key={deck.id} className={[styles.option, deck.id === current.id && styles.chosen].filter(Boolean).join(' ')}>
          <input
            type="radio"
            className={styles.radio}
            name={name}
            value={deck.id}
            checked={deck.id === current.id}
            onChange={() => {
              setDeck(deck.id);
              onPicked?.(deck);
            }}
          />
          <span className={styles.spread} aria-hidden="true">
            {SAMPLE.map((card) => (
              <SampleCard key={card} deck={deck} card={card} />
            ))}
          </span>
          <span className={styles.text}>
            <strong>{deck.name}</strong>
            <span>{deck.description}</span>
            <small>{deck.credit}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

// Board cells for the board style preview: one of each suit.
const SAMPLE_CELLS: readonly CardName[] = ['7-Spade', 'Q-Heart', '10-Diamond', '3-Club'];

/** Chooses how the board's cells look. They follow the chosen deck's suit colours either way. */
export function BoardStylePicker() {
  const [style, setStyle] = useBoardStyle();
  const [deck] = useDeck();
  const name = useId();
  return (
    <div className={styles.boardStyles} role="radiogroup" aria-label="Board cells">
      {BOARD_STYLES.map((option) => (
        <label key={option.id} className={[styles.option, styles.boardOption, option.id === style && styles.chosen].filter(Boolean).join(' ')}>
          <input
            type="radio"
            className={styles.radio}
            name={name}
            value={option.id}
            checked={option.id === style}
            onChange={() => setStyle(option.id)}
          />
          <span
            className={styles.cells}
            data-cells={option.id}
            data-suits={deck.suits}
            style={{ '--deck-face': deck.face } as CSSProperties}
            aria-hidden="true"
          >
            {SAMPLE_CELLS.map((card) => {
              const { rank, suit } = parseCard(card);
              return (
                <span key={card} className={styles.cell} data-suit={suit}>
                  <span>{rank}</span>
                  <SuitIcon suit={suit} className={styles.cellSuit} />
                </span>
              );
            })}
          </span>
          <span className={styles.text}>
            <strong>{option.name}</strong>
            <span>{option.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
