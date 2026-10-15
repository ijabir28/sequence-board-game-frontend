import type { Room } from '../api/rooms';
import { TEAM_STYLES } from './teams';

/** Who sits on which team, e.g. "Green: Ana, Ben · Blue: Cy". Empty teams are left out. */
export function describeTeams(room: Room): string {
  return room.teams
    .map((team) => {
      const names = team.seats.filter((seat) => seat !== null).map((seat) => seat!.name);
      return names.length > 0 ? `${TEAM_STYLES[team.index]?.name ?? team.handle}: ${names.join(', ')}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * The notice every player sees after the host reshuffles the teams: who did it, your new team (when you have a
 * seat), and everyone's new team.
 */
export function describeShuffle(room: Room, byName: string, you: string | null): string {
  const yours = room.teams.find((team) => team.seats.some((seat) => seat?.handle === you));
  const lead = yours
    ? `${byName} shuffled the teams. You're now on Team ${TEAM_STYLES[yours.index]?.name ?? yours.handle}.`
    : `${byName} shuffled the teams.`;
  const teams = describeTeams(room);
  return teams ? `${lead} ${teams}.` : lead;
}
