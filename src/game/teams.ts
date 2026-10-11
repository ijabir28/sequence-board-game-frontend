import type { TeamIndex } from '../engine/setup';

export type ChipShape = 'circle' | 'diamond' | 'triangle';

export interface TeamStyle {
  name: string;
  shape: ChipShape;
  /** CSS custom property holding the team colour. */
  color: string;
  ink: string;
  glow: string;
}

// Colour plus a distinct shape per team, so teams are told apart without relying on colour.
export const TEAM_STYLES: Record<TeamIndex, TeamStyle> = {
  0: { name: 'Green', shape: 'circle', color: 'var(--team-0)', ink: 'var(--team-0-ink)', glow: 'var(--team-0-glow)' },
  1: { name: 'Blue', shape: 'diamond', color: 'var(--team-1)', ink: 'var(--team-1-ink)', glow: 'var(--team-1-glow)' },
  2: { name: 'Red', shape: 'triangle', color: 'var(--team-2)', ink: 'var(--team-2-ink)', glow: 'var(--team-2-glow)' },
};

export function teamName(team: TeamIndex): string {
  return `Team ${TEAM_STYLES[team].name}`;
}

/** Label used in ARIA text, e.g. "team 2 (Blue, diamond) chip". */
export function teamChipLabel(team: TeamIndex): string {
  const { name, shape } = TEAM_STYLES[team];
  return `team ${team + 1} chip (${name}, ${shape})`;
}
