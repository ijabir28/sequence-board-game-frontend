import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BOARD_SIZE, posKey, type Pos } from '../../engine/board';
import { useBoardStyle, useDeck } from '../../decks/decks';
import { BLANK, cardLabel, cardNumber, parseCard, type BoardCardName, type CardNotation } from '../../engine/cards';
import type { Sequence } from '../../engine/sequences';
import type { TeamIndex } from '../../engine/setup';
import { TEAM_STYLES, teamChipLabel, teamName } from '../../game/teams';
import { tipProps } from '../ui/TooltipLayer';
import type { CellView } from '../../game/types';
import { SuitIcon } from '../cards/SuitIcon';
import { Chip } from '../Chip';
import { cellCentre } from './geometry';
import { TurnBar, type TurnBarProps } from './TurnBar';
import styles from './Board.module.css';

export type TargetMode = 'place' | 'remove';

interface BoardProps {
  board: CellView[][];
  sequences: Sequence[];
  /** Legal cells for the selected hand card; null when no card is selected. */
  targets: Pos[] | null;
  targetMode: TargetMode;
  /** Team colour used for target highlights. */
  activeTeam: TeamIndex | null;
  lastMove: Pos | null;
  /** A training hint's suggested cell. */
  hint?: Pos | null;
  /** The cell of the move drafted for the viewer's next turn. */
  draft?: Pos | null;
  disabled?: boolean;
  /**
   * The viewer's own turn: the turn timer runs round the board's perimeter as a bar (see TurnBar), keyed by `turn` so
   * each turn starts with a full bar. Null on everyone else's turn: the plain board.
   */
  turnEdge?: (TurnBarProps & { turn: number | null }) | null;
  onActivate: (pos: Pos) => void;
}

/** The 10×10 board as an ARIA grid: arrow keys move, Enter or Space plays the selected card. */
export function Board({
  board,
  sequences,
  targets,
  targetMode,
  activeTeam,
  lastMove,
  hint = null,
  draft = null,
  disabled = false,
  turnEdge = null,
  onActivate,
}: BoardProps) {
  const [focus, setFocus] = useState<Pos>({ row: 0, column: 1 });
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const targetKeys = useMemo(() => new Set(targets?.map(posKey)), [targets]);
  const hasSelection = targets !== null;

  // When a new card is selected, park the roving focus on its first legal cell so that
  // keyboard players can Tab straight to a useful spot.
  useEffect(() => {
    if (targets && targets.length > 0) setFocus(targets[0]);
  }, [targets]);

  const moveFocus = (next: Pos) => {
    setFocus(next);
    cellRefs.current[next.row * BOARD_SIZE + next.column]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { row, column } = focus;
    const last = BOARD_SIZE - 1;
    const moves: Record<string, Pos> = {
      ArrowUp: { row: Math.max(0, row - 1), column },
      ArrowDown: { row: Math.min(last, row + 1), column },
      ArrowLeft: { row, column: Math.max(0, column - 1) },
      ArrowRight: { row, column: Math.min(last, column + 1) },
      Home: { row, column: 0 },
      End: { row, column: last },
    };
    if (event.ctrlKey && event.key === 'Home') moves.Home = { row: 0, column: 0 };
    if (event.ctrlKey && event.key === 'End') moves.End = { row: last, column: last };
    const next = moves[event.key];
    if (next) {
      event.preventDefault();
      moveFocus(next);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled) onActivate(focus);
    }
  };

  const teamStyle = activeTeam !== null ? TEAM_STYLES[activeTeam] : null;
  // The cells follow the viewer's card deck: its suit colours, and on light card-face cells its face colour too.
  const [deck] = useDeck();
  const [boardStyle] = useBoardStyle();

  return (
    <div
      className={[
        styles.board,
        hasSelection && styles.selecting,
        targetMode === 'remove' && styles.removing,
      ]
        .filter(Boolean)
        .join(' ')}
      data-suits={deck.suits}
      data-cells={boardStyle}
      // The table chat's reactions never float over the board (src/chat/safeLane.ts); on phones they rise from its top
      // edge (src/chat/TableChat.tsx).
      data-chat-avoid
      data-chat-anchor="board"
      style={
        {
          '--deck-face': deck.face,
          ...(teamStyle && { '--active-team': teamStyle.color, '--active-glow': teamStyle.glow }),
        } as React.CSSProperties
      }
    >
      <div
        role="grid"
        aria-label="Sequence board, 10 by 10"
        aria-rowcount={BOARD_SIZE}
        aria-colcount={BOARD_SIZE}
        aria-disabled={disabled || undefined}
        className={styles.grid}
        onKeyDown={onKeyDown}
      >
        {board.map((row, r) => (
          <div role="row" key={r} className={styles.row} aria-rowindex={r + 1}>
            {row.map((cell) => {
              const key = posKey(cell);
              const isFocus = focus.row === cell.row && focus.column === cell.column;
              return (
                <Cell
                  key={key}
                  cell={cell}
                  cellRef={(el) => (cellRefs.current[cell.row * BOARD_SIZE + cell.column] = el)}
                  tabbable={isFocus}
                  target={targetKeys.has(key)}
                  dimmed={hasSelection && !targetKeys.has(key)}
                  removing={targetMode === 'remove'}
                  last={lastMove !== null && lastMove.row === cell.row && lastMove.column === cell.column}
                  hinted={hint !== null && hint.row === cell.row && hint.column === cell.column}
                  drafted={draft !== null && draft.row === cell.row && draft.column === cell.column}
                  notation={deck.notation}
                  onFocus={() => setFocus({ row: cell.row, column: cell.column })}
                  onClick={() => !disabled && onActivate({ row: cell.row, column: cell.column })}
                />
              );
            })}
          </div>
        ))}
      </div>
      <SequenceBeams sequences={sequences} />
      {turnEdge && (
        <TurnBar
          key={turnEdge.turn ?? 'turn'}
          turnStartedAt={turnEdge.turnStartedAt}
          turnDeadline={turnEdge.turnDeadline}
          paused={turnEdge.paused}
        />
      )}
    </div>
  );
}

