import { BOARD_LAYOUT } from '../engine/board';
import { cardShort } from '../engine/cards';
import type { LogEntry } from '../engine/game';
import { teamName } from './teams';

/** One plain-language line per log entry, e.g. "Ana played 7♥". */
export function describeLog(entry: LogEntry): string {
  switch (entry.kind) {
    case 'place': {
      const cell = cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column]);
      return entry.wild ? `${entry.player} played wild ${cardShort(entry.card)} on ${cell}` : `${entry.player} played ${cell}`;
    }
    case 'remove': {
      const cell = cardShort(BOARD_LAYOUT[entry.pos.row][entry.pos.column]);
      return `${entry.player} used ${cardShort(entry.card)} to remove ${teamName(entry.removedTeam)}'s chip from ${cell}`;
    }
    case 'exchange':
      return entry.auto
        ? `${entry.player}'s dead card ${cardShort(entry.card)} was swapped for a new one automatically`
        : `${entry.player} swapped dead card ${cardShort(entry.card)} for a new one`;
    case 'pass':
      return `${entry.player} had no playable card and passed`;
    case 'sequence':
      return `${teamName(entry.team)} completed a sequence`;
    case 'win':
      return `${teamName(entry.team)} won the game`;
  }
}
