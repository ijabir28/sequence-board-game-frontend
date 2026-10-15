import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Pos } from '../../engine/board';
import { cardKind, cardShort, type CardName } from '../../engine/cards';
import { describeHint } from '../../game/describeHint';
import { describeLog } from '../../game/describeLog';
import { TEAM_STYLES, teamName } from '../../game/teams';
import type { GameAdapter } from '../../game/types';
import { useHandOrder } from '../../game/useHandOrder';
import { useMediaQuery } from '../../game/useMediaQuery';
import { useGame } from '../../game/useGame';
import { Board } from '../board/Board';
import { Chip } from '../Chip';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { HandPanel } from './HandPanel';
import { MoveLog } from './MoveLog';
import { Scoreboard } from './Scoreboard';
import { TurnPanel } from './TurnPanel';
import styles from './GameScreen.module.css';

interface GameScreenProps {
  adapter: GameAdapter;
  /** Short label for the kind of game, e.g. "Hot-seat". */
  modeLabel: string;
  onExit: () => void;
  /** Leave straight to the dashboard (table games); offered next to onExit. */
  onDashboard?: () => void;
  onNewGame?: () => void;
  /** Extra controls for the top bar (for example the dev adapter toggle). */
  headerExtra?: ReactNode;
  /** Where to remember how each player arranged their hand on this device (e.g. per table). */
  handOrderKey?: string;
}

type Feedback = { tone: 'error' | 'info'; text: string } | null;

