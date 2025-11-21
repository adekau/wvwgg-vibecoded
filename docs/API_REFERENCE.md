# API Reference

This document provides comprehensive documentation for all API endpoints in the WvW.gg application. All endpoints return JSON responses and use standard HTTP status codes.

## Table of Contents

- [Match Data](#match-data)
- [Guild Management](#guild-management)
- [GW2 Data Proxies](#gw2-data-proxies)
- [Admin](#admin)
- [Error Handling](#error-handling)
- [Rate Limiting & Caching](#rate-limiting--caching)

---

## Match Data

### GET /api/worlds

Fetches all available world names and IDs from DynamoDB cache.

**Response**
```typescript
{
  [matchId: string]: {
    red: { id: number; name: string };
    blue: { id: number; name: string };
    green: { id: number; name: string };
    region: string; // "na", "eu", or "both"
    start_time: string; // ISO 8601 timestamp
    end_time: string; // ISO 8601 timestamp
  }
}
```

**Example Response**
```json
{
  "1-1": {
    "red": { "id": 1001, "name": "Anvil Rock" },
    "blue": { "id": 1002, "name": "Borlis Pass" },
    "green": { "id": 1003, "name": "Yak's Bend" },
    "region": "na",
    "start_time": "2025-01-15T18:00:00.000Z",
    "end_time": "2025-01-22T18:00:00.000Z"
  }
}
```

**Error Responses**
- `500`: Failed to fetch worlds

**Cache**: ISR revalidation based on DynamoDB data

**Source**: `app/api/worlds/route.ts`

---

### GET /api/objectives/[matchId]

Fetches live objective counts (castles, keeps, towers, camps) for a specific match from the GW2 API.

**Parameters**
- `matchId` (path): Match identifier (e.g., "1-1", "2-3")

**Response**
```typescript
{
  objectives: {
    red: {
      castles: number;
      keeps: number;
      towers: number;
      camps: number;
    };
    blue: {
      castles: number;
      keeps: number;
      towers: number;
      camps: number;
    };
    green: {
      castles: number;
      keeps: number;
      towers: number;
      camps: number;
    };
  };
}
```

**Example Response**
```json
{
  "objectives": {
    "red": { "castles": 1, "keeps": 4, "towers": 8, "camps": 12 },
    "blue": { "castles": 1, "keeps": 3, "towers": 6, "camps": 9 },
    "green": { "castles": 1, "keeps": 5, "towers": 10, "camps": 15 }
  }
}
```

**Error Responses**
- `404`: Match not found
- `500`: Failed to fetch match data or internal server error

**Cache**: 30 seconds (ISR)

**Source**: `app/api/objectives/[matchId]/route.ts`

---

### GET /api/history/[matchId]

Fetches historical snapshots for a specific match from DynamoDB. Returns 15-minute interval snapshots from match start to current time.

**Parameters**
- `matchId` (path): Match identifier (e.g., "1-1", "2-3")
- `hours` (query, optional): Number of hours to fetch (legacy parameter, defaults to match duration)

**Query Examples**
```
GET /api/history/1-1
GET /api/history/1-1?hours=24
```

**Response**
```typescript
{
  history: Array<{
    timestamp: number; // Unix timestamp in milliseconds
    red: {
      score: number; // Total accumulated score (PPT * time)
      kills: number;
      deaths: number;
      victoryPoints: number; // Total VP accumulated
    };
    blue: {
      score: number;
      kills: number;
      deaths: number;
      victoryPoints: number;
    };
    green: {
      score: number;
      kills: number;
      deaths: number;
      victoryPoints: number;
    };
    maps: Array<{
      type: string; // "RedHome", "BlueHome", "GreenHome", "Center"
      scores: { red: number; blue: number; green: number };
      objectives: Array<{
        id: string;
        type: string; // "Castle", "Keep", "Tower", "Camp"
        owner: string; // "Red", "Blue", "Green", "Neutral"
      }>;
    }>;
  }>
}
```

**Example Response**
```json
{
  "history": [
    {
      "timestamp": 1705348800000,
      "red": { "score": 125430, "kills": 4523, "deaths": 3821, "victoryPoints": 145 },
      "blue": { "score": 98234, "kills": 3456, "deaths": 4102, "victoryPoints": 112 },
      "green": { "score": 132567, "kills": 4789, "deaths": 3567, "victoryPoints": 158 },
      "maps": [...]
    }
  ]
}
```

**Error Responses**
- `500`: Internal server error

**Cache**: 2 minutes (ISR)

**Source**: `app/api/history/[matchId]/route.ts`

---

### GET /api/match-history

Lists all available historical match snapshots in DynamoDB.

**Response**
```typescript
{
  matches: Array<{
    matchId: string;
    timestamp: number;
    data: MatchData; // Full match snapshot data
  }>;
}
```

**Error Responses**
- `500`: Failed to fetch match history

**Source**: `app/api/match-history/route.ts`

---

### GET /api/map-objectives/[matchId]

Fetches detailed map objectives for a specific match, including objective IDs and coordinates.

**Parameters**
- `matchId` (path): Match identifier

**Response**
```typescript
{
  maps: Array<{
    type: string; // "RedHome", "BlueHome", "GreenHome", "Center"
    objectives: Array<{
      id: string;
      type: string; // "Castle", "Keep", "Tower", "Camp", "Spawn"
      owner: string; // "Red", "Blue", "Green", "Neutral"
      points_tick: number;
      points_capture: number;
      coord: [number, number]; // [x, y] map coordinates
    }>;
  }>;
}
```

**Error Responses**
- `404`: Match not found
- `500`: Internal server error

**Cache**: 30 seconds (ISR)

**Source**: `app/api/map-objectives/[matchId]/route.ts`

---

## Guild Management

### GET /api/admin/guilds

Lists all guild associations stored in DynamoDB. Returns paginated results with a maximum of 100 pages.

**Authentication**: None (to be added)

**Response**
```typescript
{
  guilds: Array<{
    id: string; // Guild ID (UUID format)
    name: string; // Guild name
    tag: string; // Guild tag (e.g., "[TAG]")
    worldId: number; // Associated world ID
    classification: "alliance" | "member" | null;
    allianceGuildId: string | null; // Parent alliance guild ID
    memberGuildIds: string[]; // Child member guild IDs
    description: string | null;
    contact_info: string | null;
    recruitment_status: "open" | "closed" | "recruiting" | null;
    notes: string | null;
    updatedAt: number; // Unix timestamp
    auditLog: Array<{
      timestamp: number;
      action: string;
      user: string;
      changes: Record<string, any>;
    }>;
  }>;
  count: number; // Number of guilds returned
  total: number; // Total items fetched
}
```

**Example Response**
```json
{
  "guilds": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Example Guild",
      "tag": "[EX]",
      "worldId": 1001,
      "classification": "alliance",
      "allianceGuildId": null,
      "memberGuildIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "description": "A competitive WvW guild",
      "contact_info": "discord.gg/example",
      "recruitment_status": "recruiting",
      "notes": null,
      "updatedAt": 1705348800000,
      "auditLog": []
    }
  ],
  "count": 1,
  "total": 1
}
```

**Error Responses**
- `500`: Failed to fetch guilds

**Source**: `app/api/admin/guilds/route.ts`

---

### POST /api/admin/guilds

Creates a new guild association.

**Authentication**: None (to be added)

**Request Body**
```typescript
{
  guildId: string; // Guild UUID
  name: string;
  tag: string;
  worldId: number;
  classification?: "alliance" | "member";
  allianceGuildId?: string;
  description?: string;
  contact_info?: string;
  recruitment_status?: "open" | "closed" | "recruiting";
}
```

**Response**
```typescript
{
  success: boolean;
  guild: GuildData; // Created guild object
}
```

**Error Responses**
- `400`: Invalid request body
- `500`: Failed to create guild

**Source**: `app/api/admin/guilds/route.ts`

---

### PUT /api/admin/guilds/[guildId]

Updates an existing guild association.

**Parameters**
- `guildId` (path): Guild UUID

**Request Body**
```typescript
{
  name?: string;
  tag?: string;
  worldId?: number;
  classification?: "alliance" | "member";
  allianceGuildId?: string;
  memberGuildIds?: string[];
  description?: string;
  contact_info?: string;
  recruitment_status?: "open" | "closed" | "recruiting";
  notes?: string;
}
```

**Response**
```typescript
{
  success: boolean;
  guild: GuildData; // Updated guild object
}
```

**Error Responses**
- `400`: Invalid request body
- `404`: Guild not found
- `500`: Failed to update guild

**Source**: `app/api/admin/guilds/[guildId]/route.ts`

---

### DELETE /api/admin/guilds/[guildId]

Deletes a guild association.

**Parameters**
- `guildId` (path): Guild UUID

**Response**
```typescript
{
  success: boolean;
  message: string;
}
```

**Error Responses**
- `404`: Guild not found
- `500`: Failed to delete guild

**Source**: `app/api/admin/guilds/[guildId]/route.ts`

---

### POST /api/guilds/verify-ownership

Verifies guild ownership by checking the GW2 API with a provided API key.

**Request Body**
```typescript
{
  guildId: string; // Guild UUID
  apiKey: string; // GW2 API key with guild leader permissions
}
```

**Response**
```typescript
{
  verified: boolean;
  guild?: {
    id: string;
    name: string;
    tag: string;
  };
  error?: string;
}
```

**Example Response (Success)**
```json
{
  "verified": true,
  "guild": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Example Guild",
    "tag": "[EX]"
  }
}
```

**Example Response (Failure)**
```json
{
  "verified": false,
  "error": "API key does not have guild leader permissions"
}
```

**Error Responses**
- `400`: Missing guildId or apiKey
- `401`: Invalid API key
- `403`: API key lacks guild leader permissions
- `500`: Internal server error

**Source**: `app/api/guilds/verify-ownership/route.ts`

---

### GET /api/debug/guilds

Debug endpoint for viewing raw guild data from DynamoDB.

**Response**
```typescript
{
  guilds: Array<RawDynamoDBItem>;
}
```

**Error Responses**
- `500`: Failed to fetch guilds

**Source**: `app/api/debug/guilds/route.ts`

---

## GW2 Data Proxies

These endpoints proxy requests to the Guild Wars 2 API v2 with caching and error handling.

### GET /api/gw2/professions

Fetches all available professions (character classes).

**Response**
```typescript
{
  professions: Array<{
    id: string; // "Warrior", "Guardian", etc.
    name: string;
    icon: string; // Icon URL
    specializations: number[]; // Specialization IDs
    weapons: Record<string, {
      specialization: number;
      flags: string[];
      skills: Array<{ id: number }>;
    }>;
  }>;
}
```

**Cache**: 1 hour (GW2 API data rarely changes)

**Source**: `app/api/gw2/professions/route.ts`

---

### GET /api/gw2/professions/[id]

Fetches details for a specific profession.

**Parameters**
- `id` (path): Profession ID (e.g., "Warrior", "Guardian")

**Response**
```typescript
{
  id: string;
  name: string;
  icon: string;
  specializations: number[];
  weapons: Record<string, WeaponInfo>;
  flags: string[];
  skills: Array<{ id: number; slot: string; type: string }>;
}
```

**Error Responses**
- `404`: Profession not found
- `500`: Failed to fetch profession

**Cache**: 1 hour

**Source**: `app/api/gw2/professions/[id]/route.ts`

---

### GET /api/gw2/skills

Fetches all skill definitions.

**Query Parameters**
- `ids` (optional): Comma-separated skill IDs to fetch

**Response**
```typescript
Array<{
  id: number;
  name: string;
  description: string;
  icon: string;
  type: string; // "Weapon", "Heal", "Utility", "Elite", "Profession"
  weapon_type?: string;
  professions: string[];
  slot?: string; // "Weapon_1", "Heal", "Utility", "Elite"
  facts?: Array<SkillFact>;
  traited_facts?: Array<SkillFact>;
}>
```

**Cache**: 1 hour

**Source**: `app/api/gw2/skills/route.ts`

---

### GET /api/gw2/traits

Fetches all trait definitions.

**Query Parameters**
- `ids` (optional): Comma-separated trait IDs to fetch

**Response**
```typescript
Array<{
  id: number;
  name: string;
  description: string;
  icon: string;
  tier: number; // 1, 2, or 3
  specialization: number;
  facts?: Array<TraitFact>;
}>
```

**Cache**: 1 hour

**Source**: `app/api/gw2/traits/route.ts`

---

### GET /api/gw2/itemstats

Fetches all gear stat combinations (Berserker's, Assassin's, etc.).

**Response**
```typescript
Array<{
  id: number;
  name: string; // "Berserker's", "Assassin's", etc.
  attributes: {
    Power?: number;
    Precision?: number;
    Toughness?: number;
    Vitality?: number;
    ConditionDamage?: number;
    Healing?: number;
    Ferocity?: number;
    BoonDuration?: number;
    ConditionDuration?: number;
  };
}>
```

**Cache**: 1 hour

**Source**: `app/api/gw2/itemstats/route.ts`

---

### GET /api/gw2/items

Fetches item details from the GW2 API.

**Query Parameters**
- `ids` (required): Comma-separated item IDs to fetch

**Response**
```typescript
Array<{
  id: number;
  name: string;
  description: string;
  type: string; // "Armor", "Weapon", "Trinket", etc.
  rarity: string; // "Exotic", "Ascended", "Legendary"
  level: number;
  details?: {
    type?: string;
    weight_class?: string; // "Heavy", "Medium", "Light"
    defense?: number;
    infusion_slots?: Array<{ flags: string[] }>;
    infix_upgrade?: {
      id: number;
      attributes: Array<{ attribute: string; modifier: number }>;
    };
    stat_choices?: number[];
  };
}>
```

**Error Responses**
- `400`: Missing ids parameter
- `500`: Failed to fetch items

**Cache**: 1 hour

**Source**: `app/api/gw2/items/route.ts`

---

## Admin

### POST /api/revalidate

Triggers Next.js ISR (Incremental Static Regeneration) cache revalidation for specific paths.

**Request Body**
```typescript
{
  path?: string; // Path to revalidate (e.g., "/matches")
  tag?: string; // Cache tag to revalidate
}
```

**Response**
```typescript
{
  revalidated: boolean;
  message: string;
}
```

**Example Request**
```json
{
  "path": "/matches"
}
```

**Example Response**
```json
{
  "revalidated": true,
  "message": "Path revalidated successfully"
}
```

**Error Responses**
- `400`: Missing path or tag parameter
- `500`: Failed to revalidate

**Authentication**: None (should add secret token)

**Source**: `app/api/revalidate/route.ts`

---

## Error Handling

All API endpoints follow standard HTTP status code conventions:

### Success Codes
- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully

### Client Error Codes
- `400 Bad Request`: Invalid request body or parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found

### Server Error Codes
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Upstream service (GW2 API) error
- `503 Service Unavailable`: Service temporarily unavailable

### Error Response Format
```typescript
{
  error: string; // Human-readable error message
  details?: any; // Additional error details (dev mode only)
}
```

### Common Error Scenarios

**DynamoDB Connection Failures**
```json
{
  "error": "Failed to connect to database",
  "details": "AWS credentials not configured"
}
```

**GW2 API Rate Limiting**
```json
{
  "error": "Rate limited by GW2 API",
  "details": "Retry after 60 seconds"
}
```

**Invalid Match ID**
```json
{
  "error": "Match not found",
  "details": "Match ID '99-99' does not exist"
}
```

---

## Rate Limiting & Caching

### Client-Side Caching (Next.js ISR)
- **Match Data**: 60 seconds revalidation
- **Historical Data**: 2 minutes revalidation
- **Objectives**: 30 seconds revalidation
- **GW2 API Proxies**: 1 hour revalidation

### Server-Side Caching (DynamoDB)
- **Match Snapshots**: 15-minute intervals
- **World Cache**: 24-hour TTL
- **Guild Data**: No TTL (manual updates)

### GW2 API Rate Limits
- **Official Limit**: 300 requests per minute per IP
- **Our Strategy**:
  - Aggressive caching with ISR
  - Lambda functions fetch data at intervals
  - Client never directly calls GW2 API

### Recommended Client Behavior
- Use React Query with `staleTime: 30000` (30 seconds)
- Enable background refetching with `refetchInterval: 60000` (60 seconds)
- Implement exponential backoff for retries
- Handle 429 (Too Many Requests) gracefully

---

## Authentication & Authorization

**Current Status**: Most endpoints are publicly accessible.

**Planned Implementation**:
- AWS Cognito for user authentication
- Admin endpoints require `admin` role
- Guild ownership verification for guild management
- API key validation for GW2 integration

**Security Considerations**:
- Never expose GW2 API keys in client-side code
- Implement CORS restrictions for production
- Add rate limiting per IP/user
- Validate all user input on server-side

---

## Best Practices for API Usage

### 1. Always Handle Errors
```typescript
try {
  const response = await fetch('/api/objectives/1-1');
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  console.error('Failed to fetch objectives:', error);
  // Show user-friendly error message
}
```

### 2. Use React Query for Caching
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['objectives', matchId],
  queryFn: () => fetch(`/api/objectives/${matchId}`).then(r => r.json()),
  staleTime: 30000, // 30 seconds
  refetchInterval: 60000, // 60 seconds
});
```

### 3. Implement Optimistic Updates
```typescript
const mutation = useMutation({
  mutationFn: updateGuild,
  onMutate: async (newGuild) => {
    await queryClient.cancelQueries({ queryKey: ['guilds'] });
    const previousGuilds = queryClient.getQueryData(['guilds']);
    queryClient.setQueryData(['guilds'], (old) => [...old, newGuild]);
    return { previousGuilds };
  },
  onError: (err, newGuild, context) => {
    queryClient.setQueryData(['guilds'], context.previousGuilds);
  },
});
```

### 4. Monitor API Performance
- Track response times
- Log error rates
- Monitor cache hit ratios
- Set up alerts for downtime

---

## Changelog

**v1.0.0** (2025-01-21)
- Initial API documentation
- Documented all 19 endpoints
- Added error handling guide
- Added caching strategy

---

For questions or issues, please open a GitHub issue or contact the development team.
