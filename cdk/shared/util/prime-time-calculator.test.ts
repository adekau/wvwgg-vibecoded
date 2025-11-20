/**
 * Unit tests for Prime Time Calculator
 *
 * These tests ensure accurate calculation of prime time statistics,
 * preventing issues where disconnected time windows (like off-hours)
 * incorrectly include activity from other time periods.
 */

import { describe, it, expect } from 'vitest';
import { calculateMatchPrimeTimeStats, groupByPrimeTimeWindow } from './prime-time-calculator';

describe('Prime Time Calculator', () => {
  describe('groupByPrimeTimeWindow', () => {
    it('should correctly classify NA Prime Time (1-6 UTC)', () => {
      const data = [
        { timestamp: new Date('2025-01-20T01:00:00Z').getTime() }, // 1 UTC - NA Prime
        { timestamp: new Date('2025-01-20T03:30:00Z').getTime() }, // 3:30 UTC - NA Prime
        { timestamp: new Date('2025-01-20T05:59:00Z').getTime() }, // 5:59 UTC - NA Prime
        { timestamp: new Date('2025-01-20T06:00:00Z').getTime() }, // 6 UTC - Off Hours
      ];

      const grouped = groupByPrimeTimeWindow(data);

      expect(grouped['na-prime']).toHaveLength(3);
      expect(grouped['off-hours']).toHaveLength(1);
    });

    it('should correctly classify EU Prime Time (18-22 UTC)', () => {
      const data = [
        { timestamp: new Date('2025-01-20T12:30:00Z').getTime() }, // Off Hours (12 UTC is between SEA and EU)
        { timestamp: new Date('2025-01-20T18:00:00Z').getTime() }, // EU Prime
        { timestamp: new Date('2025-01-20T20:30:00Z').getTime() }, // EU Prime
        { timestamp: new Date('2025-01-20T21:59:00Z').getTime() }, // EU Prime
        { timestamp: new Date('2025-01-20T22:00:00Z').getTime() }, // Off Hours
      ];

      const grouped = groupByPrimeTimeWindow(data);

      expect(grouped['eu-prime']).toHaveLength(3);
      expect(grouped['off-hours']).toHaveLength(2);
    });

    it('should correctly classify OCX Prime Time (7-12 UTC)', () => {
      const data = [
        { timestamp: new Date('2025-01-20T06:59:00Z').getTime() }, // Off Hours
        { timestamp: new Date('2025-01-20T07:00:00Z').getTime() }, // OCX
        { timestamp: new Date('2025-01-20T11:59:00Z').getTime() }, // OCX
        { timestamp: new Date('2025-01-20T12:00:00Z').getTime() }, // Off Hours
      ];

      const grouped = groupByPrimeTimeWindow(data);

      expect(grouped['ocx']).toHaveLength(2);
      expect(grouped['off-hours']).toHaveLength(2);
    });

    it('should correctly classify SEA Prime Time (13-18 UTC)', () => {
      const data = [
        { timestamp: new Date('2025-01-20T12:59:00Z').getTime() }, // Off Hours
        { timestamp: new Date('2025-01-20T13:00:00Z').getTime() }, // SEA
        { timestamp: new Date('2025-01-20T17:59:00Z').getTime() }, // SEA
        { timestamp: new Date('2025-01-20T18:00:00Z').getTime() }, // EU Prime
      ];

      const grouped = groupByPrimeTimeWindow(data);

      expect(grouped['sea']).toHaveLength(2);
      expect(grouped['off-hours']).toHaveLength(1);
      expect(grouped['eu-prime']).toHaveLength(1);
    });

    it('should handle off-hours spanning multiple disconnected ranges', () => {
      const data = [
        { timestamp: new Date('2025-01-20T00:30:00Z').getTime() }, // Off Hours (0:30)
        { timestamp: new Date('2025-01-20T06:30:00Z').getTime() }, // Off Hours (6:30)
        { timestamp: new Date('2025-01-20T12:30:00Z').getTime() }, // Off Hours (12:30)
        { timestamp: new Date('2025-01-20T22:30:00Z').getTime() }, // Off Hours (22:30)
      ];

      const grouped = groupByPrimeTimeWindow(data);

      expect(grouped['off-hours']).toHaveLength(4);
    });
  });

  describe('calculateMatchPrimeTimeStats - Delta Calculation', () => {
    it('should calculate deltas between consecutive snapshots, not first-to-last', () => {
      // This is the critical test for the bug fix
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T00:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 100, deaths: 80, victoryPoints: 50, totalScore: 10000 },
              blue: { kills: 90, deaths: 70, victoryPoints: 40, totalScore: 9000 },
              green: { kills: 80, deaths: 60, victoryPoints: 30, totalScore: 8000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T01:30:00Z').getTime(), // NA Prime starts
          data: {
            '1-1': {
              red: { kills: 200, deaths: 150, victoryPoints: 100, totalScore: 20000 }, // +100 kills
              blue: { kills: 180, deaths: 140, victoryPoints: 90, totalScore: 18000 },
              green: { kills: 160, deaths: 130, victoryPoints: 80, totalScore: 16000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T02:30:00Z').getTime(), // NA Prime
          data: {
            '1-1': {
              red: { kills: 350, deaths: 250, victoryPoints: 160, totalScore: 35000 }, // +150 kills
              blue: { kills: 320, deaths: 240, victoryPoints: 150, totalScore: 32000 },
              green: { kills: 290, deaths: 230, victoryPoints: 140, totalScore: 29000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T05:30:00Z').getTime(), // NA Prime
          data: {
            '1-1': {
              red: { kills: 500, deaths: 350, victoryPoints: 220, totalScore: 50000 }, // +150 kills
              blue: { kills: 470, deaths: 340, victoryPoints: 210, totalScore: 47000 },
              green: { kills: 440, deaths: 330, victoryPoints: 200, totalScore: 44000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T06:30:00Z').getTime(), // Off Hours
          data: {
            '1-1': {
              red: { kills: 550, deaths: 380, victoryPoints: 240, totalScore: 55000 }, // +50 kills
              blue: { kills: 510, deaths: 370, victoryPoints: 230, totalScore: 51000 },
              green: { kills: 470, deaths: 360, victoryPoints: 220, totalScore: 48000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T12:30:00Z').getTime(), // Off Hours
          data: {
            '1-1': {
              red: { kills: 600, deaths: 410, victoryPoints: 260, totalScore: 60000 }, // +50 kills
              blue: { kills: 550, deaths: 400, victoryPoints: 250, totalScore: 55000 },
              green: { kills: 500, deaths: 390, victoryPoints: 240, totalScore: 52000 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');
      const offHours = result.find((w) => w.windowId === 'off-hours');

      // NA Prime should have deltas: red(100+150+150=400), blue(90+140+150=380), green(80+130+150=360)
      expect(naPrime?.red.kills).toBe(400);
      expect(naPrime?.blue.kills).toBe(380);
      expect(naPrime?.green.kills).toBe(360);

      // Off Hours should have: 50 + 50 = 100 kills (first snapshot excluded)
      expect(offHours?.red.kills).toBe(100);
      expect(offHours?.blue.kills).toBe(80);
      expect(offHours?.green.kills).toBe(60);
    });

    it('should exclude first snapshot from calculations', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:30:00Z').getTime(), // First snapshot at NA Prime
          data: {
            '1-1': {
              red: { kills: 500, deaths: 400, victoryPoints: 200, totalScore: 50000 },
              blue: { kills: 450, deaths: 350, victoryPoints: 180, totalScore: 45000 },
              green: { kills: 400, deaths: 300, victoryPoints: 160, totalScore: 40000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T02:30:00Z').getTime(), // NA Prime
          data: {
            '1-1': {
              red: { kills: 600, deaths: 500, victoryPoints: 240, totalScore: 60000 }, // +100 kills
              blue: { kills: 540, deaths: 440, victoryPoints: 220, totalScore: 54000 },
              green: { kills: 480, deaths: 380, victoryPoints: 200, totalScore: 48000 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      // Should only count delta between snapshots, not include first snapshot's 500 kills
      expect(naPrime?.red.kills).toBe(100);
    });

    it('should handle VP and score deltas correctly', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:00:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 100, deaths: 80, victoryPoints: 100, totalScore: 10000 },
              blue: { kills: 90, deaths: 70, victoryPoints: 90, totalScore: 9000 },
              green: { kills: 80, deaths: 60, victoryPoints: 80, totalScore: 8000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T02:00:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 150, deaths: 120, victoryPoints: 150, totalScore: 15000 },
              blue: { kills: 130, deaths: 110, victoryPoints: 130, totalScore: 13000 },
              green: { kills: 110, deaths: 100, victoryPoints: 110, totalScore: 11000 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      expect(naPrime?.red.victoryPoints).toBe(50); // 150 - 100
      expect(naPrime?.red.score).toBe(5000); // 15000 - 10000
    });

    it('should calculate K/D ratio correctly', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:00:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 100, deaths: 80, victoryPoints: 100, totalScore: 10000 },
              blue: { kills: 90, deaths: 70, victoryPoints: 90, totalScore: 9000 },
              green: { kills: 80, deaths: 60, victoryPoints: 80, totalScore: 8000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T02:00:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 200, deaths: 130, victoryPoints: 150, totalScore: 20000 }, // +100 kills, +50 deaths = 2.0 K/D
              blue: { kills: 150, deaths: 120, victoryPoints: 130, totalScore: 15000 }, // +60 kills, +50 deaths = 1.2 K/D
              green: { kills: 140, deaths: 160, victoryPoints: 110, totalScore: 14000 }, // +60 kills, +100 deaths = 0.6 K/D
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      expect(naPrime?.red.kdRatio).toBe('2.00');
      expect(naPrime?.blue.kdRatio).toBe('1.20');
      expect(naPrime?.green.kdRatio).toBe('0.60');
    });
  });

  describe('calculateMatchPrimeTimeStats - Duration Calculation', () => {
    it('should calculate duration as snapshot_count × 0.25 hours', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:00:00Z').getTime(),
          data: { '1-1': { red: { kills: 100, deaths: 80, victoryPoints: 100, totalScore: 10000 } } },
        },
        {
          timestamp: new Date('2025-01-20T01:15:00Z').getTime(),
          data: { '1-1': { red: { kills: 120, deaths: 90, victoryPoints: 110, totalScore: 12000 } } },
        },
        {
          timestamp: new Date('2025-01-20T01:30:00Z').getTime(),
          data: { '1-1': { red: { kills: 140, deaths: 100, victoryPoints: 120, totalScore: 14000 } } },
        },
        {
          timestamp: new Date('2025-01-20T01:45:00Z').getTime(),
          data: { '1-1': { red: { kills: 160, deaths: 110, victoryPoints: 130, totalScore: 16000 } } },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      // 4 snapshots × 0.25 hours = 1.0 hours
      expect(naPrime?.duration).toBe(1.0);
      expect(naPrime?.dataPoints).toBe(4);
    });

    it('should round duration to 1 decimal place', () => {
      const snapshots = Array.from({ length: 7 }, (_, i) => ({
        timestamp: new Date('2025-01-20T01:00:00Z').getTime() + i * 15 * 60 * 1000,
        data: {
          '1-1': {
            red: { kills: 100 + i * 10, deaths: 80 + i * 8, victoryPoints: 100 + i * 5, totalScore: 10000 + i * 1000 },
          },
        },
      }));

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      // 7 snapshots × 0.25 = 1.75 hours
      expect(naPrime?.duration).toBe(1.8); // Rounded to 1 decimal
    });
  });

  describe('calculateMatchPrimeTimeStats - Edge Cases', () => {
    it('should handle empty snapshots array', () => {
      const result = calculateMatchPrimeTimeStats('1-1', []);
      expect(result).toEqual([]);
    });

    it('should handle match not present in snapshot data', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:00:00Z').getTime(),
          data: {
            '2-1': {
              // Different match
              red: { kills: 100, deaths: 80, victoryPoints: 100, totalScore: 10000 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      expect(result).toEqual([]);
    });

    it('should handle negative deltas (should clamp to 0)', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:00:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 200, deaths: 150, victoryPoints: 100, totalScore: 20000 },
              blue: { kills: 180, deaths: 140, victoryPoints: 90, totalScore: 18000 },
              green: { kills: 160, deaths: 130, victoryPoints: 80, totalScore: 16000 },
            },
          },
        },
        {
          timestamp: new Date('2025-01-20T02:00:00Z').getTime(),
          data: {
            '1-1': {
              // Negative delta (shouldn't happen, but handle it)
              red: { kills: 150, deaths: 140, victoryPoints: 90, totalScore: 15000 },
              blue: { kills: 170, deaths: 135, victoryPoints: 85, totalScore: 17000 },
              green: { kills: 155, deaths: 125, victoryPoints: 75, totalScore: 15500 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      // Negative deltas should be clamped to 0
      expect(naPrime?.red.kills).toBe(0);
      expect(naPrime?.blue.kills).toBe(0);
      expect(naPrime?.green.kills).toBe(0);
    });

    it('should handle single snapshot', () => {
      const snapshots = [
        {
          timestamp: new Date('2025-01-20T01:00:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 100, deaths: 80, victoryPoints: 100, totalScore: 10000 },
              blue: { kills: 90, deaths: 70, victoryPoints: 90, totalScore: 9000 },
              green: { kills: 80, deaths: 60, victoryPoints: 80, totalScore: 8000 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);
      const naPrime = result.find((w) => w.windowId === 'na-prime');

      // Single snapshot - no deltas to calculate (first snapshot is excluded)
      expect(naPrime?.red.kills).toBe(0);
      expect(naPrime?.dataPoints).toBe(1);
    });
  });

  describe('calculateMatchPrimeTimeStats - Real World Scenario', () => {
    it('should accurately separate activity across all time windows', () => {
      // Simulate a full day of match data with activity in all windows
      const snapshots = [
        // Off-hours (0:30)
        {
          timestamp: new Date('2025-01-20T00:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 50, deaths: 40, victoryPoints: 25, totalScore: 5000 },
              blue: { kills: 45, deaths: 35, victoryPoints: 20, totalScore: 4500 },
              green: { kills: 40, deaths: 30, victoryPoints: 15, totalScore: 4000 },
            },
          },
        },
        // NA Prime (1:30) +100 kills
        {
          timestamp: new Date('2025-01-20T01:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 150, deaths: 120, victoryPoints: 75, totalScore: 15000 },
              blue: { kills: 135, deaths: 110, victoryPoints: 65, totalScore: 13500 },
              green: { kills: 120, deaths: 100, victoryPoints: 55, totalScore: 12000 },
            },
          },
        },
        // NA Prime (3:30) +80 kills
        {
          timestamp: new Date('2025-01-20T03:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 230, deaths: 190, victoryPoints: 115, totalScore: 23000 },
              blue: { kills: 205, deaths: 175, victoryPoints: 100, totalScore: 20500 },
              green: { kills: 180, deaths: 160, victoryPoints: 85, totalScore: 18000 },
            },
          },
        },
        // Off-hours (6:30) +60 kills
        {
          timestamp: new Date('2025-01-20T06:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 290, deaths: 240, victoryPoints: 145, totalScore: 29000 },
              blue: { kills: 255, deaths: 220, victoryPoints: 125, totalScore: 25500 },
              green: { kills: 220, deaths: 200, victoryPoints: 105, totalScore: 22000 },
            },
          },
        },
        // OCX (9:30) +90 kills
        {
          timestamp: new Date('2025-01-20T09:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 380, deaths: 310, victoryPoints: 190, totalScore: 38000 },
              blue: { kills: 335, deaths: 285, victoryPoints: 165, totalScore: 33500 },
              green: { kills: 290, deaths: 260, victoryPoints: 140, totalScore: 29000 },
            },
          },
        },
        // SEA (15:30) +70 kills
        {
          timestamp: new Date('2025-01-20T15:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 450, deaths: 370, victoryPoints: 225, totalScore: 45000 },
              blue: { kills: 395, deaths: 340, victoryPoints: 195, totalScore: 39500 },
              green: { kills: 340, deaths: 310, victoryPoints: 165, totalScore: 34000 },
            },
          },
        },
        // EU Prime (19:30) +110 kills
        {
          timestamp: new Date('2025-01-20T19:30:00Z').getTime(),
          data: {
            '1-1': {
              red: { kills: 560, deaths: 460, victoryPoints: 280, totalScore: 56000 },
              blue: { kills: 490, deaths: 420, victoryPoints: 240, totalScore: 49000 },
              green: { kills: 420, deaths: 380, victoryPoints: 200, totalScore: 42000 },
            },
          },
        },
      ];

      const result = calculateMatchPrimeTimeStats('1-1', snapshots);

      const naPrime = result.find((w) => w.windowId === 'na-prime');
      const euPrime = result.find((w) => w.windowId === 'eu-prime');
      const ocx = result.find((w) => w.windowId === 'ocx');
      const sea = result.find((w) => w.windowId === 'sea');
      const offHours = result.find((w) => w.windowId === 'off-hours');

      // Verify each window has correct activity
      expect(naPrime?.red.kills).toBe(180); // 100 + 80
      expect(euPrime?.red.kills).toBe(110);
      expect(ocx?.red.kills).toBe(90);
      expect(sea?.red.kills).toBe(70);
      expect(offHours?.red.kills).toBe(60); // First snapshot excluded

      // Verify total adds up (excluding first snapshot)
      const total = 180 + 110 + 90 + 70 + 60;
      expect(total).toBe(510); // 560 - 50 (first snapshot excluded)
    });
  });
});
