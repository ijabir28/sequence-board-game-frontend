import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Pos } from '../../engine/board';
import { cardKind, cardShort, type CardName, type CardNotation } from '../../engine/cards';
import { useDeck } from '../../decks/decks';
import { describeHint } from '../../game/describeHint';
import { describeDraft, draftLostMessage, draftProblem, type Draft } from '../../game/draft';
import { describeLog } from '../../game/describeLog';
import { TEAM_STYLES, teamName } from '../../game/teams';
import type { GameAdapter, HandCardView } from '../../game/types';
import { useHandOrder } from '../../game/useHandOrder';
import { useAwayWhileHidden } from '../../game/useAwayWhileHidden';
import { useMediaQuery } from '../../game/useMediaQuery';
import { useMuted } from '../../game/sounds';
import { sameHand, sameNumbers, useStableValue } from '../../game/stableValue';
import { useGame } from '../../game/useGame';
import { Board } from '../board/Board';
import { BoardStylePicker, DeckPicker } from '../cards/DeckPicker';
import { Chip } from '../Chip';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Drawer } from '../ui/Drawer';
import { HowToPlayDialog } from '../../screens/HowToPlay';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { tipProps } from '../ui/TooltipLayer';
import { HandPanel } from './HandPanel';
import { MoveLog } from './MoveLog';
import { describeVerdict, RoundResults } from './RoundResults';
import { Scoreboard } from './Scoreboard';
import { useToast } from '../toast/Toaster';
import { TurnPanel } from './TurnPanel';
import { TurnSounds } from './TurnSounds';
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
  /** Shown to a spectator in place of the hand, under the "watching live" note (for example a sign-in link). */
  spectatorExtra?: ReactNode;
  /** Where to remember how each player arranged their hand on this device (e.g. per table). */
  handOrderKey?: string;
  /** Shown above the turn panel: the training lesson's task. */
  coach?: ReactNode;
}

/** Game messages share one toast, so a new one replaces the last instead of piling up. */
const FEEDBACK_TOAST = 'game-feedback';
const NO_HAND: HandCardView[] = [];
const NO_ORDER: number[] = [];
const ignoreSelect = () => {};

function spectatorCount(count: number | null | undefined): string | undefined {
  if (!count) return undefined;
  return `${count} watching`;
}

/** A new round's notice has its own toast, so the host's next action (which clears feedback) doesn't hide it. */
const ROUND_TOAST = 'game-round';

