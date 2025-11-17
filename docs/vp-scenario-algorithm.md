# VP Scenario Planning Algorithm

## Overview

The VP Scenario Planning algorithm determines whether a desired World vs World match outcome is achievable given the current standings and remaining skirmishes. When achievable, it calculates the **minimum effort** required - meaning the fewest number of 1st place finishes needed for the desired winner, with optimal placement distributions for all teams.

## Problem Statement

Given:
- Current Victory Points (VP) for all three teams (red, blue, green)
- Remaining skirmishes with their VP awards (varies by time of day)
- Desired final outcome (1st, 2nd, 3rd place assignments)

Find:
- Whether the desired outcome is achievable
- If achievable, the minimum number of 1st place finishes required for the desired winner
- Optimal placement assignments (1st/2nd/3rd) for each team in each remaining skirmish

## Algorithm Design

### Phase 1: Feasibility Check

Before attempting optimization, the algorithm performs a quick feasibility check:

```typescript
function checkFeasibility(input: ScenarioInput): { possible: boolean; reason?: string }
```

**Logic:**
1. Calculate maximum possible VP (if a team wins all remaining skirmishes)
2. Calculate minimum possible VP (if a team places 3rd in all remaining skirmishes)
3. Check if desired standings are mathematically possible:
   - Can desired 1st place team's max VP beat desired 2nd place team's min VP?
   - Can desired 2nd place team's max VP beat desired 3rd place team's min VP?
   - Is desired 3rd place team's min VP lower than desired 2nd place team's max VP?

**Early Rejection:**
If any feasibility check fails, immediately return `isPossible: false` with an explanation.

### Phase 2: Binary Search Optimization

The core algorithm uses **binary search** to find the minimum number of 1st place finishes needed:

```typescript
let low = 0;
let high = remainingSkirmishes.length;

while (low <= high) {
  const mid = Math.floor((low + high) / 2);
  // Try to achieve outcome with 'mid' first place finishes
  // ...
}
```

**Why Binary Search?**
- The number of 1st places needed is monotonic: if N wins achieves the outcome, then N+1 wins also achieves it
- Binary search finds the minimum N in O(log n) iterations instead of trying all values

**Search Space:**
- Minimum: 0 (maintaining current standings might need no 1st places)
- Maximum: Total remaining skirmishes (worst case: need to win everything)

### Phase 3: Strategic Placement Assignment

For each candidate number of 1st places (`mid` in binary search):

#### Step 3.1: Assign 1st Places to Desired Winner

```typescript
// Sort skirmishes by VP value (highest first)
const sortedIndices = remainingSkirmishes
  .map((s, i) => ({ skirmish: s, originalIndex: i }))
  .sort((a, b) => b.skirmish.vpAwards.first - a.skirmish.vpAwards.first);

// Give 1st places in highest VP skirmishes
let firstPlacesGiven = 0;
for (const { originalIndex } of sortedIndices) {
  if (firstPlacesGiven < mid) {
    placements[originalIndex][first] = 1;
    firstPlacesGiven++;
  }
}
```

**Rationale:**
- Prioritize high-VP skirmishes (peak hours: 43-51 VP)
- Maximize VP gain per 1st place finish
- Minimizes total wins needed

#### Step 3.2: Assign 2nd and 3rd Places Optimally

For skirmishes where desired winner gets 1st:
```typescript
placements[i][second] = 2;
placements[i][third] = 3;
```

For skirmishes where desired winner doesn't get 1st, use **dynamic placement logic**:

```typescript
// Track running VP totals
const tempVP = { ...currentVP };

// For each skirmish:
const firstBehindSecond = tempVP[first] < tempVP[second];
const secondBehindThird = tempVP[second] < tempVP[third];

if (firstBehindSecond) {
  // Desired first needs more VP - give them 2nd
  if (secondBehindThird) {
    // Second also needs help - give them 1st, third gets 3rd
    placements[i] = { first: 2, second: 1, third: 3 };
  } else {
    // Second is ahead - can give third 1st to slow them down
    placements[i] = { first: 2, third: 1, second: 3 };
  }
} else {
  // Desired first is ahead - can afford 3rd place
  if (secondBehindThird) {
    // Second needs help - give them 1st
    placements[i] = { second: 1, third: 2, first: 3 };
  } else {
    // Second is ahead - give third 1st to keep them competitive
    placements[i] = { third: 1, second: 2, first: 3 };
  }
}
```

