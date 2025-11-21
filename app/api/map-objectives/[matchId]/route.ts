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

interface MapMetadata {
  id: number;
  name: string;
  map_rect: [[number, number], [number, number]];
  continent_rect: [[number, number], [number, number]];
}

// Cache for objective definitions (static data that rarely changes)
let objectiveDefinitionsCache: ObjectiveDefinition[] | null = null;
let objectiveDefinitionsCacheTime = 0;
const OBJECTIVE_DEFINITIONS_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Cache for map metadata (static data that rarely changes)
let mapMetadataCache: Map<number, MapMetadata> = new Map();
let mapMetadataCacheTime = 0;
const MAP_METADATA_CACHE_TTL = 1000 * 60 * 60; // 1 hour

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

async function fetchMapMetadata(mapIds: number[]): Promise<Map<number, MapMetadata>> {
  const now = Date.now();

  // Check if we need to fetch any new map data
  const missingMapIds = mapIds.filter(id => !mapMetadataCache.has(id));

  // Return cached data if still valid and we have all the maps
  if (missingMapIds.length === 0 && (now - mapMetadataCacheTime) < MAP_METADATA_CACHE_TTL) {
    return mapMetadataCache;
  }

  // Fetch map metadata from GW2 API
  if (missingMapIds.length > 0) {
    const response = await fetch(
      `https://api.guildwars2.com/v2/maps?ids=${missingMapIds.join(',')}`,
      { cache: 'force-cache' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch map metadata');
    }

    const maps = await response.json() as MapMetadata[];

    // Update cache with new maps
    maps.forEach((map) => {
      mapMetadataCache.set(map.id, map);
    });

    mapMetadataCacheTime = now;
  }

  return mapMetadataCache;
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
    const uniqueMapIds = new Set<number>();

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
              uniqueMapIds.add(definition.map_id);
            }
          }
        }
      }
    }

    // Fetch map metadata for coordinate transformation
    const mapMetadata = await fetchMapMetadata(Array.from(uniqueMapIds));

    // Convert map metadata to plain object for JSON serialization
    const mapMetadataObj: { [key: number]: MapMetadata } = {};
    mapMetadata.forEach((metadata, mapId) => {
      mapMetadataObj[mapId] = metadata;
    });

    return NextResponse.json({
      objectives,
      mapMetadata: mapMetadataObj,
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
