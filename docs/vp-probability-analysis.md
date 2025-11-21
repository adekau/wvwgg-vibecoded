# VP Probability Analysis - Phase 4

## Overview

Phase 4 adds statistical probability predictions to the Victory Point (VP) Prediction tool using historical performance analysis and Monte Carlo simulations. This allows users to see the most likely match outcomes based on how teams have actually performed, rather than just theoretical scenarios.

## Architecture

### Components

1. **Historical Performance Analyzer** (`lib/historical-performance.ts`)
   - Analyzes completed skirmishes to calculate win rate statistics
   - Tracks performance by time window (NA Prime, EU Prime, OCX/SEA, Off Hours)
   - Calculates placement probabilities for each team

2. **Monte Carlo Simulator** (`lib/monte-carlo-simulator.ts`)
   - Runs thousands of simulations of remaining skirmishes
   - Uses historical probabilities to predict realistic outcomes
   - Calculates confidence intervals and outcome probabilities

3. **VP Probability Analysis Component** (`components/vp-probability-analysis.tsx`)
   - React component that displays probability predictions
   - Shows most likely outcome, confidence intervals, and top 5 scenarios
   - Runs simulations in chunks to avoid blocking UI

## Key Features

### Historical Performance Analysis

The system analyzes completed skirmishes to understand each team's historical performance:

```typescript
interface TeamHistoricalStats {
  teamColor: 'red' | 'blue' | 'green'
  teamName: string

  // Overall statistics
  overall: TimeWindowStats

  // Statistics by time window
  byWindow: {
    naPrime: TimeWindowStats
    euPrime: TimeWindowStats
    ocx: TimeWindowStats
    offHours: TimeWindowStats
  }

  // Placement probabilities (0-1)
  placementProbability: {
    first: number
    second: number
    third: number
  }
}
```

**Time Windows:**
- **NA Prime**: 00:00 - 05:00 UTC (7 PM - 12 AM ET)
- **EU Prime**: 18:00 - 23:00 UTC (7 PM - 12 AM CET)
- **OCX/SEA**: 08:00 - 13:00 UTC (7 PM - 12 AM AEDT)
- **Off Hours**: All remaining hours

### Monte Carlo Simulation

Runs 1,000 to 100,000 simulations of remaining skirmishes:

```typescript
interface MonteCarloResult {
  iterations: number

  // Most likely outcome
  mostLikelyOutcome: {
    first: 'red' | 'blue' | 'green'
    second: 'red' | 'blue' | 'green'
    third: 'red' | 'blue' | 'green'
  }
  mostLikelyProbability: number

  // Confidence intervals (10th, 50th, 90th percentiles)
  vpConfidenceIntervals: {
    red: { p10: number; p50: number; p90: number }
    blue: { p10: number; p50: number; p90: number }
    green: { p10: number; p50: number; p90: number }
  }

  // Team position probabilities
  teamPositionProbabilities: {
    red: { first: number; second: number; third: number }
    blue: { first: number; second: number; third: number }
    green: { first: number; second: number; third: number }
  }

  // Top outcomes ranked by probability
  outcomeProbabilities: Array<{
    outcome: { first: string; second: string; third: string }
    probability: number
    count: number
  }>
}
```

## Usage

### Basic Usage

```typescript
import { analyzeHistoricalPerformance } from '@/lib/historical-performance'
import { runMonteCarloSimulation } from '@/lib/monte-carlo-simulator'

// 1. Analyze historical performance
const historicalStats = {
  red: analyzeHistoricalPerformance(skirmishResults, 'red', 'Red Team', 'na'),
  blue: analyzeHistoricalPerformance(skirmishResults, 'blue', 'Blue Team', 'na'),
  green: analyzeHistoricalPerformance(skirmishResults, 'green', 'Green Team', 'na'),
}

// 2. Run Monte Carlo simulation
const result = runMonteCarloSimulation(
  currentVP,           // Current VP totals
  remainingSkirmishes, // Remaining skirmishes with VP awards
  historicalStats,     // Historical performance data
  'na',               // Region
  10000               // Number of simulations
)

// 3. Access results
console.log('Most likely outcome:', result.mostLikelyOutcome)
console.log('Probability:', result.mostLikelyProbability)
console.log('Red has', result.teamPositionProbabilities.red.first * 100, '% chance to finish 1st')
```

