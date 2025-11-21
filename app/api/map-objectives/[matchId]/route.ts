import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 10; // Cache for 10 seconds (more frequent updates for map)

interface RouteParams {
  params: Promise<{
    matchId: string;
  }>;
}

interface ObjectiveDefinition {
  id: string;
  name: string;
  coord: [number, number];
  map_id: number;
  map_type: string;
  chat_link: string;
  sector_id: number;
  type: string;
}

// Cache for objective definitions (static data that rarely changes)
let objectiveDefinitionsCache: ObjectiveDefinition[] | null = null;
let objectiveDefinitionsCacheTime = 0;
const OBJECTIVE_DEFINITIONS_CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function fetchObjectiveDefinitions(): Promise<ObjectiveDefinition[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (objectiveDefinitionsCache && (now - objectiveDefinitionsCacheTime) < OBJECTIVE_DEFINITIONS_CACHE_TTL) {
    return objectiveDefinitionsCache;
  }

  // Fetch all objective definitions from GW2 API
  const response = await fetch('https://api.guildwars2.com/v2/wvw/objectives?ids=all', {
    cache: 'force-cache',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch objective definitions');
  }

  const definitions = await response.json() as ObjectiveDefinition[];

  // Update cache
  objectiveDefinitionsCache = definitions;
  objectiveDefinitionsCacheTime = now;

  return definitions;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { matchId } = await params;

  try {
    // Fetch match data and objective definitions in parallel
    const [matchResponse, objectiveDefinitions] = await Promise.all([
      fetch(`https://api.guildwars2.com/v2/wvw/matches?id=${matchId}`, {
        cache: 'no-store',
      }),
      fetchObjectiveDefinitions(),
    ]);

    if (!matchResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch match data' },
        { status: matchResponse.status }
      );
    }

    const matchData = await matchResponse.json();

    // Create a map of objective definitions by ID for quick lookup
    const definitionsMap = new Map<string, ObjectiveDefinition>(
      objectiveDefinitions.map((def) => [def.id, def])
    );

    // Extract all objectives from all maps with their definitions
    const objectives: any[] = [];

    if (matchData.maps && Array.isArray(matchData.maps)) {
      for (const map of matchData.maps) {
        if (map.objectives && Array.isArray(map.objectives)) {
          for (const obj of map.objectives) {
            const definition = definitionsMap.get(obj.id);

            if (definition) {
              objectives.push({
                ...obj,
                name: definition.name,
                coord: definition.coord,
                map_id: definition.map_id,
                map_type: definition.map_type,
                chat_link: definition.chat_link,
                sector_id: definition.sector_id,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      objectives,
      matchId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching map objectives:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
