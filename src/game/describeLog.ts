import { BOARD_LAYOUT } from '../engine/board';
import { cardShort, type CardNotation } from '../engine/cards';
import type { LogEntry } from '../engine/game';
import { teamName } from './teams';

/** One plain-language line per log entry, e.g. "Ana played 7♥". */
export function describeLog(entry: LogEntry, notation: CardNotation = 'suits'): string {
  return 'timed_out' in entry && entry.timed_out ? describeTimedOut(entry, notation) : describeMove(entry, notation);
}

/** A move made for a player whose turn timer ran out. */
function describeTimedOut(entry: Extract<LogEntry, { player: string }>, notation: CardNotation): string {
  const late = `${entry.player} ran out of time`;
  switch (entry.kind) {
    case 'place':
      return `${late}, so ${cardShort(entry.card, notation)} was played for them on ${cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column], notation)}`;
    case 'remove':
      return `${late}, so ${cardShort(entry.card, notation)} removed ${teamName(entry.removedTeam)}'s chip for them`;
    case 'exchange':
      return `${late}, so their dead card ${cardShort(entry.card, notation)} was swapped`;
    case 'pass':
      return `${late} with no playable card, so their turn passed`;
  }
}

function describeMove(entry: LogEntry, notation: CardNotation): string {
  switch (entry.kind) {
    case 'place': {
      const cell = cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column], notation);
      // A numbered jack already says Wild.
      const wild = notation === 'numbers' ? 'a Wild card' : `wild ${cardShort(entry.card, notation)}`;
      return entry.wild ? `${entry.player} played ${wild} on ${cell}` : `${entry.player} played ${cell}`;
    }
    case 'remove': {
      const cell = cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column], notation);
      return `${entry.player} used ${cardShort(entry.card, notation)} to remove ${teamName(entry.removedTeam)}'s chip from ${cell}`;
    }
    case 'exchange':
      return entry.auto
        ? `${entry.player}'s dead card ${cardShort(entry.card, notation)} was swapped for a new one automatically`
        : `${entry.player} swapped dead card ${cardShort(entry.card, notation)} for a new one`;
    case 'pass':
      return `${entry.player} had no playable card and passed`;
    case 'sequence':
      return `${teamName(entry.team)} completed a sequence`;
    case 'win':
      return `${teamName(entry.team)} won the game`;
  }
}