### Chunked Simulation (Avoid UI Blocking)

For large simulation counts, use chunking to prevent blocking the UI:

```typescript
import { analyzeSimulations } from '@/lib/monte-carlo-simulator'

const allSimulations = []
const chunkSize = 1000
const totalChunks = Math.ceil(iterations / chunkSize)

for (let chunk = 0; chunk < totalChunks; chunk++) {
  const chunkIterations = Math.min(chunkSize, iterations - chunk * chunkSize)

  const chunkResult = runMonteCarloSimulation(
    currentVP,
    remainingSkirmishes,
    historicalStats,
    region,
    chunkIterations
  )

  allSimulations.push(...chunkResult.simulations)

  // Yield to UI
  await new Promise(resolve => setTimeout(resolve, 10))
}

// Analyze all accumulated simulations
const finalResult = analyzeSimulations(allSimulations)
```

## Performance Considerations

### UI Responsiveness

The Monte Carlo simulation can be computationally intensive. To maintain UI responsiveness:

1. **Chunking**: Process simulations in chunks of 1,000 with 10ms pauses
2. **Web Workers**: Consider moving simulation to a Web Worker for true parallelism
3. **Progressive Results**: Show partial results while simulation continues

### Memory Usage

Each simulation stores:
- Final VP for 3 teams (24 bytes)
- Final standings (3 strings, ~24 bytes)
- Placement history (optional, can be large)

For 100,000 simulations: ~4.8 MB of memory

**Optimization**: Don't store full placement history unless needed for detailed analysis.

## Algorithm Details

### Historical Performance Analysis

1. **Data Collection**: Convert completed skirmishes to `SkirmishResult` format
2. **Time Window Classification**: Categorize each skirmish by time window
3. **Probability Calculation**:
   ```
   P(placement) = count(placement) / total_skirmishes
   ```
4. **Fallback**: If no data for a time window, use overall probabilities

### Monte Carlo Simulation

For each simulation:

1. **Iterate** through remaining skirmishes
2. **Sample** placement for each team based on time-window-specific probabilities
3. **Validate** placements (ensure no duplicates)
4. **Calculate** VP awarded based on placements
5. **Store** final VP and standings

After all simulations:

1. **Count** outcome frequencies
2. **Calculate** percentiles for VP confidence intervals
3. **Rank** outcomes by probability
4. **Return** comprehensive results

### Placement Validation

To ensure valid placements (no two teams in same position):

```typescript
function ensureValidPlacements(placements: {
  red: 1|2|3, blue: 1|2|3, green: 1|2|3
}): ValidPlacements {
  // Check if all unique
  if (new Set([placements.red, placements.blue, placements.green]).size === 3) {
    return placements
  }

  // Shuffle [1,2,3] and assign randomly
  const shuffled = [1, 2, 3].sort(() => Math.random() - 0.5)
  return {
    red: shuffled[0],
    blue: shuffled[1],
    green: shuffled[2]
  }
}
```

## Testing

See `__tests__/historical-performance.test.ts` and `__tests__/monte-carlo-simulator.test.ts` for comprehensive unit tests.

Key test scenarios:
- Historical analysis with various data distributions
- Monte Carlo simulation accuracy
- Edge cases (no data, all wins, all losses)
- Performance benchmarks
- Probability distribution validation

## Future Enhancements

1. **Machine Learning**: Use neural networks to predict outcomes based on multiple factors
2. **Advanced Metrics**: Consider kills/deaths, PPT trends, objective control
3. **Confidence Tuning**: Adjust probabilities based on recent performance (weighted average)
4. **Real-time Updates**: Re-run simulations as new skirmish data arrives
5. **Scenario Comparison**: Compare user-created scenarios against most likely outcome

## References

- [Monte Carlo Method - Wikipedia](https://en.wikipedia.org/wiki/Monte_Carlo_method)
- [Confidence Intervals - Statistics How To](https://www.statisticshowto.com/probability-and-statistics/confidence-interval/)
- [Percentile Calculation](https://en.wikipedia.org/wiki/Percentile)
