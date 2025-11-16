import { IMatchResponse } from '../interfaces/match-response.interface';
import { IWorld } from '../interfaces/world.interface';

export interface IFormattedMatch {
  id: string;
  red: {
    kills: number;
    deaths: number;
    victoryPoints: number;
    skirmishScore: number;
    ratio: number;
    activity: number;
    world: {
      id: number;
      name: string;
      associated_world_id: number;
      population: string;
    };
  };
  blue: {
    kills: number;
    deaths: number;
    victoryPoints: number;
    skirmishScore: number;
    ratio: number;
    activity: number;
    world: {
      id: number;
      name: string;
      associated_world_id: number;
      population: string;
    };
  };
  green: {
    kills: number;
    deaths: number;
    victoryPoints: number;
    skirmishScore: number;
    ratio: number;
    activity: number;
    world: {
      id: number;
      name: string;
      associated_world_id: number;
      population: string;
    };
  };
}

export function formatMatches(
  matches: IMatchResponse[],
  worlds: IWorld[]
): Record<string, IFormattedMatch> {
  const formattedMatches: Record<string, IFormattedMatch> = {};

  for (const match of matches) {
    // Get current skirmish scores (last skirmish)
    const currentSkirmish = match.skirmishes?.[match.skirmishes.length - 1];
    const skirmishScores = currentSkirmish?.scores || { red: 0, blue: 0, green: 0 };

    // Helper to find world by ID
    const findWorld = (worldId: number) => {
      const world = worlds.find((w) => w.id === worldId || w.id === worldId + 10000);
      return world || { id: worldId, name: `World ${worldId}`, population: 'Unknown' };
    };

    // Helper to format team data
    const formatTeam = (color: 'red' | 'blue' | 'green') => {
      const primaryWorldId = match.worlds[color]?.[0] || 0;
      const world = findWorld(primaryWorldId);

      const kills = match.kills[color] || 0;
      const deaths = match.deaths[color] || 0;
      const ratio = deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills;

      // Calculate activity (kills + deaths + victory points)
      const activity = kills + deaths + (match.victory_points[color] || 0);

      return {
        kills,
        deaths,
        victoryPoints: match.victory_points[color] || 0,
        skirmishScore: skirmishScores[color] || 0,
        ratio,
        activity,
        world: {
          id: world.id,
          name: world.name,
          associated_world_id: primaryWorldId,
          population: world.population,
        },
      };
    };

    formattedMatches[match.id] = {
      id: match.id,
      red: formatTeam('red'),
      blue: formatTeam('blue'),
      green: formatTeam('green'),
    };
  }

  return formattedMatches;
}
