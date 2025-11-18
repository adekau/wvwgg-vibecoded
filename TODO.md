# WvW Match Tracker - Planned Features

## ✅ 1. Prime Time Analysis (COMPLETED)

### Overview
Break down match performance by timezone windows to identify which teams dominate during specific coverage periods. This helps players understand when their server is strongest/weakest and plan accordingly.

### Prime Time Windows
- **NA Prime Time**: 7 PM - 12 AM ET (00:00 - 05:00 UTC)
- **EU Prime Time**: 7 PM - 12 AM CET (18:00 - 23:00 UTC)
- **OCX/SEA Coverage**: 7 PM - 12 AM AEDT (08:00 - 13:00 UTC)
- **Off Hours**: All remaining hours

### Implementation Details

#### Data Requirements
- Use existing 15-minute historical snapshots from DynamoDB
- Group snapshots by time window based on UTC timestamp
- Calculate aggregate statistics for each coverage period:
  - Total kills per team
  - Total deaths per team
  - K/D ratio per team
  - Average skirmish placement during that window
  - Victory Points earned during that window
  - Number of skirmishes in that window

#### UI Components
1. **Prime Time Performance Card**
   - Display coverage windows as tabs or accordion sections
   - Show bar charts comparing team performance across windows
   - Highlight strongest/weakest windows for each team
   - Color-code teams (red/blue/green) consistently

2. **Coverage Heatmap**
   - Visual representation of match activity by hour of day
   - Show which team is winning during each hour
   - Use color intensity to indicate dominance level

3. **Window Comparison Table**
   | Coverage Window | Red Team | Blue Team | Green Team | Winner |
   |----------------|----------|-----------|------------|---------|
   | NA Prime       | Stats    | Stats     | Stats      | Badge   |
   | EU Prime       | Stats    | Stats     | Stats      | Badge   |
   | OCX/SEA        | Stats    | Stats     | Stats      | Badge   |
   | Off Hours      | Stats    | Stats     | Stats      | Badge   |

#### Key Insights to Surface
- Which team has the best NA/EU/OCX coverage
- Percentage of total score earned during each window
- Recommended times for players to focus on
- Coverage gaps that need filling

---

## ✅ 2. Victory Point Time-Based Variation (COMPLETED)

### Background
Skirmishes provide different amounts of Victory Points (VP) based on when they occur during the match week. This system was implemented by ArenaNet to prevent servers from farming VP during off-hours when competition is minimal, as that strategy was previously swaying match outcomes unfairly.

### VP Award Tiers by Time

