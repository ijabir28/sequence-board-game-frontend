// Table setup: team/player counts, seating and dealing, per the official rules.

export type TeamCount = 2 | 3;
export type TeamIndex = 0 | 1 | 2;

/** Cards dealt to each player, keyed by total player count. Other totals are not playable. */
export const HAND_SIZE_BY_PLAYER_COUNT: Readonly<Record<number, number>> = {
  2: 7,
  3: 6,
  4: 6,
  6: 5,
  8: 4,
  9: 4,
  10: 3,
  12: 3,
};

/** Sequences a team needs to win: 2 with two teams, 1 with three teams. */
export function sequencesToWin(teamCount: TeamCount): number {
  return teamCount === 2 ? 2 : 1;
}

export function handSizeFor(totalPlayers: number): number | undefined {
  return HAND_SIZE_BY_PLAYER_COUNT[totalPlayers];
}

/** Players-per-team options that give a supported total for this team count. */
export function playersPerTeamOptions(teamCount: TeamCount): number[] {
  const options: number[] = [];
  for (let perTeam = 1; perTeam <= 6; perTeam++) {
    if (handSizeFor(perTeam * teamCount) !== undefined) options.push(perTeam);
  }
  return options;
}

export function isSupportedTable(teamCount: number, playersPerTeam: number): teamCount is TeamCount {
  return (teamCount === 2 || teamCount === 3) && playersPerTeamOptions(teamCount).includes(playersPerTeam);
}

/** Seat order alternates teams: T1, T2, [T3,] T1, T2, … Returns each seat's team. */
export function seatTeams(teamCount: TeamCount, playersPerTeam: number): TeamIndex[] {
  return Array.from({ length: teamCount * playersPerTeam }, (_, seat) => (seat % teamCount) as TeamIndex);
}

/** Fisher–Yates shuffle with an injectable random source (for deterministic tests). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Small seeded PRNG (mulberry32) so games and tests can be reproduced. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
