import { BOARD_LAYOUT } from '../engine/board';
import { cardShort, type CardNotation } from '../engine/cards';
import type { LogEntry } from '../engine/game';
import { teamName } from './teams';

// Short enough to fit a phone's single ticker line with a typical name, e.g. "Ana timed out: J♣ played on 6♦".

/** One plain-language line per log entry, e.g. "Ana played 7♥". */
export function describeLog(entry: LogEntry, notation: CardNotation = 'suits'): string {
  return 'timed_out' in entry && entry.timed_out ? describeTimedOut(entry, notation) : describeMove(entry, notation);
}

type PlayerEntry = Extract<LogEntry, { player: string }>;

/**
 * The latest turn in one line. A move that made a sequence (or won) says who made it and with what, e.g. "Ana
 * played 7♥ and made a sequence", where the log itself has the move and "Team Green completed a sequence" apart.
 */
export function describeLatest(log: LogEntry[], notation: CardNotation = 'suits'): string {
  const last = log.at(-1);
  if (!last) return '';
  if (last.kind !== 'sequence' && last.kind !== 'win') return describeLog(last, notation);
  // The sequence and win entries follow the move that made them, in the same turn.
  let i = log.length - 1;
  while (i >= 0 && (log[i].kind === 'sequence' || log[i].kind === 'win') && log[i].turn === last.turn) i--;
  const move = log[i];
  if (!move || move.turn !== last.turn || move.kind !== 'place') return describeLog(last, notation);
  const made = log.slice(i + 1).filter((entry) => entry.kind === 'sequence').length;
  const outcome = last.kind === 'win' ? 'won the game' : made > 1 ? `made ${made} sequences` : 'made a sequence';
  const card = placed(move, cardShort(BOARD_LAYOUT[move.pos.row][move.pos.column], notation), notation);
  return move.timed_out ? `${move.player} timed out: ${card} ${outcome}` : `${move.player} played ${card} and ${outcome}`;
}

/** The card and, for a jack, the cell it went on. A numbered jack already says Wild. */
function placed(entry: Extract<LogEntry, { kind: 'place' }>, cell: string, notation: CardNotation): string {
  if (!entry.wild) return cell;
  return `${notation === 'numbers' ? 'Wild' : cardShort(entry.card, notation)} on ${cell}`;
}

/** A move made for a player whose turn timer ran out. */
function describeTimedOut(entry: PlayerEntry, notation: CardNotation): string {
  const late = `${entry.player} timed out:`;
  switch (entry.kind) {
    case 'place': {
      const cell = cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column], notation);
      return entry.wild ? `${late} ${notation === 'numbers' ? 'Wild' : cardShort(entry.card, notation)} played on ${cell}` : `${late} ${cell} played`;
    }
    case 'remove':
      return `${late} ${cardShort(entry.card, notation)} removed ${teamName(entry.removedTeam)}'s chip`;
    case 'exchange':
      return `${late} dead ${cardShort(entry.card, notation)} swapped`;
    case 'pass':
      return `${late} no move, passed`;
    case 'forfeit':
      return describeMove(entry, notation);
  }
}

function describeMove(entry: LogEntry, notation: CardNotation): string {
  switch (entry.kind) {
    case 'place':
      return `${entry.player} played ${placed(entry, cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column], notation), notation)}`;
    case 'remove': {
      const cell = cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column], notation);
      return `${entry.player} removed ${teamName(entry.removedTeam)}'s chip from ${cell}`;
    }
    case 'exchange':
      return entry.auto ? `${entry.player}'s dead ${cardShort(entry.card, notation)} auto-swapped` : `${entry.player} swapped dead ${cardShort(entry.card, notation)}`;
    case 'pass':
      return `${entry.player} had no move and passed`;
    case 'sequence':
      return `${teamName(entry.team)} made a sequence`;
    case 'win':
      return `${teamName(entry.team)} won the game`;
    case 'forfeit':
      return entry.auto ? `${entry.player} forfeited (missed turns)` : `${entry.player} forfeited`;
  }
}