According to the [GW2 Wiki](https://wiki.guildwars2.com/wiki/World_versus_World):

**Current System (As of December 13, 2024):**

Victory Points now vary significantly by skirmish time slot and region to encourage participation during peak hours:

**Europe (EU):**
- **1st Place:** 15-51 VP (varies by time slot)
- **2nd Place:** 14-37 VP
- **3rd Place:** 12-24 VP
- **Peak Hours (18:00-22:00 UTC):** 51/37/24 VP (highest rewards)

**North America (NA):**
- **1st Place:** Varies by time slot (max: 43 VP)
- **2nd Place:** Varies by time slot (max: 32 VP)
- **3rd Place:** Varies by time slot (max: 21 VP)
- **Peak Morning (0:00-4:00 UTC):** 43/32/21 VP (highest rewards)
- **Afternoon (14:00-20:00 UTC):** 23/18/14 VP

**Historical System (Prior to December 13, 2024):**
- 1st Place: 5 VP (all skirmishes)
- 2nd Place: 4 VP (all skirmishes)
- 3rd Place: 3 VP (all skirmishes)

The new system was implemented to reward engagement during peak activity periods and prevent off-hours farming, which was previously swaying match outcomes unfairly.

### Implementation Considerations

#### Data Storage
- Store VP award tier for each skirmish in DynamoDB snapshots
- Create mapping of skirmish ID to VP tier
- Track actual VP earned vs. placement to calculate tier

#### Display Updates
1. **Skirmish Timeline**
   - Color-code skirmishes by VP tier (standard vs. prime vs. key)
   - Show VP potential for upcoming skirmishes
   - Highlight high-value skirmishes in the UI

2. **Skirmish Detail View**
   - Display VP awarded for each placement
   - Show theoretical max VP if 1st place was achieved
   - Calculate VP differential between current and max potential

3. **Match Statistics Enhancement**
   - Break down total VP by tier (how many from standard vs. prime)
   - Show efficiency metric (% of potential VP captured)
   - Compare teams' performance in high-VP vs. low-VP skirmishes

---

## ⚙️ 3. Victory Point Prediction & Scenario Planning Tool (Phase 1 COMPLETED)

### Overview
Interactive calculator that allows users to explore "what if" scenarios for match outcomes. Users can specify a desired final placement (e.g., Red 1st, Blue 2nd, Green 3rd) and the tool determines what placements each team needs in remaining skirmishes to achieve that goal, or if it's mathematically impossible.

### Core Functionality

#### Input Parameters
1. **Current State** (auto-populated from live data)
   - Current VP totals for each team
   - Number of skirmishes completed
   - Number of skirmishes remaining
   - VP tier for each remaining skirmish

2. **Desired Outcome** (user-selected)
   - Final placement goal for each team
   - Minimum VP margin (optional - e.g., "win by at least 50 VP")

#### Calculation Engine

```typescript
interface ScenarioInput {
  currentVP: { red: number; blue: number; green: number };
  remainingSkirmishes: Array<{
    id: number;
    vpAwards: { first: number; second: number; third: number };
  }>;
  desiredOutcome: {
    first: 'red' | 'blue' | 'green';
    second: 'red' | 'blue' | 'green';
    third: 'red' | 'blue' | 'green';
  };
}

interface ScenarioResult {
  isPossible: boolean;
  requiredPlacements?: Array<{
    skirmishId: number;
    placements: { red: 1 | 2 | 3; blue: 1 | 2 | 3; green: 1 | 2 | 3 };
  }>;
  finalVP?: { red: number; blue: number; green: number };
  margin?: number;
  reason?: string; // If impossible, explain why
}
```

#### Algorithm Approach

1. **Feasibility Check**
   - Calculate maximum possible VP for each team (if they win all remaining skirmishes)
   - Calculate minimum possible VP for each team (if they finish 3rd in all remaining skirmishes)
   - Determine if desired outcome falls within these bounds

2. **Optimal Path Finding**
   - Use constraint satisfaction or linear programming
   - Prioritize solutions that require fewer 1st place finishes
   - Find the "easiest" path to desired outcome

3. **Multiple Solutions**
   - If multiple valid paths exist, show several options
   - Rank by difficulty (fewest 1st place requirements)
   - Allow user to explore trade-offs

### UI Components

#### 1. Outcome Selector
```
Desired Final Standings:
┌─────────────┐
│ 1st Place: [Red ▼]    │
│ 2nd Place: [Blue ▼]   │
│ 3rd Place: [Green ▼]  │
└─────────────┘
[Calculate Scenarios]
```

#### 2. Results Display

**If Possible:**
```
✓ This outcome is achievable!

Path to Victory:
Remaining Skirmishes: 15

Required Placements:
┌─────────────────────────────────────────┐
│ Skirmish #70 (5/4/3 VP)                │
│ Red: 1st, Blue: 2nd, Green: 3rd        │
├─────────────────────────────────────────┤
│ Skirmish #71 (6/5/4 VP)                │
│ Red: 1st, Blue: 3rd, Green: 2nd        │
├─────────────────────────────────────────┤
│ ... (showing easiest path)              │
└─────────────────────────────────────────┘

Final Projected VP:
Red: 1,245 VP (1st)
Blue: 1,198 VP (2nd)
Green: 1,156 VP (3rd)

Margin: 47 VP between 1st and 2nd
```

**If Impossible:**
```
✗ This outcome is not achievable

Reason: Even if Red finishes 1st in all 15 remaining
skirmishes, they can only reach 1,187 VP. Blue's
current 1,200 VP already guarantees them 1st place.

Closest Possible Outcome:
Blue: 1st (guaranteed)
Red: 2nd (maximum 1,187 VP)
Green: 3rd
```

#### 3. Interactive Skirmish Table
- Allow users to manually assign placements to each remaining skirmish
- Real-time VP calculation as they make selections
- Highlight when outcome is achieved or becomes impossible
- Undo/redo functionality

#### 4. Probability Estimator (Advanced)
- Based on historical performance during similar coverage windows
- Calculate probability of each team finishing 1st/2nd/3rd in upcoming skirmishes
- Show "most likely" outcome vs. "desired" outcome
- Risk assessment: "Green needs 12 first place finishes out of 15 remaining - historically they average 4 per week"

### Implementation Phases

**Phase 1: Basic Calculator**
- Simple outcome input
- Binary possible/impossible determination
- Display one valid path if possible

**Phase 2: Multiple Solutions**
- Show 3-5 different valid paths
- Rank by difficulty
- Allow filtering (e.g., "show paths where Red never finishes 3rd")

**Phase 3: Interactive Planning**
- Manual skirmish-by-skirmish assignment
- Real-time validation
- Save/share scenarios

**Phase 4: Probability Integration**
- Historical performance analysis
- Monte Carlo simulation
- Confidence intervals

---

## 4. Snapshot Boundary Safeguards

### Problem Statement
When snapshots are taken at or near the boundaries of skirmishes or matches, data can be attributed to the wrong time period. This was a known issue in the previous wvwstats project and needs safeguards to prevent:

1. **Skirmish Boundary Issues**: A snapshot taken at exactly 00:00 of a new skirmish might contain data from the previous skirmish if the API hasn't updated yet, or might miss late-game activity from the ending skirmish.

2. **Match Boundary Issues**: Snapshots at match start/end can capture data from the wrong match entirely.

3. **API Update Lag**: The GW2 API may not update immediately when a skirmish/match transitions, causing a window where old data is still served.

### Example Scenario
```
Skirmish #42 ends at: 12:00:00 UTC
Snapshot taken at:    12:00:15 UTC (15 seconds later)
API still returns:    Skirmish #42 data

Result: This snapshot is saved as belonging to Skirmish #43,
but actually contains end-of-skirmish data from #42.
```

### Proposed Solutions

#### Solution 1: Buffer Window Exclusion
**Approach**: Don't take snapshots within a buffer window around boundaries.

```typescript
const BOUNDARY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function shouldTakeSnapshot(now: Date, matchStart: Date): boolean {
  const elapsedMs = now.getTime() - matchStart.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);

  // Each skirmish is 120 minutes (2 hours)
  const minutesIntoSkirmish = elapsedMinutes % 120;

  // Don't snapshot in first or last 5 minutes of skirmish
  if (minutesIntoSkirmish < 5 || minutesIntoSkirmish > 115) {
    return false;
  }

  return true;
}
```

**Pros:**
- Simple to implement
- Completely avoids boundary issues
- No risk of wrong attribution

**Cons:**
- Creates gaps in historical data near boundaries
- Might miss important end-of-skirmish pushes
- Less data density overall

#### Solution 2: Smart Attribution with Validation
**Approach**: Take snapshots normally but validate data before attributing to a skirmish.

```typescript
interface SnapshotMetadata {
  capturedAt: number;           // Actual timestamp when snapshot was taken
  apiSkirmishId: number;        // Skirmish ID reported by API
  calculatedSkirmishId: number; // Skirmish ID based on match start time
  matchId: string;
  isNearBoundary: boolean;      // Flag if within 5 min of boundary
}

function validateSnapshot(snapshot: any, metadata: SnapshotMetadata): boolean {
  // Check if API-reported skirmish matches calculated skirmish
  if (metadata.apiSkirmishId !== metadata.calculatedSkirmishId) {
    console.warn(`Skirmish mismatch: API=${metadata.apiSkirmishId}, Calculated=${metadata.calculatedSkirmishId}`);

    // If near boundary, this is expected - use calculated value
    if (metadata.isNearBoundary) {
      return true; // Still save, but with calculated skirmish ID
    }

    // If not near boundary, something is wrong
    return false; // Discard snapshot
  }

  return true;
}
```

**Pros:**
- Maintains data density
- Can detect and flag anomalies
- Flexible handling of edge cases

**Cons:**
- More complex implementation
- Requires careful validation logic
- Need to determine which skirmish ID to trust

#### Solution 3: Dual Attribution with Reconciliation
**Approach**: Store snapshots with both possible skirmish IDs and reconcile later.

```typescript
interface BoundarySnapshot {
  data: MatchData;
  timestamp: number;
  possibleSkirmishes: number[]; // e.g., [42, 43] if near boundary
  isPrimary: boolean;           // True if far from boundary
}

// Later, during analysis:
function getSkirmishData(skirmishId: number): HistoricalData {
  const snapshots = getAllSnapshots()
    .filter(s =>
      s.possibleSkirmishes.includes(skirmishId) &&
      (!s.isPrimary || s.possibleSkirmishes.length === 1)
    );

  // Use only primary snapshots for calculations
  return calculateStats(snapshots.filter(s => s.isPrimary));
}
```

**Pros:**
- No data loss
- Can retroactively fix attribution
- Useful for debugging

**Cons:**
- Increased storage costs
- Complex query logic
- May confuse end users

#### Solution 4: Stale Data Detection (Recommended)
**Approach**: Compare consecutive snapshots to detect when data hasn't changed (indicating stale API response).

```typescript
interface SnapshotWithValidation {
  data: MatchData;
  timestamp: number;
  skirmishId: number;
  isStale: boolean;       // True if data identical to previous snapshot
  staleDuration?: number; // How long data has been stale (ms)
}

function detectStaleData(
  currentSnapshot: MatchData,
  previousSnapshot: MatchData | null,
  timeDiff: number
): boolean {
  if (!previousSnapshot) return false;

  // Check if key metrics are identical (indicating no update)
  const isIdentical =
    currentSnapshot.red.kills === previousSnapshot.red.kills &&
    currentSnapshot.blue.kills === previousSnapshot.blue.kills &&
    currentSnapshot.green.kills === previousSnapshot.green.kills &&
    currentSnapshot.red.deaths === previousSnapshot.red.deaths &&
    currentSnapshot.blue.deaths === previousSnapshot.blue.deaths &&
    currentSnapshot.green.deaths === previousSnapshot.green.deaths;

  // If identical AND near a boundary, likely stale
  const isNearBoundary = isNearSkirmishBoundary(currentSnapshot.timestamp, currentSnapshot.start_time);

  return isIdentical && isNearBoundary;
}

function isNearSkirmishBoundary(timestamp: number, matchStart: string): boolean {
  const matchStartTime = new Date(matchStart).getTime();
  const elapsedMs = timestamp - matchStartTime;
  const minutesIntoSkirmish = (elapsedMs / (1000 * 60)) % 120;

  return minutesIntoSkirmish < 5 || minutesIntoSkirmish > 115;
}
```

**Pros:**
- Detects actual staleness rather than assuming
- Can retry snapshot after delay if stale
- Provides audit trail

**Cons:**
- Requires storing previous snapshot for comparison
- Edge case: Legitimate "no activity" periods might be flagged
- Adds complexity to snapshot logic

### Recommended Implementation Strategy

**Phase 1: Immediate (Low-Risk)**
1. Implement **Solution 4** (Stale Data Detection)
2. Add `isNearBoundary` and `isStale` flags to all snapshots
3. Log warnings for validation failures
4. Continue saving all snapshots (don't discard yet)

**Phase 2: Monitoring (2-4 weeks)**
1. Monitor logs to understand frequency of stale data
2. Identify patterns in API update lag
3. Determine if certain boundaries are more problematic
4. Collect data to inform further refinements

**Phase 3: Refinement**
1. Based on monitoring data, choose between:
   - **Option A**: Implement buffer window (Solution 1) if stale data is frequent
   - **Option B**: Implement smart attribution (Solution 2) if stale data is rare
2. Add retry logic: If stale data detected, wait 30 seconds and retry
3. Implement backfill process to fix historical misattributions

### Implementation Details

#### DynamoDB Schema Updates
```typescript
interface MatchHistorySnapshot {
  type: "match-history";
  id: string;                    // snapshot-{interval}
  timestamp: number;
  interval: number;
  data: IFormattedMatch;
  ttl: number;

  // New fields for validation
  metadata: {
    capturedAt: number;
    apiSkirmishId?: number;      // If API provides this
    calculatedSkirmishId: number;
    isNearBoundary: boolean;
    isStale: boolean;
    previousSnapshotInterval?: number; // For comparison
  };
}
```

#### Lambda Updates (`get-matches.ts`)
```typescript
// Before saving snapshot
const metadata = {
  capturedAt: now,
  calculatedSkirmishId: calculateCurrentSkirmish(now, matchData.start_time),
  isNearBoundary: isNearSkirmishBoundary(now, matchData.start_time),
  isStale: false, // Will be set by comparison logic
};

// Retrieve previous snapshot for comparison
const previousSnapshot = await getPreviousSnapshot(current15Min - 1);

if (previousSnapshot) {
  metadata.isStale = detectStaleData(
    formattedMatches,
    previousSnapshot.data,
    now - previousSnapshot.timestamp
  );
  metadata.previousSnapshotInterval = current15Min - 1;
}

// Log warning if issues detected
if (metadata.isStale) {
  console.warn(`Stale data detected at ${new Date(now).toISOString()}`);
  // Optionally: Wait 30s and retry
}

if (metadata.isNearBoundary && !metadata.isStale) {
  console.info(`Snapshot near boundary at ${new Date(now).toISOString()}, but data appears fresh`);
}

// Save with metadata
await dynamoDb.put({
  TableName: TABLE_NAME,
  Item: {
    type: "match-history",
    id: snapshotId,
    timestamp: now,
    interval: current15Min,
    data: formattedMatches,
    metadata,
    ttl: Math.floor(now / 1000) + (7 * 24 * 60 * 60)
  }
});
```

#### Frontend Handling
```typescript
// When calculating per-skirmish stats, filter out stale snapshots
function getValidSnapshotsForSkirmish(skirmishId: number): Snapshot[] {
  return historyData.filter(snapshot => {
    // Exclude snapshots flagged as stale
    if (snapshot.metadata?.isStale) {
      return false;
    }

    // Prefer snapshots not near boundaries
    if (snapshot.metadata?.isNearBoundary) {
      // Only use if no better option available
      return true; // For now, include but could be filtered
    }

    return snapshot.metadata?.calculatedSkirmishId === skirmishId;
  });
}
```

### Testing Strategy

1. **Unit Tests**
   - Test boundary detection logic with known timestamps
   - Test stale data detection with identical snapshots
   - Test skirmish ID calculation across match duration

2. **Integration Tests**
   - Mock API responses with delayed updates
   - Verify correct snapshot attribution during boundaries
   - Test retry logic when stale data is detected

3. **Manual Testing**
   - Monitor snapshots during actual skirmish transitions
   - Compare snapshot data with in-game observations
   - Verify historical calculations don't use boundary snapshots inappropriately

### Success Metrics

- Zero misattributed snapshots (data from skirmish X saved as skirmish Y)
- <5% of snapshots flagged as stale during normal operation
- Historical per-skirmish calculations accurate within ±2% of actual values
- No data gaps longer than 30 minutes in any skirmish period

---

## ✅ 5. Points Per Tick (PPT) Analysis & Projection (COMPLETED)

### Overview
Calculate real-time Points Per Tick (PPT) for each team based on objectives held and their upgrade tiers. Use this to show how many "ticks behind" trailing teams are and project future score trajectories if current objective holdings remain unchanged.

### Background - How PPT Works

According to the [GW2 Wiki](https://wiki.guildwars2.com/wiki/World_versus_World):

A "tick" occurs every 5 minutes and awards points based on:
1. **Which objectives you hold** (camps, towers, keeps, castles)
2. **The tier/upgrade level** of those objectives

#### Base PPT Values by Objective Type

**Camps:**
- Tier 0 (Base): 2 PPT
- Tier 1 (Fortified): 3 PPT
- Tier 2 (Reinforced): 4 PPT
- Tier 3 (Secured): 5 PPT

**Towers:**
- Tier 0 (Base): 4 PPT
- Tier 1 (Fortified): 6 PPT
- Tier 2 (Reinforced): 8 PPT
- Tier 3 (Secured): 10 PPT

**Keeps:**
- Tier 0 (Base): 8 PPT
- Tier 1 (Fortified): 12 PPT
- Tier 2 (Reinforced): 16 PPT
- Tier 3 (Secured): 20 PPT

**Stonemist Castle:**
- Tier 0 (Base): 12 PPT
- Tier 1 (Fortified): 18 PPT
- Tier 2 (Reinforced): 24 PPT
- Tier 3 (Secured): 30 PPT

#### Upgrade Timing
- **Tier 1**: Achieved after 30 minutes of continuous holding
- **Tier 2**: Achieved after 90 minutes (1.5 hours) of continuous holding
- **Tier 3**: Achieved after 180 minutes (3 hours) of continuous holding

**Note**: Upgrades reset if the objective is captured by another team.

### Core Features

#### 1. Real-Time PPT Calculator

Calculate current PPT for each team based on:
- Number of objectives held (from objectives API)
- Estimated tier of each objective (based on how long it's been held)

**Challenge**: The GW2 API does not directly provide objective tier information or hold duration. We'll need to infer this from historical snapshots.

**Approach**:
```typescript
interface ObjectiveState {
  type: 'camp' | 'tower' | 'keep' | 'castle';
  owner: 'red' | 'blue' | 'green';
  capturedAt: number; // Timestamp when captured (inferred from snapshots)
  currentTier: 0 | 1 | 2 | 3; // Calculated based on hold duration
  ppt: number; // Current PPT value
}

function calculateObjectiveTier(capturedAt: number, now: number): 0 | 1 | 2 | 3 {
  const holdDuration = (now - capturedAt) / (1000 * 60); // Minutes

  if (holdDuration >= 180) return 3; // Secured
  if (holdDuration >= 90) return 2;  // Reinforced
  if (holdDuration >= 30) return 1;  // Fortified
  return 0; // Base
}

function getPPTForObjective(type: string, tier: number): number {
  const pptTable = {
    camp: [2, 3, 4, 5],
    tower: [4, 6, 8, 10],
    keep: [8, 12, 16, 20],
    castle: [12, 18, 24, 30],
  };

  return pptTable[type]?.[tier] || 0;
}

function calculateTeamPPT(objectives: ObjectiveState[]): number {
  return objectives.reduce((total, obj) => total + obj.ppt, 0);
}
```

#### 2. Ticks Behind Calculation

Show how many ticks behind a trailing team is based on current PPT differential.

**Formula**:
```
Ticks Behind = Score Deficit / PPT Differential
```

**Example**:
- Red Team: 15,000 points, 200 PPT
- Blue Team: 14,500 points, 180 PPT
- Blue's score deficit: 500 points
- PPT differential: 200 - 180 = 20 PPT (Red gaining 20 more per tick)
- Ticks behind: 500 / 20 = 25 ticks = 125 minutes

**Special Cases**:
- If trailing team has **higher PPT**: Show "catching up" with estimated time to overtake
- If trailing team has **equal PPT**: Show "maintaining gap" (will never catch up)
- If trailing team has **lower PPT**: Show "falling further behind" with rate

#### 3. UI Display

**Current Implementation** (what we have):
```
Red: 15,000 (+0)
Blue: 14,500 (-500)
Green: 14,200 (-800)
```

**Enhanced Display** (what we'll add):
```
Red: 15,000 (+0) | 200 PPT
Blue: 14,500 (-500, 25 ticks behind) | 180 PPT ↓
Green: 14,200 (-800, 53 ticks behind) | 150 PPT ↓
```

**Alternative Visual**:
```
┌─────────────────────────────────────────────────┐
│ Red Team: 15,000                                │
│ 200 PPT | +0                                    │
├─────────────────────────────────────────────────┤
│ Blue Team: 14,500                               │
│ 180 PPT ↓ | -500 pts (25 ticks / 2h 5m behind) │
├─────────────────────────────────────────────────┤
│ Green Team: 14,200                              │
│ 150 PPT ↓ | -800 pts (53 ticks / 4h 25m behind)│
└─────────────────────────────────────────────────┘
```

#### 4. PPT Projection Chart

Show projected future scores if current PPT rates continue unchanged.

**Chart Features**:
- X-axis: Time (next 6-24 hours)
- Y-axis: Projected score
- Three lines (red, blue, green) with different slopes based on PPT
- Markers showing projected score at next skirmish end
- Highlight potential overtakes/crossovers

**Implementation**:
```typescript
function projectFutureScore(
  currentScore: number,
  currentPPT: number,
  minutesAhead: number
): number {
  const ticksAhead = minutesAhead / 5;
  return currentScore + (currentPPT * ticksAhead);
}

// Example: Project 12 hours ahead
const projections = {
  red: projectFutureScore(15000, 200, 12 * 60), // 15000 + (200 * 144) = 43,800
  blue: projectFutureScore(14500, 180, 12 * 60), // 14500 + (180 * 144) = 40,420
  green: projectFutureScore(14200, 150, 12 * 60), // 14200 + (150 * 144) = 35,800
};
```

### Implementation Challenges

#### Challenge 1: Inferring Objective Hold Duration

**Problem**: API doesn't tell us when an objective was captured or its tier.

**Solution Options**:

**Option A: Snapshot Diffing (Recommended)**
- Compare consecutive 15-minute snapshots
- When objective ownership changes, record capture timestamp
- Track hold duration from that point forward

```typescript
interface ObjectiveTracking {
  id: string;
  type: 'camp' | 'tower' | 'keep' | 'castle';
  currentOwner: 'red' | 'blue' | 'green';
  capturedAt: number;
  previousOwner?: 'red' | 'blue' | 'green';
}

// In Lambda, compare current to previous snapshot
function trackObjectiveChanges(
  currentObjectives: ObjectivesData,
  previousObjectives: ObjectivesData,
  timestamp: number
): ObjectiveTracking[] {
  const tracking: ObjectiveTracking[] = [];

  // For each objective type (keeps, towers, camps, castles)
  // Compare counts and infer captures
  // Note: This is imperfect since we don't have individual objective IDs

  return tracking;
}
```

**Option B: Detailed Objectives API**
- Use `/v2/wvw/matches/overview/:id` endpoint
- Provides individual objective IDs and owners
- No tier information, but we can track ownership changes

```typescript
// Fetch from https://api.guildwars2.com/v2/wvw/objectives
// Get objective details including name, type, and current owner
interface DetailedObjective {
  id: string;
  name: string;
  type: 'Camp' | 'Tower' | 'Keep' | 'Castle';
  map_type: 'Center' | 'RedHome' | 'BlueHome' | 'GreenHome';
  owner: 'Red' | 'Blue' | 'Green' | 'Neutral';
}

// Store in DynamoDB with capture timestamps
interface ObjectiveHistory {
  objectiveId: string;
  matchId: string;
  owner: 'red' | 'blue' | 'green';
  capturedAt: number;
  lostAt?: number;
}
```

**Option C: Assume Base Tier (Simple)**
- Always calculate PPT assuming Tier 0 (base objectives)
- Less accurate but requires no additional tracking
- Good for MVP, can enhance later

#### Challenge 2: Handling Objective Count Ambiguity

**Problem**: We only know total counts (e.g., "Red has 4 keeps"), not which specific keeps or their tiers.

**Solution**:
- Use average tier based on typical hold duration patterns
- Weight by map activity (Eternal Battleground vs Borderlands)
- Provide PPT range instead of exact value (min/max based on tier assumptions)

```typescript
function calculatePPTRange(
  objectiveCounts: { keeps: number; towers: number; camps: number; castles: number },
  averageHoldDuration: number
): { min: number; max: number; estimated: number } {
  const estimatedTier = calculateObjectiveTier(
    Date.now() - averageHoldDuration,
    Date.now()
  );

  // Calculate min (all tier 0), max (all at estimated tier), and estimated
  const min = (
    objectiveCounts.camps * 2 +
    objectiveCounts.towers * 4 +
    objectiveCounts.keeps * 8 +
    objectiveCounts.castles * 12
  );

  const estimated = (
    objectiveCounts.camps * getPPTForObjective('camp', estimatedTier) +
    objectiveCounts.towers * getPPTForObjective('tower', estimatedTier) +
    objectiveCounts.keeps * getPPTForObjective('keep', estimatedTier) +
    objectiveCounts.castles * getPPTForObjective('castle', estimatedTier)
  );

  const max = (
    objectiveCounts.camps * 5 +
    objectiveCounts.towers * 10 +
    objectiveCounts.keeps * 20 +
    objectiveCounts.castles * 30
  );

  return { min, max, estimated };
}
```

### Implementation Phases

**Phase 1: Basic PPT Display (MVP)**
- Calculate PPT assuming all objectives are Tier 0
- Display current PPT next to scores
- Show PPT differential (arrows up/down)

**Phase 2: Ticks Behind Calculation**
- Add "X ticks behind" display next to score deficit
- Convert ticks to time (hours:minutes)
- Handle edge cases (catching up, equal PPT, falling behind)

**Phase 3: Objective Tracking**
- Integrate `/v2/wvw/objectives` API
- Track individual objective captures in DynamoDB
- Calculate actual tier based on hold duration

**Phase 4: Advanced Projections**
- Add PPT projection chart
- Show score trajectory over time
- Highlight projected skirmish outcomes
- Add "what if" scenarios (e.g., "if Red captures SM, PPT becomes...")

### Data Requirements

#### New DynamoDB Items

**Objective Tracking Table**:
```typescript
{
  type: "objective-state",
  matchId: "1-5",
  objectiveId: "38-94", // Map-ObjectiveID
  timestamp: 1234567890,
  owner: "red",
  capturedAt: 1234567890,
  estimatedTier: 1,
  ttl: 1234567890 // 7 days
}
```

#### Lambda Updates

Add to `get-matches.ts`:
1. Fetch objectives from `/v2/wvw/matches/overview/:id`
2. Compare with previous snapshot to detect captures
3. Store objective state changes in DynamoDB
4. Calculate PPT based on tracked objectives

### UI Components

#### 1. PPT Badge (inline with scores)
```tsx
<div className="flex items-center gap-2">
  <span className="text-2xl font-bold">{team.score.toLocaleString()}</span>
  <Badge variant="outline" className="font-mono text-xs">
    {teamPPT} PPT {pptTrend === 'up' ? '↑' : pptTrend === 'down' ? '↓' : ''}
  </Badge>
</div>
```

#### 2. Ticks Behind Display
```tsx
{scoreDeficit > 0 && (
  <div className="text-sm text-muted-foreground">
    -{scoreDeficit.toLocaleString()} ({ticksBehind} ticks / {timeString} behind)
  </div>
)}
```

#### 3. PPT Breakdown Card (detailed view)
```tsx
<Card>
  <CardHeader>
    <h3>Points Per Tick Breakdown</h3>
  </CardHeader>
  <CardContent>
    <table>
      <thead>
        <tr>
          <th>Objective Type</th>
          <th>Red</th>
          <th>Blue</th>
          <th>Green</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Camps (2-5 PPT)</td>
          <td>{redCamps} → {redCampsPPT} PPT</td>
          <td>{blueCamps} → {blueCampsPPT} PPT</td>
          <td>{greenCamps} → {greenCampsPPT} PPT</td>
        </tr>
        {/* Similar rows for towers, keeps, castles */}
        <tr className="font-bold">
          <td>Total PPT</td>
          <td>{redTotalPPT}</td>
          <td>{blueTotalPPT}</td>
          <td>{greenTotalPPT}</td>
        </tr>
      </tbody>
    </table>
  </CardContent>
</Card>
```

#### 4. Score Projection Chart
```tsx
<Card>
  <CardHeader>
    <h3>Score Projection (Next 12 Hours)</h3>
    <p className="text-sm text-muted-foreground">
      Assuming current PPT rates remain unchanged
    </p>
  </CardHeader>
  <CardContent>
    <LineChart
      data={projectionData}
      lines={[
        { key: 'red', color: 'hsl(var(--chart-1))' },
        { key: 'blue', color: 'hsl(var(--chart-2))' },
        { key: 'green', color: 'hsl(var(--chart-3))' },
      ]}
      xAxis="time"
      yAxis="projectedScore"
    />
  </CardContent>
</Card>
```

### Example Output

**Scenario**: Mid-match state
```
Current Scores:
┌────────────────────────────────────────────────┐
│ Red (Yaks Bend): 15,000                        │
│ 200 PPT | In the lead                          │
├────────────────────────────────────────────────┤
│ Blue (Maguuma): 14,500                         │
│ 180 PPT ↓ | -500 (-25 ticks / -2h 5m)         │
│ Catching up in: Never (PPT too low)            │
├────────────────────────────────────────────────┤
│ Green (Fort Aspenwood): 14,200                 │
│ 220 PPT ↑ | -800 (-4 ticks / -20m)            │
│ Overtakes Red in: ~32 ticks (~2h 40m)          │
└────────────────────────────────────────────────┘

Projection:
- In 12 hours at current rates:
  Red: 43,800 (if PPT holds at 200)
  Blue: 40,420 (if PPT holds at 180)
  Green: 45,800 (if PPT holds at 220) ← Projected 1st
```

---

## 6. Match Quick Navigation Dropdown

### Overview
Add a dropdown selector at the top of the match dashboard that displays the current match ID (e.g., "1-1") and allows users to quickly switch between different matches without returning to the matches list page.

### Current Behavior
- User is viewing match "1-1"
- To view a different match (e.g., "2-3"), user must:
  1. Click back/navigate to `/matches`
  2. Find and click the desired match
  3. Wait for page load

### Proposed Behavior
- User is viewing match "1-1"
- Dropdown at top shows "1-1" with all available matches
- User clicks dropdown and selects "2-3"
- Page navigates to `/matches/2-3` instantly

### UI Design

#### Location
Place the dropdown in the match dashboard header, near the match tier/region display.

**Current Header** (approximately):
```
┌─────────────────────────────────────────────┐
│ Match 1-1 - North America                  │
│ Skirmish #42 | 1h 23m 15s remaining        │
└─────────────────────────────────────────────┘
```

**Enhanced Header**:
```
┌─────────────────────────────────────────────┐
│ Match [1-1 ▼] - North America              │
│ Skirmish #42 | 1h 23m 15s remaining        │
└─────────────────────────────────────────────┘
```

#### Dropdown Options

Group matches by region for better organization:

```
Match Selector:
┌──────────────────────────┐
│ NORTH AMERICA            │
├──────────────────────────┤
│ ✓ 1-1 (Tier 1)          │ ← Currently selected
│   1-2 (Tier 2)          │
│   1-3 (Tier 3)          │
│   1-4 (Tier 4)          │
│   1-5 (Tier 5)          │
├──────────────────────────┤
│ EUROPE                   │
├──────────────────────────┤
│   2-1 (Tier 1)          │
│   2-2 (Tier 2)          │
│   2-3 (Tier 3)          │
│   2-4 (Tier 4)          │
│   2-5 (Tier 5)          │
└──────────────────────────┘
```

**Alternative**: Show world names instead of tier numbers for more context:

```
Match Selector:
┌────────────────────────────────────┐
│ NORTH AMERICA                      │
├────────────────────────────────────┤
│ ✓ 1-1: YB vs MAG vs FA            │ ← Currently selected
│   1-2: BG vs SoS vs TC            │
│   1-3: ...                         │
└────────────────────────────────────┘
```

### Implementation Details

#### Component Structure

```tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MatchSelectorProps {
  currentMatchId: string;
  matches: Array<{
    id: string;
    tier: string;
    region: string;
    worlds: {
      red: string;
      blue: string;
      green: string;
    };
  }>;
}

export function MatchSelector({ currentMatchId, matches }: MatchSelectorProps) {
  const router = useRouter();

  // Group matches by region
  const matchesByRegion = matches.reduce((acc, match) => {
    if (!acc[match.region]) {
      acc[match.region] = [];
    }
    acc[match.region].push(match);
    return acc;
  }, {} as Record<string, typeof matches>);

  const handleMatchChange = (matchId: string) => {
    router.push(`/matches/${matchId}`);
  };

  return (
    <Select value={currentMatchId} onValueChange={handleMatchChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select match" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(matchesByRegion).map(([region, regionMatches]) => (
          <SelectGroup key={region}>
            <SelectLabel>{region}</SelectLabel>
            {regionMatches.map((match) => (
              <SelectItem key={match.id} value={match.id}>
                {match.id} - Tier {match.tier}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### Integration in Match Dashboard

Update `/app/matches/[matchId]/page.tsx`:

```typescript
export default async function MatchDetailPage({ params }: PageProps) {
  const { matchId } = await params;

  // Fetch all matches for the selector
  const [matchesData, worldsData] = await Promise.all([
    getMatches(),
    getWorlds(),
  ]);

  if (!matchesData || !worldsData) {
    notFound();
  }

  // Format matches for selector
  const allMatches = Object.entries(matchesData).map(([id, data]: [string, any]) => {
    const [regionCode] = id.split('-');
    return {
      id,
      tier: id.split('-')[1],
      region: regionCode === '1' ? 'North America' : 'Europe',
      worlds: {
        red: data.red?.world?.name || 'Unknown',
        blue: data.blue?.world?.name || 'Unknown',
        green: data.green?.world?.name || 'Unknown',
      },
    };
  });

  // ... existing match data setup

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Add match selector */}
        <div className="flex items-center justify-between">
          <MatchSelector currentMatchId={matchId} matches={allMatches} />
          {/* Could add other header controls here */}
        </div>

        <MatchDashboard match={match} matchId={matchId} />
        <MatchHistoryChart matchId={matchId} />
      </main>
    </div>
  );
}
```

### Enhanced Features (Optional)

#### 1. Show Match Status in Dropdown
Indicate which matches are currently active vs upcoming:

```tsx
<SelectItem key={match.id} value={match.id}>
  <div className="flex items-center gap-2">
    <span>{match.id} - Tier {match.tier}</span>
    {match.status === 'active' && (
      <Badge variant="success" className="text-xs">Live</Badge>
    )}
    {match.status === 'upcoming' && (
      <Badge variant="secondary" className="text-xs">Soon</Badge>
    )}
  </div>
</SelectItem>
```

#### 2. Keyboard Navigation
Add keyboard shortcuts for quick match switching:
- `Alt + ←`: Previous match (1-1 → 1-0 or previous tier)
- `Alt + →`: Next match (1-1 → 1-2)
- `Alt + 1-9`: Jump to specific tier

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.altKey) {
      if (e.key === 'ArrowLeft') {
        // Navigate to previous match
        const currentIndex = matches.findIndex(m => m.id === currentMatchId);
        if (currentIndex > 0) {
          router.push(`/matches/${matches[currentIndex - 1].id}`);
        }
      } else if (e.key === 'ArrowRight') {
        // Navigate to next match
        const currentIndex = matches.findIndex(m => m.id === currentMatchId);
        if (currentIndex < matches.length - 1) {
          router.push(`/matches/${matches[currentIndex + 1].id}`);
        }
      }
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [currentMatchId, matches, router]);
```

#### 3. Quick Stats Preview on Hover
Show mini preview of match standings when hovering over dropdown options:

```tsx
<SelectItem key={match.id} value={match.id}>
  <div className="flex items-center justify-between w-full">
    <span>{match.id} - Tier {match.tier}</span>
    <div className="flex gap-1 text-xs ml-2">
      <span className="text-chart-1">{match.scores.red}</span>
      <span className="text-chart-2">{match.scores.blue}</span>
      <span className="text-chart-3">{match.scores.green}</span>
    </div>
  </div>
</SelectItem>
```

#### 4. Favorite/Pin Matches
Allow users to pin specific matches to the top of the dropdown:

```typescript
// Store in localStorage
const [pinnedMatches, setPinnedMatches] = useState<string[]>([]);

const togglePin = (matchId: string) => {
  const newPinned = pinnedMatches.includes(matchId)
    ? pinnedMatches.filter(id => id !== matchId)
    : [...pinnedMatches, matchId];

  setPinnedMatches(newPinned);
  localStorage.setItem('pinnedMatches', JSON.stringify(newPinned));
};
```

### Mobile Considerations

On mobile devices, the dropdown should:
- Take full width on small screens
- Use native select UI for better mobile UX
- Provide clear touch targets (minimum 44px)

```tsx
<Select value={currentMatchId} onValueChange={handleMatchChange}>
  <SelectTrigger className="w-full md:w-[180px]">
    <SelectValue placeholder="Select match" />
  </SelectTrigger>
  {/* ... */}
</Select>
```

### Testing Checklist

- [ ] Dropdown displays current match correctly
- [ ] All available matches appear in dropdown
- [ ] Matches grouped by region correctly
- [ ] Clicking a match navigates to correct URL
- [ ] Navigation preserves scroll position
- [ ] Dropdown closes after selection
- [ ] Keyboard navigation works (optional)
- [ ] Mobile layout responsive
- [ ] Works with browser back/forward buttons

### Performance Considerations

- **Data Fetching**: Matches list should be cached at page level (already fetched for current match)
- **Client-Side Routing**: Use Next.js router for instant navigation without full page reload
- **Prefetching**: Consider prefetching adjacent match data on hover for instant load times

```typescript
// Prefetch on hover
const handleMouseEnter = (matchId: string) => {
  router.prefetch(`/matches/${matchId}`);
};
```

---

## Technical Notes

### Data Sources
- All features rely on existing 15-minute DynamoDB snapshots
- No new API calls needed for historical analysis
- May need to scrape or manually input VP tier data per skirmish

### Performance Considerations
- Prime Time Analysis: Pre-calculate window aggregations server-side
- Scenario Tool: Run calculations client-side for instant feedback
- Cache VP tier mapping (doesn't change week-to-week)

### Future Enhancements
- Mobile-optimized views for all features
- Push notifications for high-value skirmishes
- Team comparison across multiple matches
- Historical trend analysis (performance over multiple weeks)


---

## 7. Guilds Page & Admin Panel

### Overview
Create a public guilds listing page with search and filtering capabilities, plus an invite-only admin panel for managing guild metadata and relationships.

### Public Guilds Page Features

#### Search & Filtering
- **Search by guild name** (fuzzy search)
- **Filter by world/server**
- **Filter by guild type** (Alliance Guild, Member Guild, Independent)
- **Sort options**:
  - Alphabetically
  - By member count (if available)
  - By activity level
  - Recently added/updated

#### Guild Display Card
```
┌─────────────────────────────────────────┐
│ [Guild Tag] Guild Name                  │
├─────────────────────────────────────────┤
│ World: Yak's Bend                       │
│ Type: Alliance Guild                    │
│ Member Guilds: 3                        │
│ Last Seen: 2 hours ago                  │
└─────────────────────────────────────────┘
```

#### Guild Detail View
- Full guild information
- List of linked guilds (if Alliance Guild)
- Parent alliance (if Member Guild)
- Historical activity data
- Link to GW2 official guild page (if available)

### Admin Panel Features

#### Authentication Requirements
- **Invite-only access** - No public signup
- All invited users have full admin access
- Users invited directly through AWS Cognito console

#### Guild Management Interface
- **Bulk guild review queue**: List of guilds needing classification
- **Quick-edit interface** for each guild:
  ```
  Guild: [Best Damn Guild] [BD]
  World: [Yak's Bend ▼]

  Classification:
  [ ] Alliance Guild
  [ ] Member Guild
  [ ] Independent Guild

  If Member Guild, link to Alliance:
  [Select Alliance Guild ▼]

  If Alliance Guild, linked member guilds:
  [+ Add Member Guild]
  - [Guild 1] [Remove]
  - [Guild 2] [Remove]

  Notes: [Optional notes about this guild]

  [Save Changes] [Mark as Reviewed]
  ```

- **Audit log**: Track who made what changes when
- **Bulk operations**:
  - Mark multiple guilds as reviewed
  - Bulk world assignment
  - Bulk delete/archive

#### Admin Dashboard
- **Stats Overview**:
  - Total guilds tracked
  - Guilds needing review
  - Alliance guilds count
  - Member guilds count
  - Last sync time
- **Recent Activity**: Recent admin actions

### Authentication Implementation Options

#### Option 1: AWS Cognito (Recommended)
**Pros:**
- Already in AWS ecosystem (CDK, DynamoDB, Lambda)
- Native integration with Next.js middleware
- Built-in invite-only features via AdminCreateUser API
- Can disable self-signup completely
- Supports user groups for role-based access
- Cost-effective for small user base (free tier: 50,000 MAUs)
- MFA support out of the box
- Managed service (no maintenance)

**Cons:**
- AWS-specific (vendor lock-in)
- UI is dated (but you're building custom UI anyway)
- Some complexity in setup

**Implementation:**
```typescript
// CDK setup
import * as cognito from 'aws-cdk-lib/aws-cognito';

const userPool = new cognito.UserPool(this, 'GuildsAdminUserPool', {
  userPoolName: 'wvwgg-guilds-admins',
  selfSignUpEnabled: false, // Disable public signup
  signInAliases: {
    email: true,
  },
  autoVerify: {
    email: true,
  },
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
  mfa: cognito.Mfa.OPTIONAL,
  mfaSecondFactor: {
    sms: false,
    otp: true,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
});

// App client for Next.js
const userPoolClient = userPool.addClient('WebClient', {
  authFlows: {
    userPassword: true,
    userSrp: true,
  },
  generateSecret: false,
  preventUserExistenceErrors: true,
});

// Output the User Pool ID for environment variables
new cdk.CfnOutput(this, 'UserPoolId', {
  value: userPool.userPoolId,
});

new cdk.CfnOutput(this, 'UserPoolClientId', {
  value: userPoolClient.userPoolClientId,
});
```

```typescript
// Next.js middleware for auth
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');

  if (!token && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
```

#### Option 2: Clerk
**Pros:**
- Modern, excellent developer experience
- Beautiful pre-built UI components
- Easy invite-only setup
- Built-in user management dashboard
- Great Next.js integration
- Webhooks for user events

**Cons:**
- Third-party service (additional vendor)
- Costs money after free tier (10,000 MAUs free, then $25/month)
- Overkill for simple use case
- Another service to manage

#### Option 3: Auth.js (NextAuth.js)
**Pros:**
- Free and open source
- Popular with Next.js community
- Flexible, can use any database
- Can implement custom invite logic
- Own your data completely

**Cons:**
- More setup and maintenance required
- Need to implement invite system yourself
- Need to manage sessions, tokens, etc.
- Security is your responsibility

#### Option 4: Simple Token-Based (Not Recommended)
**Pros:**
- Very simple
- No external dependencies
- Full control

**Cons:**
- Not secure enough for production
- No MFA, no password reset, etc.
- Need to build everything yourself
- Not scalable

### Recommended Implementation: AWS Cognito

**Setup Steps:**

1. **CDK Infrastructure** (`cdk/lib/constructs/auth.ts`)
   - Create Cognito User Pool with self-signup disabled
   - Create app client for Next.js
   - Output User Pool ID and Client ID as environment variables

2. **Invite Users**
   - Go to AWS Cognito console
   - Select your user pool
   - Click "Create user"
   - Enter email, send temporary password via email
   - User will be prompted to change password on first login

3. **Next.js Auth Setup**
   - Install `aws-amplify` or use `@aws-sdk/client-cognito-identity-provider`
   - Create auth context provider
   - Implement login/logout components
   - Protect admin routes with middleware

4. **DynamoDB Schema for Guild Data**
   ```typescript
   interface Guild {
     type: 'guild';
     id: string; // guild-{guildId}
     name: string;
     tag: string;
     worldId: number;
     worldName: string;

     // Admin-managed fields
     classification?: 'alliance' | 'member' | 'independent';
     allianceGuildId?: string; // If member guild, link to alliance
     memberGuildIds?: string[]; // If alliance guild, list of members
     isReviewed: boolean;
     reviewedBy?: string; // Admin email
     reviewedAt?: number;
     notes?: string;

     // Auto-tracked fields
     lastSeenAt: number;
     firstSeenAt: number;
     activityCount: number;

     createdAt: number;
     updatedAt: number;
   }

   interface AdminAuditLog {
     type: 'admin-audit';
     id: string; // audit-{timestamp}
     adminEmail: string;
     action: 'edit_guild' | 'link_guilds' | 'bulk_update';
     targetId?: string; // Guild ID
     changes?: Record<string, any>;
     timestamp: number;
   }
   ```

5. **Admin UI Pages**
   - `/admin/login` - Cognito-hosted UI or custom login
   - `/admin/dashboard` - Overview stats
   - `/admin/guilds` - Guild management interface
   - `/admin/guilds/[id]` - Individual guild editor
   - `/admin/audit` - Audit log viewer

### Implementation Phases

**Phase 1: Public Guilds Page**
- Basic guild listing with search
- Simple filtering by world
- Guild detail pages
- Mobile-responsive design

**Phase 2: Auth Infrastructure**
- Set up Cognito in CDK
- Implement login/logout flow
- Create protected admin routes
- Invite initial users via AWS console

**Phase 3: Admin Panel Core**
- Dashboard with stats
- Guild review queue
- Basic edit interface
- Audit logging

**Phase 4: Advanced Features**
- Bulk operations
- Alliance/member guild linking
- Advanced search and filters
- Export functionality

---

## 8. Historical Match Archive & Comparison

### Overview
Browse and analyze past matches beyond the current week. Compare performance across weeks to identify trends and patterns.

### Features
- **Match History Browser**: Paginated list of all historical matches
- **Week-over-Week Comparison**: Compare current match to same tier from previous weeks
- **Performance Trends**:
  - "Red has won 8 of the last 10 matches in Tier 1"
  - Average victory margin by tier
  - Longest winning streaks
- **Server Historical Performance**: Track individual server performance over time
- **Search & Filter**: Find specific matches by date, tier, server, or outcome

### Technical Considerations
- Requires longer DynamoDB TTL or separate archive table
- May need data compression for cost efficiency
- Consider S3 for long-term storage with DynamoDB index

---

## 9. Score Velocity & Momentum Analysis

### Overview
Track the rate of scoring change over time to detect momentum shifts and scoring trends.

### Features
- **Score Velocity Calculation**: Points per hour trending for each team
- **Momentum Detection**: Identify when teams accelerate/decelerate scoring
- **Visual Indicators**:
  - 🔥 "Heating up" - scoring rate increasing
  - ❄️ "Going cold" - scoring rate decreasing
  - ➡️ "Steady" - consistent scoring rate
- **Momentum Shift Timeline**: Mark significant momentum changes on match timeline
- **Alerts**: Notify when momentum shifts significantly

### Implementation
```typescript
interface VelocitySnapshot {
  timestamp: number;
  red: { score: number; velocity: number; acceleration: number };
  blue: { score: number; velocity: number; acceleration: number };
  green: { score: number; velocity: number; acceleration: number };
}

function calculateVelocity(
  currentScore: number,
  previousScore: number,
  timeDelta: number // in minutes
): number {
  return ((currentScore - previousScore) / timeDelta) * 60; // points per hour
}

function detectMomentumShift(
  currentVelocity: number,
  previousVelocity: number
): 'heating' | 'cooling' | 'steady' {
  const change = ((currentVelocity - previousVelocity) / previousVelocity) * 100;
  if (change > 20) return 'heating';
  if (change < -20) return 'cooling';
  return 'steady';
}
```

---

## 10. Critical Moments Detection

### Overview
Automatically identify and highlight significant events and turning points in matches.

### Detected Events
- **Lead Changes**: When a team takes or loses the lead
- **Comebacks**: Overcoming significant score deficits
- **Blowouts**: When score differential reaches certain thresholds
- **Close Finishes**: Matches decided by <500 VP
- **Perfect Skirmishes**: Team wins every skirmish in a match
- **Skirmish Streaks**: Consecutive skirmish wins/losses

### UI Features
- **Match Timeline with Events**: Visual timeline showing critical moments
- **Event Notifications**: Real-time alerts for significant events
- **Event Summary**: "Match Highlights" section on match page
- **Historical Event Search**: Find all comebacks, blowouts, etc.

### Example Output
```
Critical Moments - Match 1-1 (Week of Jan 6, 2025)

⚡ Skirmish #23 (Day 2, 14:23 UTC)
   GREEN TAKES THE LEAD
   Green: 12,450 → Blue: 12,389 → Red: 12,201

⚡ Skirmish #45 (Day 4, 06:00 UTC)
   BLUE COMEBACK
   Blue overcame 2,300 point deficit from Skirmish #30

⚡ Skirmish #67 (Day 6, 18:00 UTC)
   RED HOT STREAK
   Red has won 12 consecutive skirmishes
```

---

## 11. Skirmish Streak Tracking

### Overview
Track and display winning/losing streaks for each team, with statistical analysis.

### Features
- **Current Streak Display**: "Blue: 7-game winning streak 🔥"
- **Longest Streaks**: All-time records per server/tier
- **Streak Probability**: "Based on historical data, Red has 65% chance to extend streak"
- **Streak Breaker Alerts**: Notify when long streaks end
- **Psychological Insights**: "Teams with 10+ skirmish streaks win the match 89% of the time"

### Data Points
- Current streak (wins/losses)
- Longest streak this match
- Longest streak all-time (by server)
- Streak start time
- Streak momentum (scoring margin during streak)

---

## 12. Social Features & Sharing

### Discord Bot Integration

#### Bot Commands
- `/match [id]` - Get current match status
- `/subscribe [match-id]` - Subscribe to match updates
- `/standings` - Show current standings for all tiers
- `/alerts [match-id] [conditions]` - Set custom alerts

#### Auto-Posted Updates
- Skirmish end results
- Lead changes
- Critical moments
- Match end summary

### Shareable Match Cards

Generate beautiful graphics for social media:
- **Current Standings Card**: Clean visualization of scores and rankings
- **Prime Time Breakdown**: Visual showing performance by coverage window
- **PPT Analysis Card**: Current PPT with projections
- **Match Result Summary**: Final standings with key stats

### Embed Widgets

```html
<iframe src="https://wvwgg.com/embed/match/1-1" width="400" height="300"></iframe>
```

Embeddable widgets for guild websites:
- Live score widget
- Mini match dashboard
- Upcoming skirmish timer

---

## 13. Notifications & Alerts

### Alert Types

#### Match Alerts
- Match gets close (score differential < threshold)
- Your server takes/loses the lead
- Comeback in progress
- Blowout detected
- Match ends

#### Skirmish Alerts
- High-value skirmish starting soon
- Skirmish end (5 minutes warning)
- Perfect skirmish opportunity
- Streak milestones

#### Strategic Alerts
- Comeback probability crosses threshold
- Optimal time to play (based on prime time analysis)
- Tier movement implications

### Delivery Methods
- **Email**: Daily/weekly digests
- **Push Notifications**: Real-time via PWA
- **Discord Webhook**: Post to Discord channels
- **SMS**: Critical alerts only (optional, costs money)
- **In-App**: Browser notifications

### User Preferences
```typescript
interface AlertPreferences {
  userId: string;
  subscribedMatches: string[]; // Match IDs
  subscribedServers: number[]; // World IDs

  alertTypes: {
    matchClose: { enabled: boolean; threshold: number };
    leadChange: { enabled: boolean };
    skirmishEnd: { enabled: boolean; minutesWarning: number };
    comeback: { enabled: boolean };
    highValueSkirmish: { enabled: boolean };
  };

  deliveryMethods: {
    email: boolean;
    push: boolean;
    discord: { enabled: boolean; webhookUrl?: string };
  };

  quietHours: {
    enabled: boolean;
    startHour: number; // 0-23
    endHour: number;
    timezone: string;
  };
}
```

---

## 14. Tier Movement & Rankings

### Glicko Rating System

Implement chess-style ratings for servers:
- Track server strength over time
- Account for opponent strength
- Confidence intervals (rating deviation)
- Decay over time for inactive servers

```typescript
interface ServerRating {
  worldId: number;
  rating: number; // Glicko rating
  ratingDeviation: number; // Confidence
  volatility: number;
  lastUpdated: number;
  matchHistory: Array<{
    matchId: string;
    opponent: number;
    result: 'win' | 'loss' | 'draw';
    ratingChange: number;
  }>;
}
```

### Tier Movement Predictions

Based on current match standings:
- "If Red wins this match, 85% chance they move to Tier 1 next week"
- "Blue needs to finish 1st to avoid dropping to Tier 3"
- Show required placement for desired tier movement

### Power Rankings

Cross-tier server comparison:
- Rank all servers regardless of tier
- "True strength" ratings
- Head-to-head records
- Performance against common opponents

### Link Partner Analysis

Track performance of different server linking combinations:
- "YB + FA linked: 12-3 record"
- "Best link partners for [Server X]"
- Link stability (how long servers stay linked)
- Synergy scores

---

## 15. Map-Specific Performance Breakdown

### Overview
Analyze performance separately for each map (EBG and each Borderland).

### Data Requirements
- Need to track objectives per map (from `/v2/wvw/matches/overview/:id`)
- Map ownership percentage
- PPT contribution per map

### Features
- **Per-Map Scoreboard**: Show performance on each of 4 maps
- **Map Dominance Heatmap**: Visual showing which team controls each map when
- **Map Preferences**: "Red dominates EBG but struggles in Blue BL"
- **Tactical Insights**: "Green earns 60% of their PPT from their home Borderland"

### UI Display
```
Map Performance Breakdown:

Eternal Battleground
┌────────────────────────────────┐
│ Red: 45% control | 80 PPT      │
│ Blue: 35% control | 60 PPT     │
│ Green: 20% control | 40 PPT    │
└────────────────────────────────┘

Red Borderland
┌────────────────────────────────┐
│ Red: 70% control | 120 PPT     │
│ Blue: 20% control | 40 PPT     │
│ Green: 10% control | 20 PPT    │
└────────────────────────────────┘

Blue Borderland
┌────────────────────────────────┐
│ Blue: 60% control | 100 PPT    │
│ Red: 25% control | 50 PPT      │
│ Green: 15% control | 30 PPT    │
└────────────────────────────────┘

Green Borderland
┌────────────────────────────────┐
│ Green: 55% control | 90 PPT    │
│ Blue: 30% control | 55 PPT     │
│ Red: 15% control | 30 PPT      │
└────────────────────────────────┘
```

---

## 16. Data Export & API

### Export Formats

Allow users to download match data:
- **CSV**: For spreadsheet analysis
- **JSON**: For programmatic access
- **PDF**: Match summary report

### Public API

Provide REST API for third-party integrations:

```
GET /api/matches - List all current matches
GET /api/matches/{id} - Get match details
GET /api/matches/{id}/history - Get historical snapshots
GET /api/worlds - List all worlds
GET /api/guilds - List all tracked guilds
```

Rate limiting: 100 requests/minute per IP

### Webhooks

Allow users to register webhooks for events:
```typescript
interface Webhook {
  url: string;
  events: string[]; // ['match.end', 'skirmish.end', 'lead.change']
  secret: string; // For signature verification
}
```

---

## 17. Mobile Progressive Web App (PWA)

### Features
- **Offline Mode**: Cache recent match data
- **Push Notifications**: Native-feeling alerts
- **Add to Home Screen**: Install as app
- **Simplified Mobile UI**: Touch-optimized interface
- **Fast Loading**: Service worker caching

### Technical Implementation
- Next.js PWA plugin
- Service worker for caching
- Web Push API for notifications
- Responsive design patterns
- Mobile-first CSS

---

## 18. Commander Tools & Real-Time Tactical Recommendations

### Features

#### Objective Priority Calculator
"Based on current PPT and match state, these are the best objectives to capture right now:"
1. Stonemist Castle (+18 PPT if captured)
2. Red Keep (+12 PPT if captured)
3. ...

#### Countdown Timers Dashboard
- Next skirmish end: 1h 23m 15s
- Garrison upgrades to T2: 45m
- SM upgrades to T3: 2h 15m

#### Raid Planner
- "If we capture these 3 objectives, our PPT becomes X"
- "To win this skirmish, we need Y more points in Z time"
- Resource allocation recommendations

#### Defensive Priority
- "These objectives are close to upgrading - defend them"
- "You're losing the skirmish - focus on these high-value targets"

---

## 19. Performance Metrics Deep Dive

### Kill/Death Analysis
- K/D ratio trends over time
- Kills per tick
- Deaths per tick
- K/D by prime time window
- K/D by map

### Efficiency Metrics
- **Score Efficiency**: Actual score vs theoretical max (if held all objectives)
- **PPT Utilization**: How well teams convert PPT into actual points
- **Objective Hold Duration**: Average time objectives are held
- **Flip Frequency**: How often objectives change hands

### Comparative Metrics
- Performance vs previous weeks
- Performance vs tier average
- Outlier detection (unusually high/low performance)

---

## 20. Advanced What-If Scenario Simulator

Building on Phase 1 prediction tool:

### Interactive Map
- Click objectives to simulate captures
- Real-time PPT recalculation
- Score projection updates

### ROI Calculator
"Is it worth fighting for Garrison right now?"
- VP gain from holding rest of skirmish
- Risk/reward analysis
- Opportunity cost

### Multi-Variable Scenarios
- "What if Red captures SM AND Blue loses all their keeps?"
- "Best case / worst case / most likely case" projections
- Monte Carlo simulation with thousands of scenarios

---

## Implementation Priority

**Immediate Priority:**
- Feature #7 (Guilds Page & Admin Panel)

**Next Recommended:**
- Feature #4 (Snapshot Boundary Safeguards) - Important for data quality
- Feature #6 (Match Quick Navigation Dropdown) - Quick win for UX
- Feature #11 (Skirmish Streak Tracking) - Easy to implement with existing data
- Feature #13 (Notifications & Alerts) - High user value

**Future Considerations:**
- Feature #12 (Social Features) - Drives growth
- Feature #14 (Tier Movement & Rankings) - Strategic depth
- Feature #8 (Historical Archive) - Requires infrastructure decisions
- Feature #17 (Mobile PWA) - Broader audience reach


## Optimizaitons

- Scan commands expensive? Can we use queries instead?