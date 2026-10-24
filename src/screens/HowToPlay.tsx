import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { BackToDashboard } from '../components/BackToDashboard';
import backStyles from '../components/BackToDashboard.module.css';
import { Chip } from '../components/Chip';
import { PoweredBy } from '../components/PoweredBy';
import { SuitIcon } from '../components/cards/SuitIcon';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { useBoardStyle, useDeck } from '../decks/decks';
import { NO_ESC_KEY, useMediaQuery } from '../game/useMediaQuery';
import { BLANK, parseCard, type BoardCardName, type CardName } from '../engine/cards';
import { HAND_SIZE_BY_PLAYER_COUNT, type TeamIndex } from '../engine/setup';
import styles from './Forms.module.css';
import own from './HowToPlay.module.css';

/*
 * The rules, one step at a time, each with a small picture. The pictures are drawn live from the game's own chips and
 * suits, in the viewer's board style, so they always look like the real board. A step can show an image instead: put
 * it in public/how-to-play/ and give the step an `image` (see Figure).
 */

interface Step {
  id: string;
  title: string;
  /** A few words for the contents list. */
  short: string;
  body: ReactNode;
  figure?: ReactNode;
  caption?: string;
  /** A picture to show in place of the drawn figure, e.g. { src: '/how-to-play/board.png', alt: '…' }. */
  image?: { src: string; alt: string };
}

