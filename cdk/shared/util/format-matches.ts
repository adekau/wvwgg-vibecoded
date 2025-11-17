import { IMatchResponse } from '../interfaces/match-response.interface';
import { IWorld } from '../interfaces/world.interface';
import { getVPTierForSkirmish, getRegionFromMatchId } from './vp-tiers';

export interface IFormattedMatch {
  id: string;
  start_time: string;
  end_time: string;
  red: {
    kills: number;
    deaths: number;
    victoryPoints: number;
    skirmishScore: number;
    totalScore: number;
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
    totalScore: number;
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
    totalScore: number;
    ratio: number;
    activity: number;
    world: {
      id: number;
      name: string;
      associated_world_id: number;
      population: string;
    };
  };
  maps: Array<{
    id: number;
    type: string;
    scores: {
      red: number;
      blue: number;
      green: number;
    };
    kills: {
      red: number;
      blue: number;
      green: number;
    };
    deaths: {
      red: number;
      blue: number;
      green: number;
    };
  }>;
  skirmishes: Array<{
    id: number;
    scores: {
      red: number;
      blue: number;
      green: number;
    };
    vpTier?: {
      first: number;
      second: number;
      third: number;
      tier: 'low' | 'medium' | 'high' | 'peak';
    };
  }>;
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

    // Calculate total scores (sum of all skirmishes)
    const totalScores = { red: 0, blue: 0, green: 0 };
    if (match.skirmishes && match.skirmishes.length > 0) {
      for (const skirmish of match.skirmishes) {
        totalScores.red += skirmish.scores.red || 0;
        totalScores.blue += skirmish.scores.blue || 0;
        totalScores.green += skirmish.scores.green || 0;
      }
    }

    // Helper to find world by ID
    const findWorld = (worldId: number) => {
      // First try to find alliance world by associated_world_id
      const allianceWorld = worlds.find((w: any) => w.associated_world_id === worldId);
      if (allianceWorld) return allianceWorld;

      // Fall back to finding by direct ID match
      const world = worlds.find((w) => w.id === worldId);
      return world || { id: worldId, name: `World ${worldId}`, population: 'Unknown' };
    };

    // Helper to format team data
    const formatTeam = (color: 'red' | 'blue' | 'green') => {
      // match.worlds[color] is a number, not an array
      const primaryWorldId = match.worlds[color] || 0;
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
        totalScore: totalScores[color] || 0,
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
      start_time: match.start_time,
      end_time: match.end_time,
      red: formatTeam('red'),
      blue: formatTeam('blue'),
      green: formatTeam('green'),
      maps: match.maps?.map(m => ({
        id: m.id,
        type: m.type,
        scores: m.scores,
        kills: m.kills,
        deaths: m.deaths,
      })) || [],
      skirmishes: match.skirmishes?.map(s => {
        const region = getRegionFromMatchId(match.id);
        const vpTier = getVPTierForSkirmish(s.id, match.start_time, region);
        return {
          id: s.id,
          scores: s.scores,
          vpTier,
        };
      }) || [],
    };
  }

  return formattedMatches;
}