interface CellProps {
  cell: CellView;
  tabbable: boolean;
  target: boolean;
  dimmed: boolean;
  removing: boolean;
  last: boolean;
  hinted: boolean;
  drafted: boolean;
  notation: CardNotation;
  onFocus: () => void;
  onClick: () => void;
  cellRef: (el: HTMLDivElement | null) => void;
}

function cellAriaLabel(cell: CellView, target: boolean, removing: boolean, hinted: boolean, drafted: boolean, notation: CardNotation): string {
  const parts = [cellLabelText(cell.card, notation)];
  parts.push(cell.chip === null ? (cell.card === BLANK ? 'counts for every team' : 'empty') : teamChipLabel(cell.chip));
  if (cell.locked) parts.push('in a completed sequence');
  if (target) parts.push(removing ? 'can be removed' : 'playable');
  if (hinted) parts.push('suggested by the hint');
  if (drafted) parts.push('your drafted move');
  return parts.join(', ');
}

/** What hovering (or long-pressing) a cell says: the card, who holds it, and what a click would do. */
function cellTip(cell: CellView, target: boolean, removing: boolean, hinted: boolean, drafted: boolean, notation: CardNotation): string {
  const corner = cell.card === BLANK;
  const name = corner ? 'Free corner' : cardLabel(cell.card, notation);
  let state: string;
  if (cell.chip !== null) state = `${teamName(cell.chip)} chip${cell.locked ? ', locked in a sequence' : ''}`;
  else state = corner ? 'counts for every team' : 'empty';
  const action = drafted
    ? 'Your drafted move: it is played here when your turn comes.'
    : target
      ? removing
        ? 'Click to remove this chip.'
        : 'Click to place your chip here.'
      : hinted
        ? 'The hint suggests this cell.'
        : '';
  return [`${name}: ${state}.`, action].filter(Boolean).join(' ');
}

function cellLabelText(card: BoardCardName, notation: CardNotation): string {
  return card === BLANK ? 'Corner' : cardLabel(card, notation);
}

function Cell({ cell, tabbable, target, dimmed, removing, last, hinted, drafted, notation, onFocus, onClick, cellRef }: CellProps) {
  const corner = cell.card === BLANK;
  const parsed = corner ? null : parseCard(cell.card as Exclude<BoardCardName, 'Blank'>);
  return (
    <div
      role="gridcell"
      ref={cellRef}
      tabIndex={tabbable ? 0 : -1}
      aria-label={cellAriaLabel(cell, target, removing, hinted, drafted, notation)}
      aria-colindex={cell.column + 1}
      data-suit={parsed?.suit}
      {...tipProps(cellTip(cell, target, removing, hinted, drafted, notation))}
      className={[
        styles.cell,
        corner && styles.corner,
        target && styles.target,
        dimmed && styles.dimmed,
        last && styles.last,
        hinted && styles.hinted,
        drafted && styles.drafted,
      ]
        .filter(Boolean)
        .join(' ')}
      onFocus={onFocus}
      onClick={onClick}
    >
      {parsed && notation === 'numbers' ? (
        // The Numbered deck: the cell's number, in its suit's colour, in place of rank and suit.
        <span className={[styles.rank, styles.number].join(' ')} aria-hidden="true">
          {cardNumber(cell.card as Exclude<BoardCardName, 'Blank'>)}
        </span>
      ) : parsed ? (
        <>
          <span className={styles.rank} aria-hidden="true">
            {parsed.rank}
          </span>
          <SuitIcon suit={parsed.suit} className={styles.suit} />
        </>
      ) : (
        <span className={styles.cornerMark} aria-hidden="true">
          ★
        </span>
      )}
      {cell.chip !== null && (
        <span className={[styles.chip, target && removing && styles.chipRemovable].filter(Boolean).join(' ')}>
          <Chip team={cell.chip} locked={cell.locked} />
        </span>
      )}
    </div>
  );
}

/** Glowing lines through completed sequences, drawn over the grid. */
function SequenceBeams({ sequences }: { sequences: Sequence[] }) {
  if (sequences.length === 0) return null;
  // Through the real centres of the cells, allowing for the gaps between them.
  const center = (p: Pos) => ({ x: cellCentre(p.column), y: cellCentre(p.row) });
  return (
    <svg className={styles.beams} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {sequences.map((s, i) => {
        const a = center(s.cells[0]);
        const b = center(s.cells[s.cells.length - 1]);
        const color = TEAM_STYLES[s.team].color;
        return (
          <g key={i} style={{ color }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.beamGlow} vectorEffect="non-scaling-stroke" />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.beam} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