export function GameScreen({ adapter, modeLabel, onExit, onDashboard, onNewGame, headerExtra, spectatorExtra, handOrderKey, coach }: GameScreenProps) {
  const view = useGame(adapter);
  // The viewer's deck decides how cards are named in messages: "7♥", or "#7" with the Numbered deck.
  const [{ notation }] = useDeck();
  const [selected, setSelected] = useState<number | null>(null);
  const toast = useToast();
  // A new selection or move clears a stale error or tip, but lets good news run its course.
  const feedbackTone = useRef<'error' | 'info' | 'success' | null>(null);
  const setFeedback = (feedback: { tone: 'error' | 'info' | 'success'; text: string } | null) => {
    if (feedback) toast.show(feedback.tone, feedback.text, { id: FEEDBACK_TOAST });
    else if (feedbackTone.current !== 'success') toast.dismiss(FEEDBACK_TOAST);
    feedbackTone.current = feedback?.tone ?? feedbackTone.current;
  };
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // Opening the menu drawer, the how-to-play guide or the leave dialog counts as stepping away from the table, as if the player had already
  // left: their turn pauses until they close it.
  // On a phone or tablet, a hidden page (the screen locked, another app) counts too, from the moment it is hidden.
  // Desktop players may watch another tab while they wait: the tab title tells them when it is their turn.
  const touch = useMediaQuery('(pointer: coarse)');
  const hiddenAway = useAwayWhileHidden(touch, () => adapter.stepAway?.(true));
  const steppedAway = menuOpen || guideOpen || exitOpen || forfeitOpen || hiddenAway;
  useEffect(() => {
    adapter.stepAway?.(steppedAway);
  }, [adapter, steppedAway]);
  const [busy, setBusy] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  // The round looked at in detail from the final results (null: the results themselves).
  const [openRound, setOpenRound] = useState<number | null>(null);
  const loadRound = useMemo(() => (adapter.roundDetail ? (round: number) => adapter.roundDetail!(round) : undefined), [adapter]);
  // Phones: the turn panel and the scoreboard fold into one line until the player opens them.
  const phone = useMediaQuery('(max-width: 600px)');
  const [statusOpen, setStatusOpen] = useState(false);

  const viewer = view.viewer;
  // Watching a table's game without a seat: the screen is read-only. No hand, no moves, nothing to select.
  const spectating = view.spectating === true;
  // Table games are played in rounds; the host deals each one and decides after it is won whether another follows.
  const rounds = view.rounds ?? null;
  const hostName = rounds?.hostId ? (view.players.find((p) => p.id === rounds.hostId)?.name ?? 'the host') : 'the host';
  const title = `${view.title ?? modeLabel}${rounds ? ` · Round ${rounds.round}` : ''}`;
  // Every update is a fresh snapshot; keep the hand the same object while its cards are, so the memoised cards don't
  // re-render when only the turn or the board changed.
  const hand = useStableValue(view.hand, sameHand);
  const handVisible = !spectating && (!adapter.hotSeat || (viewer !== null && revealedFor === viewer.id));
  const gameOver = view.winner !== null;
  const currentPlayer = view.players.find((p) => p.id === view.currentPlayerId) ?? null;
  const activeTeam = currentPlayer?.team ?? viewer?.team ?? null;
  const selectedCard = selected !== null ? view.hand[selected]?.card : undefined;
  // The viewer is the one to move (in hot-seat play, whoever has their hand showing).
  const yourTurn =
    !gameOver && currentPlayer !== null && (adapter.hotSeat ? handVisible : viewer !== null && currentPlayer.id === viewer.id);
  // On your own turn (not a teammate's) the turn timer glows round the board, shrinking as its time runs down. The
  // board's glow keeps its own clock, so this screen doesn't re-render every second.
  const turnEdge = yourTurn
    ? { turn: view.turn, turnStartedAt: view.turnStartedAt, turnDeadline: view.turnDeadline, paused: view.turnPaused }
    : null;
  // Table games: on someone else's turn the viewer may draft their next move. It is played for them as soon as their
  // turn comes, unless a move in the meantime rules it out (then they're told, and can draft another).
  const waiting = !adapter.hotSeat && !gameOver && view.status === 'ready' && currentPlayer !== null && viewer !== null && currentPlayer.id !== viewer.id;
  const [draft, setDraft] = useState<Draft | null>(null);
  // A chime when the turn passes to you (in hot-seat play, every new turn: the next person picks up the device), and
  // the clock ticking over your turn's last 20 seconds.
  const chimeKey =
    gameOver || currentPlayer === null
      ? null
      : adapter.hotSeat
        ? `${currentPlayer.id}:${view.turn}`
        : viewer !== null && currentPlayer.id === viewer.id
          ? `${view.turn}`
          : null;
  const [muted, setMuted] = useMuted();
  const soundTip = muted ? 'Turn the game sounds back on' : 'Mute the game sounds: your-turn chime and the clock ticking';
  // How the viewer arranged their hand. Only the view changes; moves still use real hand indexes.
  const { order: freshOrder, setOrder } = useHandOrder(viewer?.id ?? null, hand.length, handOrderKey);
  const order = useStableValue(freshOrder, sameNumbers);
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

  // A new hand (after a move, or the next hot-seat player) starts with nothing selected. Other players' moves leave
  // the hand (and so the selection) as it was.
  useEffect(() => {
    setSelected(null);
  }, [hand, viewer?.id]);

  const targets = useMemo(
    () => (selected !== null && handVisible && !gameOver ? adapter.legalTargets(selected) : null),
    // `view` changes whenever the board does, which changes the legal targets.
    [adapter, selected, handVisible, gameOver, view],
  );

  const lastEntry = view.log.at(-1);
  // The last move's ring on the board is part of the move log: tables played without one don't mark it, so players
  // have to keep track of the board themselves.
  const lastMove = useMemo(() => {
    if (!history) return null;
    for (let i = view.log.length - 1; i >= 0; i--) {
      const entry = view.log[i];
      if (entry.kind === 'place' || entry.kind === 'remove') return entry.pos;
    }
    return null;
  }, [view.log, history]);

  // The results open by themselves when a round is won and again when the host ends the rounds (also for a player
  // who opens the game afterwards), once each.
  const resultsKey = rounds && gameOver && rounds.results.length > 0 ? `${rounds.round}:${rounds.over}` : null;
  const openedResults = useRef<string | null>(null);
  useEffect(() => {
    if (resultsKey === null || openedResults.current === resultsKey) return;
    openedResults.current = resultsKey;
    setResultsOpen(true);
  }, [resultsKey]);

  // Everyone hears when the host deals the next round, and who opens it: the first turn passes to the next seat
  // every round, so another team leads.
  const roundNumber = rounds?.round ?? null;
  const seenRound = useRef(roundNumber);
  useEffect(() => {
    if (roundNumber === null) return;
    if (seenRound.current !== null && roundNumber > seenRound.current) {
      setResultsOpen(false);
      const opener = currentPlayer === null ? '' : currentPlayer.id === viewer?.id ? ' You move first.' : ` ${currentPlayer.name} moves first.`;
      toast.success(`Round ${roundNumber} has started: same teams, a fresh deal.${opener}`, { id: ROUND_TOAST });
    }
    seenRound.current = roundNumber;
  }, [roundNumber]);

  // Who opens a table's first round is drawn at random, so say who it is while nobody has moved yet.
  const drawnOpener = rounds?.round === 1 && view.turn === 1 && view.log.length === 0 && currentPlayer !== null ? currentPlayer : null;
  const announcedOpener = useRef(false);
  useEffect(() => {
    if (drawnOpener === null || announcedOpener.current) return;
    announcedOpener.current = true;
    const who = drawnOpener.id === viewer?.id ? 'You move' : `${drawnOpener.name} moves`;
    toast.info(`Drawn at random: ${who} first. Each later round passes the first turn to the next team.`, { id: ROUND_TOAST });
  }, [drawnOpener, viewer?.id]);

  // Stable, so the memoised hand cards don't re-render just because this screen did. It reads the latest state
  // through a ref.
  const latest = useRef({ handVisible, gameOver, handLength: hand.length, setFeedback });
  latest.current = { handVisible, gameOver, handLength: hand.length, setFeedback };
  const selectCard = useCallback((index: number) => {
    const { handVisible, gameOver, handLength, setFeedback } = latest.current;
    if (!handVisible || gameOver || index >= handLength) return;
    setFeedback(null);
    setSelected((current) => (current === index ? null : index));
  }, []);

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

  // Checks the draft whenever the game moves on: drops it, with a message, once it can't be played, and plays it the
  // moment the viewer's turn starts.
  useEffect(() => {
    if (!draft || busy) return;
    if (gameOver) {
      setDraft(null);
      return;
    }
    const problem = draftProblem(draft, hand, adapter.legalTargets(draft.handIndex));
    if (problem) {
      setDraft(null);
      setFeedback({ tone: 'error', text: draftLostMessage(draft, problem, notation) });
      return;
    }
    if (!yourTurn || view.turnPaused) return;
    setDraft(null);
    void run(() => adapter.playCard(draft.handIndex, draft.target)).then((played) => {
      if (played) setFeedback({ tone: 'success', text: `Your drafted move was played: ${describeDraft(draft, notation)}.` });
    });
    // `view` changes with every move, which is when the draft needs checking again.
  }, [adapter, draft, view, hand, yourTurn, gameOver, busy, notation]);

  const onCell = async (pos: Pos) => {
    if (gameOver || busy || spectating) return;
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
      setFeedback({ tone: 'error', text: `That cell isn't ${what} for ${cardShort(selectedCard, notation)}. Pick a highlighted cell.` });
      return;
    }
    if (waiting) {
      // Not your turn yet: draft the move instead. The engine checks it now, since the server won't until it is played.
      if (!adapter.legalTargets(selected).some((t) => t.row === pos.row && t.column === pos.column)) {
        setFeedback({ tone: 'error', text: `That cell isn't a legal move for ${cardShort(selectedCard, notation)}, so it can't be drafted.` });
        return;
      }
      const next = { handIndex: selected, card: selectedCard, target: pos };
      setDraft(next);
      setSelected(null);
      setFeedback({ tone: 'info', text: `Move drafted: ${describeDraft(next, notation)}. It is played as soon as your turn comes.` });
      return;
    }
    const played = await run(() => adapter.playCard(selected, pos));
    if (played && adapter.hotSeat) setRevealedFor(null);
  };

  const manualDead = view.settings.deadCards === 'manual';
  // With manual dead cards any normal card may be offered for exchange (jacks are never dead); the rules check it.
  const exchangeable =
    selected !== null &&
    selectedCard !== undefined &&
    handVisible &&
    !gameOver &&
    view.canExchange &&
    (manualDead ? cardKind(selectedCard) === 'normal' : !!view.hand[selected]?.dead);
  // Phones and tablets keep the exchange button in the hand strip's heading row, so it is never scrolled or squeezed
  // out of view. It shows whenever an exchange is possible this turn and is enabled once a card that may be exchanged
  // is selected.
  const offerExchange =
    handVisible && !gameOver && view.canExchange && (manualDead || view.hand.some((h) => h.dead));
  const exchangesNote =
    view.exchangesLeft === null ? 'You may exchange any number this turn.' : `${view.exchangesLeft} exchange${view.exchangesLeft === 1 ? '' : 's'} left this turn.`;
  const onExchange = async () => {
    if (selected === null || !selectedCard) return;
    const card = selectedCard;
    if (await run(() => adapter.exchangeDeadCard(selected))) {
      setFeedback({ tone: 'success', text: `${cardShort(card, notation)} was dead: you drew a new card.` });
    }
  };
  const onPass = async () => {
    const passed = await run(() => adapter.pass());
    if (passed && adapter.hotSeat) setRevealedFor(null);
  };

  const onNextRound = async () => {
    if (adapter.nextRound && (await run(() => adapter.nextRound!()))) setResultsOpen(false);
  };
  const onEndRounds = async () => {
    if (adapter.endRounds) await run(() => adapter.endRounds!());
  };
  const canForfeit = Boolean(view.canForfeit && adapter.forfeit);
  const onForfeit = async () => {
    if (adapter.forfeit && (await run(() => adapter.forfeit!()))) setForfeitOpen(false);
  };
  const waitingForHost = `Waiting for ${hostName} to deal another round or end the rounds here.`;

  const exchangeTip = !exchangeable
    ? manualDead
      ? `Pick a card whose two cells are both taken, then exchange it for a new one. ${exchangesNote}`
      : `Pick the dead card in your hand, then exchange it for a new one. ${exchangesNote}`
    : manualDead
      ? `If both of ${cardShort(selectedCard!, notation)}'s cells are taken, swap it for a new card. ${exchangesNote}`
      : `Discard it and draw a new card, before you play. ${exchangesNote}`;

  const barExchange = offerExchange ? (
    <Button
      size="sm"
      variant={exchangeable && !manualDead ? 'primary' : 'secondary'}
      onClick={onExchange}
      busy={busy}
      disabled={!exchangeable}
      tip={exchangeTip}
      tipAlign="end"
    >
      <Icon name="swap" size={16} />
      Exchange dead
    </Button>
  ) : null;

  const prompt = handHint({
    selectedCard,
    dead: selected !== null && !!view.hand[selected]?.dead,
    targets,
    canExchange: view.canExchange,
    highlights,
    tips: training,
    manualDead,
    waiting,
    draft,
    notation,
  });

  const footer = (
    <div className={styles.actions}>
      {hint && hintShown ? (
        <p className={[styles.hint, styles.hintShown].join(' ')} role="status">
          <Icon name="bulb" size={16} />
          <span>{describeHint(hint, view.hand.map((h) => h.card), notation)}</span>
        </p>
      ) : (
        <p className={styles.hint}>{prompt}</p>
      )}
      <div className={styles.actionButtons}>
        {draft && (
          <Tooltip text="Forget the drafted move, so nothing is played for you when your turn comes" side="top" align="end">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              <Icon name="close" size={16} />
              Cancel draft
            </Button>
          </Tooltip>
        )}
        {hint && !hintShown && (
          <Tooltip text="Suggest a move for this turn, and say why" side="top" align="end">
            <Button size="sm" variant="ghost" onClick={showHint}>
              <Icon name="bulb" size={16} />
              Hint
            </Button>
          </Tooltip>
        )}
        {exchangeable && (
          // Wide screens only: phones and tablets have it in the hand strip's heading row (barExchange).
          <span className={styles.footerExchange}>
            <Tooltip text={exchangeTip} side="top" align="end">
              <Button size="sm" variant={manualDead ? 'secondary' : 'primary'} onClick={onExchange} busy={busy}>
                <Icon name="swap" size={16} />
                Exchange dead
              </Button>
            </Tooltip>
          </span>
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
      <h2>
        {teamName(view.winner!)} wins{rounds && ` round ${rounds.round}`}
      </h2>
      <p>
        {view.teams.find((t) => t.index === view.winner)?.sequences} sequence
        {view.teams.find((t) => t.index === view.winner)?.sequences === 1 ? '' : 's'} completed
        {view.turn !== null && ` in ${view.turn} turns`}.
      </p>
      {rounds?.over && rounds.summary && <p className={styles.verdict}>{describeVerdict(rounds.summary)}.</p>}
      {rounds && !rounds.over && !rounds.isHost && <p>{waitingForHost}</p>}
      <div className={styles.actionButtons}>
        {rounds && !rounds.over && rounds.isHost && (
          <Button variant="primary" onClick={onNextRound} busy={busy} tip="Deal another round with the same teams">
            Next round
          </Button>
        )}
        {rounds && rounds.results.length > 0 && (
          <Button
            variant={rounds.over ? 'primary' : 'secondary'}
            onClick={() => setResultsOpen(true)}
            tip={rounds.over ? 'The final result: every round added up' : "This round's statistics"}
          >
            {rounds.over ? 'Final results' : 'Round results'}
          </Button>
        )}
        {onNewGame && (
          <Button variant="primary" onClick={onNewGame} tip="Deal a new game with the same players and settings">
            Play again
          </Button>
        )}
        <Button onClick={onExit} tip="Close the finished game">
          Leave game
        </Button>
        {onDashboard && (
          <Button onClick={onDashboard} tip="Go back to the dashboard to start or join another game">
            Back to dashboard
          </Button>
        )}
      </div>
    </div>
  ) : null;

  const handTitle = gameOver ? 'Game over' : adapter.hotSeat && viewer ? `${viewer.name}'s hand` : 'Your hand';

  return (
    <div
      className={styles.screen}
      style={
        {
          ...(activeTeam !== null ? { '--active-team': TEAM_STYLES[activeTeam].color, '--active-glow': TEAM_STYLES[activeTeam].glow } : {}),
          // A drafted move is the viewer's, so it is marked in their team's colour whoever's turn it is.
          ...(viewer ? { '--draft-team': TEAM_STYLES[viewer.team].color, '--draft-glow': TEAM_STYLES[viewer.team].glow } : {}),
        } as React.CSSProperties
      }
    >
      {phone ? (
        <>
          {/* Phones: the header's options live in a drawer on the right, opened by this pull tab. */}
          <button
            type="button"
            className={styles.drawerHandle}
            onClick={() => setMenuOpen(true)}
            aria-label="Game menu"
            {...tipProps('Open the game menu: move log, how to play and leave game', 'bottom', 'end')}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <Drawer
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            title={
              <span className={styles.drawerTitle}>
                <span className={styles.logo} aria-hidden="true">
                  <Chip team={0} />
                </span>
                <span>Sequence</span>
                <span className={styles.mode}>{title}</span>
              </span>
            }
          >
            {history && (
              <button
                type="button"
                className={styles.drawerItem}
                {...tipProps('See every move made so far in this game')}
                onClick={() => {
                  setMenuOpen(false);
                  setLogOpen(true);
                }}
              >
                <Icon name="log" />
                <span>
                  <strong>Move log</strong>
                  <small>Every move so far</small>
                </span>
              </button>
            )}
            {rounds && rounds.results.length > 0 && (
              <button
                type="button"
                className={styles.drawerItem}
                {...tipProps(rounds.over ? 'The final result: every round added up' : 'How each round went')}
                onClick={() => {
                  setMenuOpen(false);
                  setResultsOpen(true);
                }}
              >
                <Icon name="log" />
                <span>
                  <strong>{rounds.over ? 'Final results' : 'Round results'}</strong>
                  <small>{rounds.over ? 'Every round added up' : `${rounds.results.length} round${rounds.results.length === 1 ? '' : 's'} won so far`}</small>
                </span>
              </button>
            )}
            <button type="button" className={styles.drawerItem} {...tipProps(soundTip)} aria-pressed={!muted} onClick={() => setMuted(!muted)}>
              <Icon name={muted ? 'soundOff' : 'sound'} />
              <span>
                <strong>Sounds {muted ? 'off' : 'on'}</strong>
                <small>Your-turn chime and the clock ticking</small>
              </span>
            </button>
            <button
              type="button"
              className={styles.drawerItem}
              {...tipProps('Choose your card deck and how the board looks')}
              onClick={() => {
                setMenuOpen(false);
                setDeckOpen(true);
              }}
            >
              <Icon name="cards" />
              <span>
                <strong>Cards and board</strong>
                <small>Your deck design and the board's cells</small>
              </span>
            </button>
            <button
              type="button"
              className={styles.drawerItem}
              {...tipProps('The rules, step by step. Your turn waits while you read.')}
              onClick={() => {
                setMenuOpen(false);
                setGuideOpen(true);
              }}
            >
              <Icon name="book" />
              <span>
                <strong>How to play</strong>
                <small>The rules, step by step</small>
              </span>
            </button>
            {headerExtra && <div className={styles.drawerExtra}>{headerExtra}</div>}
            <button
              type="button"
              className={[styles.drawerItem, styles.drawerLeave].join(' ')}
              {...tipProps(gameOver ? 'Close the finished game' : 'Leave this game. You are asked to confirm first.')}
              onClick={() => {
                setMenuOpen(false);
                if (gameOver || spectating) onExit();
                else setExitOpen(true);
              }}
            >
              <Icon name="exit" />
              <span>
                <strong>{spectating ? 'Stop watching' : 'Leave game'}</strong>
                <small>{spectating ? 'The game goes on without you.' : adapter.mode === 'local' ? 'Hot-seat games are not saved.' : 'It is saved, so you can come back.'}</small>
              </span>
            </button>
          </Drawer>
        </>
      ) : (
        <header className={styles.top}>
          {/* Spans the board's column, so the scoreboard is centred over the board. */}
          <div className={styles.topBoard}>
            <div className={styles.brand}>
              <span className={styles.logo} aria-hidden="true">
                <Chip team={0} />
              </span>
              <span className={styles.brandText}>Sequence</span>
              <span className={styles.mode}>{title}</span>
            </div>
            <div className={styles.scores}>
              {!phone && <Scoreboard teams={view.teams} sequencesToWin={view.sequencesToWin} currentTeam={gameOver ? null : activeTeam} />}
            </div>
          </div>
          <div className={styles.topActions}>
            {headerExtra}
            <Tooltip text={soundTip} align="end">
              <button type="button" className={styles.iconButton} onClick={() => setMuted(!muted)} aria-label="Game sounds" aria-pressed={!muted}>
                <Icon name={muted ? 'soundOff' : 'sound'} />
              </button>
            </Tooltip>
            <Tooltip text="Choose your card deck and how the board looks" align="end">
              <button type="button" className={styles.iconButton} onClick={() => setDeckOpen(true)} aria-label="Cards and board" aria-haspopup="dialog">
                <Icon name="cards" />
              </button>
            </Tooltip>
            <Tooltip text="How to play: the rules, step by step. Your turn waits while you read." align="end">
              <button type="button" className={styles.iconButton} onClick={() => setGuideOpen(true)} aria-label="How to play" aria-haspopup="dialog">
                <Icon name="book" />
              </button>
            </Tooltip>
            {history && (
              <Tooltip text="Every move so far" align="end">
                <button type="button" className={[styles.iconButton, styles.logButton].join(' ')} onClick={() => setLogOpen(true)} aria-label="Move log">
                  <Icon name="log" />
                </button>
              </Tooltip>
            )}
            <Tooltip
              text={
                spectating
                  ? 'Stop watching this game'
                  : adapter.mode === 'local'
                    ? 'Leave this game. Hot-seat games are not saved.'
                    : 'Leave this game. It is saved, so you can come back.'
              }
              align="end"
            >
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => (gameOver || spectating ? onExit() : setExitOpen(true))}
                aria-label={spectating ? 'Stop watching' : 'Leave game'}
              >
                <Icon name="exit" />
              </button>
            </Tooltip>
          </div>
        </header>
      )}

      <div className={styles.status} hidden={view.status !== 'ready'}>
        {coach}
        {/* Large screens give the turn panel a fixed slot, so the hand under it never moves. */}
        <div className={styles.turnSlot}>
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
            // Phones have no header, so the round goes on the turn line.
            round={phone ? (rounds?.round ?? null) : null}
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
        </div>
        {/* Messages float as toasts, so this line only ever shows the latest move. */}
        <p className={[styles.line, styles.ticker].join(' ')} aria-hidden="true">
          {lastEntry ? describeLog(lastEntry, notation) : 'No moves yet.'}
        </p>
        {!spectating && view.spectators ? (
          <p className={styles.watchers}>
            <Icon name="eye" size={14} />
            <span>{spectatorCount(view.spectators)}</span>
          </p>
        ) : null}
        {view.notice && !(spectating && !view.notice.startsWith('You forfeited')) && (
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
            draft={draft?.target ?? null}
            hint={hint && hintShown && hint.type === 'play' ? hint.target : null}
            disabled={busy || gameOver || spectating}
            turnEdge={turnEdge}
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
              <Button variant="primary" onClick={() => adapter.refresh()} tip="Try to load the game again">
                <Icon name="refresh" size={16} />
                Try again
              </Button>
              <Button onClick={onExit} tip="Give up loading and leave this game">
                Leave game
              </Button>
            </div>
          </div>
        )}
      </main>

      <aside className={styles.rail}>
        {view.status === 'ready' && spectating && !gameOver ? (
          <HandPanel
            title="Watching live"
            hand={NO_HAND}
            order={NO_ORDER}
            selected={null}
            onSelect={ignoreSelect}
            cover={null}
            disabled
            summary={spectatorCount(view.spectators)}
            replaceWith={
              <div className={styles.spectating} role="status">
                <p className={styles.liveLine}>
                  <span className={styles.liveDot} aria-hidden="true" />
                  <strong>Live</strong>
                </p>
                <p>
                  {currentPlayer ? `${currentPlayer.name} is playing.` : 'The game is on.'} You see the board, whose turn it is and every move
                  as it happens. Only the players see their hands, and you can't make moves.
                </p>
                {spectatorExtra}
              </div>
            }
          />
        ) : view.status === 'ready' && (
          <HandPanel
            title={handTitle}
            hand={hand}
            order={order}
            onReorder={handVisible && !gameOver ? setOrder : undefined}
            selected={selected}
            drafted={draft?.handIndex ?? null}
            onSelect={selectCard}
            cover={adapter.hotSeat && !handVisible && !gameOver && viewer ? { playerName: viewer.name, onReveal: () => setRevealedFor(viewer.id) } : null}
            disabled={busy || gameOver || view.status !== 'ready'}
            footer={footer}
            replaceWith={winnerPanel}
            summary={gameOver ? `${teamName(view.winner!)} wins` : undefined}
            barAction={barExchange}
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
        {lastEntry ? describeLog(lastEntry, notation) : ''}
        {!gameOver && currentPlayer
          ? !adapter.hotSeat && currentPlayer.id === viewer?.id
            ? '. Your turn.'
            : `. ${currentPlayer.name}'s turn.`
          : ''}
      </div>

      <TurnSounds chimeKey={chimeKey} ticking={!!turnEdge && !turnEdge.paused} turnDeadline={view.turnDeadline} />

      <Dialog
        open={deckOpen}
        title="Cards and board"
        onClose={() => setDeckOpen(false)}
        actions={
          <Button variant="primary" onClick={() => setDeckOpen(false)} tip="Close this and go back to the board">
            Done
          </Button>
        }
      >
        <p className={styles.deckNote}>Your hand and the board change at once. Only you see your choice. When you're signed in, both are saved to your account and follow you to every device.</p>
        <DeckPicker />
        <h3 className={styles.deckSubtitle}>Board cells</h3>
        <BoardStylePicker />
      </Dialog>

      <HowToPlayDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

      <Dialog open={logOpen && history} title="Move log" onClose={() => setLogOpen(false)}>
        <MoveLog entries={view.log} emptyText="No moves yet. Moves will appear here as they are played." />
      </Dialog>

      {rounds && rounds.results.length > 0 && (
        <Dialog
          open={resultsOpen}
          size="wide"
          title={
            rounds.over ? (openRound !== null ? `Round ${openRound} in detail` : 'Final results') : `Round ${rounds.results.at(-1)!.round} results`
          }
          onClose={() => {
            setResultsOpen(false);
            setOpenRound(null);
          }}
          actions={
            gameOver && !rounds.over && rounds.isHost ? (
              <>
                <Button
                  onClick={onEndRounds}
                  busy={busy}
                  tip="Finish the match here: show the final results of every round. No further round can be played."
                >
                  End rounds here
                </Button>
                <Button variant="primary" onClick={onNextRound} busy={busy} tip="Deal another round with the same teams">
                  Play another round
                </Button>
              </>
            ) : (
              <>
                {rounds.over && onDashboard && (
                  <Button onClick={onDashboard} tip="Go back to the dashboard to start or join another game">
                    Back to dashboard
                  </Button>
                )}
                <Button
                  variant={rounds.over ? 'secondary' : 'primary'}
                  onClick={() => {
                    setResultsOpen(false);
                    setOpenRound(null);
                  }}
                  tip="Close the results"
                >
                  Close
                </Button>
              </>
            )
          }
        >
          <RoundResults
            rounds={rounds}
            playerName={(id) => view.players.find((p) => p.id === id)?.name ?? id}
            loadRound={loadRound}
            openRound={openRound}
            onOpenRound={setOpenRound}
          />
          {gameOver && !rounds.over && !rounds.isHost && <p className={styles.waitingNote}>{waitingForHost}</p>}
        </Dialog>
      )}

      <Dialog
        open={exitOpen}
        title="Leave this game?"
        onClose={() => setExitOpen(false)}
        actions={
          <>
            <Button onClick={() => setExitOpen(false)} tip="Close this and go back to the board">
              Keep playing
            </Button>
            {canForfeit && (
              <Button
                variant="danger"
                onClick={() => {
                  setExitOpen(false);
                  setForfeitOpen(true);
                }}
                tip="Give up this match. You are asked to confirm first."
              >
                Forfeit
              </Button>
            )}
            {onDashboard && (
              <Button onClick={onDashboard} tip="Leave the game for the dashboard. It stays saved.">
                Back to dashboard
              </Button>
            )}
            <Button
              variant="danger"
              onClick={onExit}
              tip={adapter.mode === 'local' ? 'Leave and end this game. It is not saved.' : 'Leave the game for the table page. It stays saved.'}
            >
              Leave game
            </Button>
          </>
        }
      >
        <p>{adapter.mode === 'local' ? 'This game is only stored on this device, so leaving ends it.' : onDashboard
              ? 'The game is saved, so you can come back to it from the dashboard. Leave game opens the table page.'
              : 'You can come back to the server game later.'}</p>
        {canForfeit && (
          <p>
            A quick match goes on while you're away: when your time runs out a card is played for you, and missing 10 turns
            in a row forfeits the match.
          </p>
        )}
      </Dialog>

      <Dialog
        open={forfeitOpen}
        title="Forfeit this match?"
        onClose={() => setForfeitOpen(false)}
        actions={
          <>
            <Button onClick={() => setForfeitOpen(false)} tip="Close this and go back to the board">
              Keep playing
            </Button>
            <Button variant="danger" busy={busy} onClick={() => void onForfeit()} tip="Give up the match and take the loss">
              Forfeit
            </Button>
          </>
        }
      >
        <p>Forfeiting counts as a loss: your Quick Match rating goes down, and you can't come back to this match.</p>
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
  manualDead,
  waiting,
  draft,
  notation,
}: {
  selectedCard: CardName | undefined;
  dead: boolean;
  targets: Pos[] | null;
  canExchange: boolean;
  highlights: boolean;
  /** Explain what the selected card does (training games). */
  tips: boolean;
  /** Players spot dead cards themselves and may offer any card for exchange. */
  manualDead: boolean;
  /** Someone else's turn: a move made now is drafted for the viewer's next turn. */
  waiting: boolean;
  draft: Draft | null;
  notation: CardNotation;
}): string {
  if (waiting && !selectedCard) {
    return draft
      ? `Drafted: ${describeDraft(draft, notation)}. It is played as soon as your turn comes. Pick another card to change it.`
      : `Not your turn yet. Draft your next move: pick a card, then ${highlights ? 'a highlighted cell' : 'a cell for it'}, and it is played when your turn comes.`;
  }
  if (!selectedCard) {
    return manualDead && canExchange
      ? `Pick a card, then ${highlights ? 'a highlighted cell' : 'a cell for it'}. Spotted a dead card? Pick it and exchange it.`
      : `Pick a card, then ${highlights ? 'a highlighted cell' : 'a cell for it'}. Keys 1–7 pick cards.`;
  }
  const card = selectedCard;
  if (manualDead && canExchange && cardKind(card) === 'normal' && !tips) {
    return `${cardShort(card, notation)} selected. If both its cells are taken, it's dead: exchange it.`;
  }
  if (!tips) {
    if (dead) return canExchange ? `${cardShort(card, notation)} is dead. You can exchange it.` : `${cardShort(card, notation)} is dead.`;
    return `${cardShort(card, notation)} selected.`;
  }
  if (dead) {
    return canExchange
      ? `${cardShort(card, notation)} is dead: both of its cells are taken. Exchange it for a new card.`
      : `${cardShort(card, notation)} is dead. You already exchanged a card this turn, so play another card.`;
  }
  if (highlights && targets && targets.length === 0) {
    return cardKind(card) === 'one-eyed-jack' ? 'No opponent chip can be removed right now.' : `${cardShort(card, notation)} has no open cell.`;
  }
  switch (cardKind(card)) {
    case 'two-eyed-jack':
      return 'Wild jack: place a chip on any empty cell.';
    case 'one-eyed-jack':
      return "One-eyed jack: remove an opponent's chip that isn't in a sequence.";
    default:
      return highlights ? `Place ${cardShort(card, notation)} on one of its highlighted cells.` : `Place ${cardShort(card, notation)} on one of its two cells.`;
  }
}
