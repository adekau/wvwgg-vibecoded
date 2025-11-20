# Prime Time Calculator Tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The prime time calculator has comprehensive unit tests covering:

### Time Window Classification (5 tests)
- ✅ NA Prime Time (1-6 UTC)
- ✅ EU Prime Time (18-22 UTC)
- ✅ OCX Prime Time (7-12 UTC)
- ✅ SEA Prime Time (13-18 UTC)
- ✅ Off-hours spanning disconnected ranges

### Delta Calculation (4 tests)
- ✅ Consecutive snapshot deltas (not first-to-last)
- ✅ First snapshot exclusion
- ✅ VP and score deltas
- ✅ K/D ratio calculation

### Duration Calculation (2 tests)
- ✅ Duration = snapshots × 0.25 hours
- ✅ Rounding to 1 decimal place

### Edge Cases (5 tests)
- ✅ Empty snapshots array
- ✅ Match not in snapshot data
- ✅ Negative deltas (clamped to 0)
- ✅ Single snapshot
- ✅ Real-world full-day scenario

## Critical Bug Fix

The tests verify the fix for a critical bug where off-hours stats were calculated as `last - first` snapshot, incorrectly including all intervening prime time activity.

**Example of the bug:**
- Off-hours spans: 0:00-0:59, 6:00-11:59, 12:00-12:59, 22:00-23:59 UTC
- Old calculation: `snapshot[23:00].kills - snapshot[00:00].kills`
- This included ALL activity from the entire day!

**Fixed approach:**
- Sum deltas between consecutive snapshots
- Only count deltas where current snapshot is in target window
- Exclude first snapshot (can't attribute cumulative data)