const STEPS: Step[] = [
  {
    id: 'goal',
    title: 'The goal: five in a row',
    short: 'The goal',
    body: (
      <>
        <p>
          Sequence is played in two or three teams. Each team has its own chips, told apart by colour <em>and</em> shape:
          green circles, blue diamonds and red triangles.
        </p>
        <p>
          Put five of your team's chips in a straight line, across, down or diagonally, and you have made a{' '}
          <strong>sequence</strong>. Make enough sequences before the other teams do and you win the round.
        </p>
      </>
    ),
    figure: <MiniBoard rows={[(['7-Heart', '8-Heart', '9-Heart', '10-Heart', 'Q-Heart'] as const).map((card) => ({ card, chip: 0, locked: true }))]} />,
    caption: 'Five green chips in a row: a sequence. Its chips get a bright rim and are now locked.',
  },
  {
    id: 'board',
    title: 'The board',
    short: 'The board',
    body: (
      <>
        <p>
          The board is a 10 × 10 grid of playing cards. Every card except the jacks is printed on it <strong>twice</strong>,
          so each card in your hand has two cells it can go on.
        </p>
        <p>
          The four <strong>star corners</strong> are free cells. Nobody puts a chip on them; they count as a chip for every
          team, so a corner and four chips beside it already make a sequence.
        </p>
      </>
    ),
    figure: (
      <MiniBoard
        rows={[
          [{ card: BLANK }, { card: '6-Diamond' }, { card: '7-Diamond' }, { card: '8-Diamond' }],
          [{ card: '5-Diamond' }, { card: '3-Heart' }, { card: '2-Heart' }, { card: '3-Spade' }],
          [{ card: '4-Diamond' }, { card: '4-Heart' }, { card: 'K-Diamond' }, { card: 'A-Diamond' }],
        ]}
      />
    ),
    caption: 'The top-left corner of the board. The star cell counts for everyone.',
  },
  {
    id: 'turn',
    title: 'Taking your turn',
    short: 'Your turn',
    body: (
      <ol className={own.list}>
        <li>
          <strong>Pick a card</strong> from your hand. With “Highlight legal cells” on, the cells it can go on light up.
        </li>
        <li>
          <strong>Place your chip</strong> on one of the two cells showing that card, if it is still empty.
        </li>
        <li>
          A new card is <strong>drawn for you</strong> and play passes to the next player, who is always on another team.
        </li>
      </ol>
    ),
    figure: (
      <div className={own.flow}>
        <div className={own.hand}>
          <MiniCard card="3-Club" />
          <MiniCard card="7-Spade" selected />
          <MiniCard card="K-Heart" />
        </div>
        <Icon name="chevronRight" size={28} className={own.arrow} />
        <MiniBoard
          rows={[
            [{ card: '6-Spade' }, { card: '7-Spade', mark: 'target' }, { card: '8-Spade', chip: 1 }],
            [{ card: '7-Spade', mark: 'target' }, { card: '2-Club' }, { card: '9-Heart', chip: 0 }],
          ]}
        />
      </div>
    ),
    caption: 'The 7♠ is picked, and both 7♠ cells light up. Either one will do.',
  },
  {
    id: 'jacks',
    title: 'Jacks: wild and remove',
    short: 'Jacks',
    body: (
      <>
        <p>Jacks are not on the board. They are the strongest cards in the deck, and there are two kinds.</p>
        <ul className={own.list}>
          <li>
            <strong>Two-eyed jacks</strong> (clubs and diamonds) are <strong>wild</strong>: put your chip on any empty cell.
          </li>
          <li>
            <strong>One-eyed jacks</strong> (spades and hearts) <strong>remove</strong> one chip of another team. That is
            your whole turn: you don't place a chip. A chip in a finished sequence is locked and can't be removed.
          </li>
        </ul>
      </>
    ),
    figure: (
      <div className={own.jacks}>
        <div className={own.jackGroup}>
          <div className={own.hand}>
            <MiniCard card="J-Club" tag="Wild" />
            <MiniCard card="J-Diamond" tag="Wild" />
          </div>
          <span>Two-eyed</span>
        </div>
        <div className={own.jackGroup}>
          <div className={own.hand}>
            <MiniCard card="J-Spade" tag="Remove" />
            <MiniCard card="J-Heart" tag="Remove" />
          </div>
          <span>One-eyed</span>
        </div>
      </div>
    ),
    caption: 'Two-eyed jacks place a chip anywhere; one-eyed jacks take one away.',
  },
  {
    id: 'dead',
    title: 'Dead cards',
    short: 'Dead cards',
    body: (
      <>
        <p>
          When both cells of a card are already covered, the card can never be played: it is <strong>dead</strong>. Before
          you play, you can exchange it for a new card.
        </p>
        <p>
          Each room decides how dead cards work: whether they are marked in your hand or you spot them yourself, whether
          they are swapped for you when your turn starts, and how many you may exchange in one turn.
        </p>
      </>
    ),
    figure: (
      <div className={own.flow}>
        <div className={own.hand}>
          <MiniCard card="5-Club" tag="Dead" dead />
        </div>
        <Icon name="chevronRight" size={28} className={own.arrow} />
        <MiniBoard rows={[[{ card: '5-Club', chip: 1 }, { card: '4-Spade' }, { card: '5-Club', chip: 2 }]]} />
      </div>
    ),
    caption: 'Both 5♣ cells are taken, so the 5♣ in your hand is dead. Exchange it.',
  },
  {
    id: 'winning',
    title: 'Winning a round',
    short: 'Winning',
    body: (
      <>
        <table className={own.table}>
          <thead>
            <tr>
              <th scope="col">Teams</th>
              <th scope="col">Sequences to win</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2 teams</td>
              <td>2 sequences</td>
            </tr>
            <tr>
              <td>3 teams</td>
              <td>1 sequence</td>
            </tr>
          </tbody>
        </table>
        <p>
          Your two sequences may share <strong>one</strong> chip, so a line of nine counts as two. Once a sequence is made,
          its chips are locked for the rest of the round.
        </p>
      </>
    ),
    figure: (
      <MiniBoard
        rows={[
          (['2-Spade', '3-Spade', '4-Spade', '5-Spade', '6-Spade', '7-Spade', '8-Spade', '9-Spade', '10-Spade'] as const).map(
            (card, i) => ({ card, chip: 0 as TeamIndex, locked: true, shared: i === 4 }),
          ),
        ]}
        compact
      />
    ),
    caption: 'Nine in a row: two sequences that share the middle chip.',
  },
  {
    id: 'table',
    title: 'Teams and hands',
    short: 'Teams',
    body: (
      <>
        <p>
          Two or three teams, with the same number of players on each. Seats alternate between teams, so you never play
          right after a teammate. The more players, the fewer cards each one holds:
        </p>
        <table className={own.table}>
          <thead>
            <tr>
              <th scope="col">Players</th>
              <th scope="col">Cards each</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(HAND_SIZE_BY_PLAYER_COUNT).map(([players, cards]) => (
              <tr key={players}>
                <td>{players}</td>
                <td>{cards}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Keep your cards to yourself: talking about your hand with your team is against the rules.</p>
      </>
    ),
  },
  {
    id: 'online',
    title: 'Playing here',
    short: 'Playing here',
    body: (
      <ul className={own.list}>
        <li>
          <strong>New room</strong> opens a private room; share its code or link, and friends take a seat with{' '}
          <strong>Join a room</strong>. The host starts the game.
        </li>
        <li>
          With a <strong>turn timer</strong>, a bar round the board empties as your time runs out, turning red at the end.
        </li>
        <li>
          Not your turn yet? <strong>Draft</strong> your next move: pick a card and a cell, and it is played when your turn
          comes.
        </li>
        <li>
          New here? <strong>Training</strong>, at the top of the How to play page, walks you through every tricky rule in short
          lessons against a bot, then a practice match.
        </li>
        <li>
          No account or network? <strong>Pass and play</strong> passes one screen round the table.
        </li>
        <li>
          Pick your card deck and board look under <strong>Profile settings</strong>; this guide's pictures follow them.
        </li>
      </ul>
    ),
  },
];

/** The rules of Sequence as a page of its own, reached from the account menu. */
export function HowToPlay() {
  const { profile } = useAuth();
  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        {profile && <BackToDashboard className={own.back} tip="Go back to the dashboard: your rooms and games" />}
        <Link to="/how-to-play/training" className={own.training} {...tipProps('Short lessons against a bot, on the real board, then a practice match')}>
          <span className={own.trainingIcon} aria-hidden="true">
            <Icon name="bulb" size={22} />
          </span>
          <span className={own.trainingText}>
            <strong>Learn by playing</strong>
            <small>Interactive training: every tricky rule as a short lesson against a bot, then a practice match.</small>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
        <Guide
          end={
            <Link to={profile ? '/lobby' : '/local'} className={own.start}>
              {profile ? 'Start a game' : 'Try a game on this device'}
              <Icon name="chevronRight" size={16} />
            </Link>
          }
        />
        <PoweredBy />
      </div>
    </>
  );
}

/**
 * The same guide over a game, so a player can check a rule without leaving the table: a hot-seat game is not lost
 * and an online one keeps its place. It opens over everything, and "Back to the game" (or Escape) closes it.
 */
export function HowToPlayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const noEsc = useMediaQuery(NO_ESC_KEY);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The page itself takes focus, not the back button, so it doesn't open focused with its tip showing.
      dialog.focus();
      dialog.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={own.dialog} aria-label="How to play" tabIndex={-1} onClose={onClose}>
      {open && (
        <div className={styles.page}>
          <nav className={[backStyles.back, own.back].join(' ')} aria-label="Back">
            <button type="button" className={backStyles.link} onClick={onClose} {...tipProps(noEsc ? 'Close the guide and go back to the board' : 'Close the guide and go back to the board (Esc)', 'bottom', 'start')}>
              <Icon name="chevronLeft" size={18} />
              Back to the game
            </button>
          </nav>
          <Guide scroller={ref} />
          <PoweredBy />
        </div>
      )}
    </dialog>
  );
}