export function GameScreen({ adapter, modeLabel, onExit, onDashboard, onNewGame, headerExtra, handOrderKey }: GameScreenProps) {
  const view = useGame(adapter);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [handOpen, setHandOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Phones: the turn panel and the scoreboard fold into one line until the player opens them.
  const phone = useMediaQuery('(max-width: 600px)');
  const [statusOpen, setStatusOpen] = useState(false);

  const viewer = view.viewer;
  const handVisible = !adapter.hotSeat || (viewer !== null && revealedFor === viewer.id);
  const gameOver = view.winner !== null;
  const currentPlayer = view.players.find((p) => p.id === view.currentPlayerId) ?? null;
  const activeTeam = currentPlayer?.team ?? viewer?.team ?? null;
  const selectedCard = selected !== null ? view.hand[selected]?.card : undefined;
  // How the viewer arranged their hand. Only the view changes; moves still use real hand indexes.
  const { order, setOrder } = useHandOrder(viewer?.id ?? null, view.hand.length, handOrderKey);
  const { highlights, history } = view.settings;
  // Hints and card tips are for training games only.
  const training = view.settings.mode === 'training';
  const [hintShown, setHintShown] = useState(false);
  const hint = training && handVisible && !gameOver ? view.hint : null;

  // A hint is for one position: hide it again once anything changes.
  useEffect(() => {
    setHintShown(false);
  }, [view.hint, viewer?.id]);

  const showHint = () => {
    if (!hint) return;
    setHintShown(true);
    setFeedback(null);
    if (hint.type !== 'pass') setSelected(hint.handIndex);
  };

  // A new hand (after a move, or the next hot-seat player) starts with nothing selected.
  useEffect(() => {
    setSelected(null);
  }, [view.hand, viewer?.id]);

  // In hot-seat play the next person may not know the hand was collapsed, so reopen it.
  useEffect(() => {
    if (adapter.hotSeat) setHandOpen(true);
  }, [adapter.hotSeat, viewer?.id]);

  const targets = useMemo(
    () => (selected !== null && handVisible && !gameOver ? adapter.legalTargets(selected) : null),
    // `view` changes whenever the board does, which changes the legal targets.
    [adapter, selected, handVisible, gameOver, view],
  );

  const lastEntry = view.log.at(-1);
  const lastMove = useMemo(() => {
    for (let i = view.log.length - 1; i >= 0; i--) {
      const entry = view.log[i];
      if (entry.kind === 'place' || entry.kind === 'remove') return entry.pos;
    }
    return null;
  }, [view.log]);

  const selectCard = (index: number) => {
    if (!handVisible || gameOver || index >= view.hand.length) return;
    setFeedback(null);
    setSelected((current) => (current === index ? null : index));
  };

  // Number keys pick a hand card, Escape clears the selection.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.closest('input, textarea, select, dialog[open]') || event.altKey || event.ctrlKey || event.metaKey) return;
      // Number keys follow the cards as the player arranged them.
      if (/^[1-9]$/.test(event.key)) {
        const handIndex = order[Number(event.key) - 1];
        if (handIndex !== undefined) selectCard(handIndex);
      }
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const run = async (action: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        setFeedback({ tone: 'error', text: result.message });
        return false;
      }
      setFeedback(null);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const onCell = async (pos: Pos) => {
    if (gameOver || busy) return;
    if (!handVisible) {
      setFeedback({ tone: 'info', text: `Show ${viewer?.name ?? 'the next player'}'s hand to make a move.` });
      return;
    }
    if (selected === null || !selectedCard) {
      setFeedback({ tone: 'info', text: `Pick a card from your hand first, then ${highlights ? 'a highlighted cell' : 'a cell for it'}.` });
      return;
    }
    // Without highlights the player finds the cell themselves, so the rules engine explains a wrong pick.
    if (highlights && !targets?.some((t) => t.row === pos.row && t.column === pos.column)) {
      const what = cardKind(selectedCard) === 'one-eyed-jack' ? "a chip you can remove" : 'a legal move';
      setFeedback({ tone: 'error', text: `That cell isn't ${what} for ${cardShort(selectedCard)}. Pick a highlighted cell.` });
      return;
    }
    const played = await run(() => adapter.playCard(selected, pos));
    if (played && adapter.hotSeat) setRevealedFor(null);
  };

  const onExchange = () => selected !== null && run(() => adapter.exchangeDeadCard(selected));
  const onPass = async () => {
    const passed = await run(() => adapter.pass());
    if (passed && adapter.hotSeat) setRevealedFor(null);
  };

  const prompt = handHint({ selectedCard, dead: selected !== null && !!view.hand[selected]?.dead, targets, canExchange: view.canExchange, highlights, tips: training });

  const footer = (
    <div className={styles.actions}>
      {hint && hintShown ? (
        <p className={[styles.hint, styles.hintShown].join(' ')} role="status">
          <Icon name="bulb" size={16} />
          <span>{describeHint(hint, view.hand.map((h) => h.card))}</span>
        </p>
      ) : (
        <p className={styles.hint}>{prompt}</p>
      )}
      <div className={styles.actionButtons}>
        {hint && !hintShown && (
          <Tooltip text="Suggest a move for this turn, and say why" side="top" align="end">
            <Button size="sm" variant="ghost" onClick={showHint}>
              <Icon name="bulb" size={16} />
              Hint
            </Button>
          </Tooltip>
        )}
        {selected !== null && view.hand[selected]?.dead && view.canExchange && (
          <Tooltip text="Discard it and draw a new card. One exchange per turn, before you play." side="top" align="end">
            <Button size="sm" variant="primary" onClick={onExchange} busy={busy}>
              <Icon name="swap" size={16} />
              Exchange dead card
            </Button>
          </Tooltip>
        )}
        {view.canPass && (
          <Tooltip text="No card in your hand can be played, so you may pass" side="top" align="end">
            <Button size="sm" onClick={onPass} busy={busy}>
              Pass turn
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  const winnerPanel = gameOver ? (
    <div className={styles.gameOver} role="status">
      <span className={styles.gameOverChip}>
        <Chip team={view.winner!} />
      </span>
      <h2>{teamName(view.winner!)} wins</h2>
      <p>
        {view.teams.find((t) => t.index === view.winner)?.sequences} sequence
        {view.teams.find((t) => t.index === view.winner)?.sequences === 1 ? '' : 's'} completed
        {view.turn !== null && ` in ${view.turn} turns`}.
      </p>
      <div className={styles.actionButtons}>
        {onNewGame && (
          <Button variant="primary" onClick={onNewGame}>
            Play again
          </Button>
        )}
        <Button onClick={onExit}>Leave game</Button>
        {onDashboard && <Button onClick={onDashboard}>Back to dashboard</Button>}
      </div>
    </div>
  ) : null;

  const handTitle = gameOver ? 'Game over' : adapter.hotSeat && viewer ? `${viewer.name}'s hand` : 'Your hand';

  return (
    <div
      className={styles.screen}
      style={activeTeam !== null ? ({ '--active-team': TEAM_STYLES[activeTeam].color, '--active-glow': TEAM_STYLES[activeTeam].glow } as React.CSSProperties) : undefined}
    >
      <header className={styles.top}>
        {/* Spans the board's column, so the scoreboard is centred over the board. */}
        <div className={styles.topBoard}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true">
              <Chip team={0} />
            </span>
            <span className={styles.brandText}>Sequence</span>
            <span className={styles.mode}>{view.title ?? modeLabel}</span>
          </div>
          <div className={styles.scores}>
            {!phone && <Scoreboard teams={view.teams} sequencesToWin={view.sequencesToWin} currentTeam={gameOver ? null : activeTeam} />}
          </div>
        </div>
        <div className={styles.topActions}>
          {headerExtra}
          {history && (
            <Tooltip text="Every move so far" align="end">
              <button type="button" className={[styles.iconButton, styles.logButton].join(' ')} onClick={() => setLogOpen(true)} aria-label="Move log">
                <Icon name="log" />
              </button>
            </Tooltip>
          )}
          <Tooltip
            text={adapter.mode === 'local' ? 'Leave this game. Hot-seat games are not saved.' : 'Leave this game. It is saved, so you can come back.'}
            align="end"
          >
            <button type="button" className={styles.iconButton} onClick={() => (gameOver ? onExit() : setExitOpen(true))} aria-label="Leave game">
              <Icon name="exit" />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className={styles.status} hidden={view.status !== 'ready'}>
        <TurnPanel
          players={view.players}
          currentPlayerId={view.currentPlayerId}
          viewer={viewer}
          hotSeat={adapter.hotSeat}
          winner={view.winner}
          turn={view.turn}
          turnStartedAt={view.turnStartedAt}
          turnDeadline={view.turnDeadline}
          turnPaused={view.turnPaused}
          turnTimeLeft={view.turnTimeLeft}
          away={view.away}
          collapsible={
            phone
              ? {
                  open: statusOpen,
                  onToggle: () => setStatusOpen((open) => !open),
                  children: (
                    <div className={styles.foldedScores}>
                      <Scoreboard teams={view.teams} sequencesToWin={view.sequencesToWin} currentTeam={gameOver ? null : activeTeam} />
                    </div>
                  ),
                }
              : undefined
          }
        />
        {/* Feedback takes the ticker's line, so messages never push the board around. */}
        {feedback ? (
          <p
            className={[styles.line, styles.feedback, feedback.tone === 'error' && styles.feedbackError].filter(Boolean).join(' ')}
            role={feedback.tone === 'error' ? 'alert' : 'status'}
          >
            {feedback.text}
          </p>
        ) : (
          <p className={[styles.line, styles.ticker].join(' ')} aria-hidden="true">
            {lastEntry ? describeLog(lastEntry) : 'No moves yet.'}
          </p>
        )}
        {view.notice && (
          <p className={styles.notice}>
            <Icon name="alert" size={16} />
            <span>{view.notice}</span>
          </p>
        )}
      </div>

      <main className={styles.boardArea}>
        {view.status === 'ready' ? (
          <Board
            board={view.board}
            sequences={view.sequences}
            targets={highlights ? targets : null}
            targetMode={selectedCard && cardKind(selectedCard) === 'one-eyed-jack' ? 'remove' : 'place'}
            activeTeam={activeTeam}
            lastMove={lastMove}
            hint={hint && hintShown && hint.type === 'play' ? hint.target : null}
            disabled={busy || gameOver}
            onActivate={onCell}
          />
        ) : view.status === 'loading' ? (
          <div className={styles.boardMessage} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Loading the board…
          </div>
        ) : (
          <div className={styles.boardMessage} role="alert">
            <Icon name="wifiOff" size={28} />
            <p>{view.error}</p>
            <div className={styles.actionButtons}>
              <Button variant="primary" onClick={() => adapter.refresh()}>
                <Icon name="refresh" size={16} />
                Try again
              </Button>
              <Button onClick={onExit}>Leave game</Button>
            </div>
          </div>
        )}
      </main>

      <aside className={styles.rail}>
        {view.status === 'ready' && (
          <HandPanel
            title={handTitle}
            hand={view.hand}
            order={order}
            onReorder={handVisible && !gameOver ? setOrder : undefined}
            selected={selected}
            onSelect={selectCard}
            cover={adapter.hotSeat && !handVisible && !gameOver && viewer ? { playerName: viewer.name, onReveal: () => setRevealedFor(viewer.id) } : null}
            open={handOpen || gameOver}
            onToggle={() => setHandOpen((o) => !o)}
            disabled={busy || gameOver || view.status !== 'ready'}
            footer={footer}
            replaceWith={winnerPanel}
            summary={gameOver ? `${teamName(view.winner!)} wins` : undefined}
          />
        )}
        {history ? (
          <section className={styles.logPanel} aria-label="Move log">
            <h2 className={styles.railHeading}>Move log</h2>
            <div className={styles.logScroll}>
              <MoveLog entries={view.log} emptyText="Moves will appear here." />
            </div>
            {view.deckCount !== null && <p className={styles.deck}>{view.deckCount} cards left in the deck</p>}
          </section>
        ) : (
          view.status === 'ready' && (
            <p className={[styles.deck, styles.railNote].join(' ')}>
              {view.deckCount !== null && `${view.deckCount} cards left in the deck. `}This table plays without a move log.
            </p>
          )
        )}
      </aside>

      <div className="visually-hidden" aria-live="polite">
        {lastEntry ? describeLog(lastEntry) : ''}
        {!gameOver && currentPlayer
          ? !adapter.hotSeat && currentPlayer.id === viewer?.id
            ? '. Your turn.'
            : `. ${currentPlayer.name}'s turn.`
          : ''}
      </div>

      <Dialog open={logOpen && history} title="Move log" onClose={() => setLogOpen(false)}>
        <MoveLog entries={view.log} emptyText="No moves yet. Moves will appear here as they are played." />
      </Dialog>

      <Dialog
        open={exitOpen}
        title="Leave this game?"
        onClose={() => setExitOpen(false)}
        actions={
          <>
            <Button onClick={() => setExitOpen(false)}>Keep playing</Button>
            {onDashboard && <Button onClick={onDashboard}>Back to dashboard</Button>}
            <Button variant="danger" onClick={onExit}>
              Leave game
            </Button>
          </>
        }
      >
        <p>{adapter.mode === 'local' ? 'This game is only stored on this device, so leaving ends it.' : onDashboard
              ? 'The game is saved, so you can come back to it from the dashboard. Leave game opens the table page.'
              : 'You can come back to the server game later.'}</p>
      </Dialog>
    </div>
  );
}

function handHint({
  selectedCard,
  dead,
  targets,
  canExchange,
  highlights,
  tips,
}: {
  selectedCard: CardName | undefined;
  dead: boolean;
  targets: Pos[] | null;
  canExchange: boolean;
  highlights: boolean;
  /** Explain what the selected card does (training games). */
  tips: boolean;
}): string {
  if (!selectedCard) return `Pick a card, then ${highlights ? 'a highlighted cell' : 'a cell for it'}. Keys 1–7 pick cards.`;
  const card = selectedCard;
  if (!tips) {
    if (dead) return canExchange ? `${cardShort(card)} is dead. You can exchange it.` : `${cardShort(card)} is dead.`;
    return `${cardShort(card)} selected.`;
  }
  if (dead) {
    return canExchange
      ? `${cardShort(card)} is dead: both of its cells are taken. Exchange it for a new card.`
      : `${cardShort(card)} is dead. You already exchanged a card this turn, so play another card.`;
  }
  if (highlights && targets && targets.length === 0) {
    return cardKind(card) === 'one-eyed-jack' ? 'No opponent chip can be removed right now.' : `${cardShort(card)} has no open cell.`;
  }
  switch (cardKind(card)) {
    case 'two-eyed-jack':
      return 'Wild jack: place a chip on any empty cell.';
    case 'one-eyed-jack':
      return "One-eyed jack: remove an opponent's chip that isn't in a sequence.";
    default:
      return highlights ? `Place ${cardShort(card)} on one of its highlighted cells.` : `Place ${cardShort(card)} on one of its two cells.`;
  }
}