**Key Principles:**
1. **Minimize 1st places for desired winner** while achieving outcome
2. **Distribute placements realistically** - avoid giving a team 3rd in ALL skirmishes
3. **Maintain relative standings** - ensure desired 2nd stays ahead of desired 3rd
4. **Dynamic adjustment** - placement decisions depend on running VP totals

#### Step 3.3: Validate Outcome

After assigning all placements:
```typescript
const finalVP = calculateFinalVP(placements);

if (checkOutcome(finalVP)) {
  // This works! Try with fewer 1st places
  bestPlacements = placements;
  high = mid - 1;
} else {
  // Doesn't work, need more 1st places
  low = mid + 1;
}
```

### Phase 4: Difficulty Rating

Based on the percentage of 1st place finishes required:

```typescript
const firstPlacePercentage = (firstPlaceCount / totalSkirmishes) * 100;

if (firstPlacePercentage <= 40) {
  difficulty = 'easy';
} else if (firstPlacePercentage <= 60) {
  difficulty = 'moderate';
} else if (firstPlacePercentage <= 80) {
  difficulty = 'hard';
} else {
  difficulty = 'very-hard';
}
```

## Example Scenarios

### Scenario 1: Maintaining Current Standings

**Input:**
- Current: Red 712 VP, Blue 707 VP, Green 623 VP
- Desired: Red 1st, Blue 2nd, Green 3rd
- Remaining: 50 skirmishes

**Expected Result:**
- `isPossible: true`
- `difficulty: 'easy'`
- Minimum 1st places for Red: ~0-5 (very few needed to maintain lead)

### Scenario 2: Complete Reversal

**Input:**
- Current: Red 712 VP (1st), Blue 707 VP (2nd), Green 623 VP (3rd)
- Desired: Green 1st, Blue 2nd, Red 3rd
- Remaining: 50 skirmishes

**Expected Result:**
- `isPossible: true` (89 point gap, plenty of skirmishes)
- `difficulty: 'hard'` or 'very-hard'
- Minimum 1st places for Green: ~35-40 (needs most high-VP skirmishes)
- Red gets mix of 2nd and 3rd places (not 3rd in ALL skirmishes)

### Scenario 3: Close Race

**Input:**
- Current: Red 500 VP, Blue 498 VP, Green 497 VP
- Desired: Blue 1st, Red 2nd, Green 3rd
- Remaining: 10 skirmishes

**Expected Result:**
- `isPossible: true`
- `difficulty: 'moderate'`
- Very tight margins - Blue needs ~6-7 first places

## Performance Characteristics

- **Time Complexity:** O(n log n) where n = number of remaining skirmishes
  - Binary search: O(log n) iterations
  - Each iteration: O(n) to assign and validate placements
  - Sorting: O(n log n) once

- **Space Complexity:** O(n) for storing placements

## VP Tier Considerations

VP awards vary by time of day:
- **NA Peak Hours** (00:00-05:00 UTC): 43/32/21 VP
- **EU Peak Hours** (18:00-23:00 UTC): 51/37/24 VP
- **Low Activity**: 15-19 / 14-16 / 12-13 VP

The algorithm accounts for this by:
1. Calculating exact VP for each remaining skirmish based on start time
2. Prioritizing high-VP skirmishes for 1st place assignments
3. Providing accurate final VP projections

## Limitations and Future Improvements

### Current Limitations
1. Assumes teams can achieve any placement in any skirmish (doesn't account for team skill/population)
2. Doesn't optimize for "easiest path" (e.g., winning during off-hours vs peak)
3. Binary search finds minimum for desired 1st place only (not globally optimal for all teams)

### Potential Improvements
1. **Multi-objective optimization**: Minimize effort for all teams, not just desired 1st
2. **Time window preferences**: Allow specifying which time windows a team is strongest
3. **Probability modeling**: Account for historical performance to estimate achievability
4. **Alternative paths**: Show multiple valid scenarios with different difficulty levels