/** The intro, the contents list (beside the steps on wide screens) and the steps, with `end` after the last one. */
function Guide({ end, scroller }: { end?: ReactNode; scroller?: RefObject<HTMLElement> }) {
  // The contents scroll to a step without touching the address, so a game's URL never gains a #fragment.
  const goTo = (event: MouseEvent, id: string) => {
    event.preventDefault();
    const root = scroller?.current ?? document;
    root.querySelector<HTMLElement>(`[data-step="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className={own.layout}>
      <header className={[styles.header, own.intro].join(' ')}>
        <h1>How to play</h1>
        <p>Sequence in {STEPS.length} short steps, from your first chip to your winning line.</p>
      </header>

      <nav className={own.contents} aria-label="Steps">
        <ol>
          {STEPS.map((step, i) => (
            <li key={step.id}>
              <a href={`#${step.id}`} onClick={(event) => goTo(event, step.id)}>
                <span className={own.number}>{i + 1}</span>
                {step.short}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={own.steps}>
        {STEPS.map((step, i) => (
          <section key={step.id} id={step.id} data-step={step.id} className={[styles.card, own.step].join(' ')} aria-labelledby={`${step.id}-title`}>
            <h2 id={`${step.id}-title`}>
              <span className={own.number} aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <span className={own.visuallyHidden}>Step {i + 1}: </span>
                {step.title}
              </span>
            </h2>
            <div className={own.body}>{step.body}</div>
            {(step.figure || step.image) && <Figure image={step.image} caption={step.caption}>{step.figure}</Figure>}
          </section>
        ))}
        {end}
      </div>
    </div>
  );
}

/** A step's picture: an image when the step has one, otherwise the drawn diagram, otherwise a placeholder. */
function Figure({ image, caption, children }: { image?: Step['image']; caption?: string; children?: ReactNode }) {
  return (
    <figure className={own.figure}>
      <div className={own.canvas}>
        {image ? (
          <img src={image.src} alt={image.alt} loading="lazy" className={own.image} />
        ) : (
          (children ?? (
            <div className={own.placeholder}>
              <Icon name="image" size={28} />
              <span>Picture coming soon</span>
            </div>
          ))
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

interface MiniCell {
  card: BoardCardName;
  chip?: TeamIndex;
  locked?: boolean;
  /** Lit up as a legal cell for the picked card. */
  mark?: 'target';
  /** The chip two sequences share. */
  shared?: boolean;
}

/** A few board cells, in the viewer's board style and deck colours. */
function MiniBoard({ rows, compact = false }: { rows: MiniCell[][]; compact?: boolean }) {
  const [deck] = useDeck();
  const [boardStyle] = useBoardStyle();
  return (
    <div
      className={[own.board, compact && own.compact].filter(Boolean).join(' ')}
      data-cells={boardStyle}
      data-suits={deck.suits}
      style={{ '--deck-face': deck.face, '--columns': rows[0].length } as CSSProperties}
      aria-hidden="true"
    >
      {rows.flat().map((cell, i) => {
        const corner = cell.card === BLANK;
        const parsed = corner ? null : parseCard(cell.card as CardName);
        return (
          <span
            key={i}
            className={[own.cell, corner && own.corner, cell.mark === 'target' && own.target, cell.shared && own.shared]
              .filter(Boolean)
              .join(' ')}
            data-suit={parsed?.suit}
          >
            {parsed ? (
              <>
                <span className={own.rank}>{parsed.rank}</span>
                <SuitIcon suit={parsed.suit} className={own.suit} />
              </>
            ) : (
              <span className={own.star}>★</span>
            )}
            {cell.chip !== undefined && (
              <span className={own.chip}>
                <Chip team={cell.chip} locked={cell.locked} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** A small hand card: rank and suit, with an optional label like “Wild” or “Dead”. */
function MiniCard({ card, selected = false, dead = false, tag }: { card: CardName; selected?: boolean; dead?: boolean; tag?: string }) {
  const { rank, suit } = parseCard(card);
  return (
    <span
      className={[own.card, selected && own.selected, dead && own.dead].filter(Boolean).join(' ')}
      data-suit={suit}
      aria-hidden="true"
    >
      <span className={own.cardRank}>{rank}</span>
      <SuitIcon suit={suit} className={own.cardSuit} />
      {tag && <span className={own.tag}>{tag}</span>}
    </span>
  );
}
