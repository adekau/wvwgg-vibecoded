/**
 * Unit tests for VP Tiers Calculator
 *
 * Tests VP tier calculations based on time of day and region,
 * ensuring correct VP awards for different skirmish times.
 */

import { describe, it, expect } from 'vitest'
import { getVPTierForTime, getRegionFromMatchId, type VPTier } from '@/lib/vp-tiers'

describe('VP Tiers Calculator', () => {
  describe('getVPTierForTime - North America', () => {
    describe('NA Peak Hours (00:00-04:00 UTC)', () => {
      it('should return peak tier for 00:00-02:00 UTC', () => {
        const date = new Date('2024-01-01T00:00:00Z')
        const tier = getVPTierForTime(date, 'na')

        expect(tier.tier).toBe('peak')
        expect(tier.first).toBe(43)
        expect(tier.second).toBe(32)
        expect(tier.third).toBe(21)
      })

      it('should return peak tier for 02:00-04:00 UTC', () => {
        const date = new Date('2024-01-01T02:00:00Z')
        const tier = getVPTierForTime(date, 'na')

        expect(tier.tier).toBe('peak')
        expect(tier.first).toBe(43)
        expect(tier.second).toBe(32)
        expect(tier.third).toBe(21)
      })
    })

    describe('NA High Hours', () => {
      it('should return high tier for 04:00-06:00 UTC', () => {
        const date = new Date('2024-01-01T04:00:00Z')
        const tier = getVPTierForTime(date, 'na')

        expect(tier.tier).toBe('high')
        expect(tier.first).toBe(31)
        expect(tier.second).toBe(24)
        expect(tier.third).toBe(17)
      })

      it('should return high tier for 22:00-24:00 UTC', () => {
        const date = new Date('2024-01-01T22:00:00Z')
        const tier = getVPTierForTime(date, 'na')

        expect(tier.tier).toBe('high')
        expect(tier.first).toBe(31)
        expect(tier.second).toBe(24)
        expect(tier.third).toBe(17)
      })
    })

    describe('NA Medium Hours', () => {
      it('should return medium tier for 06:00-08:00 UTC', () => {
        const date = new Date('2024-01-01T06:00:00Z')
        const tier = getVPTierForTime(date, 'na')

        expect(tier.tier).toBe('medium')
        expect(tier.first).toBe(23)
        expect(tier.second).toBe(18)
        expect(tier.third).toBe(14)
      })

      it('should return medium tier for 14:00-22:00 UTC', () => {
        const times = [14, 16, 18, 20]
        times.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const tier = getVPTierForTime(date, 'na')

          expect(tier.tier).toBe('medium')
          expect(tier.first).toBe(23)
        })
      })
    })

    describe('NA Low Hours', () => {
      it('should return low tier for 08:00-14:00 UTC', () => {
        const times = [8, 10, 12]
        times.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const tier = getVPTierForTime(date, 'na')

          expect(tier.tier).toBe('low')
          expect(tier.first).toBe(19)
          expect(tier.second).toBe(16)
          expect(tier.third).toBe(13)
        })
      })
    })
  })

  describe('getVPTierForTime - Europe', () => {
    describe('EU Peak Hours (18:00-22:00 UTC)', () => {
      it('should return peak tier for 18:00-20:00 UTC', () => {
        const date = new Date('2024-01-01T18:00:00Z')
        const tier = getVPTierForTime(date, 'eu')

        expect(tier.tier).toBe('peak')
        expect(tier.first).toBe(51)
        expect(tier.second).toBe(37)
        expect(tier.third).toBe(24)
      })

      it('should return peak tier for 20:00-22:00 UTC', () => {
        const date = new Date('2024-01-01T20:00:00Z')
        const tier = getVPTierForTime(date, 'eu')

        expect(tier.tier).toBe('peak')
        expect(tier.first).toBe(51)
        expect(tier.second).toBe(37)
        expect(tier.third).toBe(24)
      })
    })

    describe('EU High Hours', () => {
      it('should return high tier for 14:00-18:00 UTC', () => {
        const times = [14, 16]
        times.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour}:00:00Z`)
          const tier = getVPTierForTime(date, 'eu')

          expect(tier.tier).toBe('high')
          expect(tier.first).toBe(31)
          expect(tier.second).toBe(24)
          expect(tier.third).toBe(17)
        })
      })

      it('should return high tier for 22:00-24:00 UTC', () => {
        const date = new Date('2024-01-01T22:00:00Z')
        const tier = getVPTierForTime(date, 'eu')

        expect(tier.tier).toBe('high')
        expect(tier.first).toBe(31)
      })
    })

    describe('EU Medium Hours', () => {
      it('should return medium tier for 08:00-14:00 UTC', () => {
        const times = [8, 10, 12]
        times.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const tier = getVPTierForTime(date, 'eu')

          expect(tier.tier).toBe('medium')
          expect(tier.first).toBe(22)
          expect(tier.second).toBe(18)
          expect(tier.third).toBe(14)
        })
      })
    })

    describe('EU Low Hours', () => {
      it('should return low tier for 00:00-08:00 UTC', () => {
        const times = [0, 2, 4, 6]
        times.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const tier = getVPTierForTime(date, 'eu')

          expect(tier.tier).toBe('low')
          expect(tier.first).toBe(15)
          expect(tier.second).toBe(14)
          expect(tier.third).toBe(12)
        })
      })
    })
  })

  describe('getVPTierForTime - Boundary Times', () => {
    it('should handle hour boundaries correctly for NA', () => {
      // Test exact hour boundaries
      const date1 = new Date('2024-01-01T00:00:00Z')
      const tier1 = getVPTierForTime(date1, 'na')
      expect(tier1.tier).toBe('peak')

      const date2 = new Date('2024-01-01T01:59:59Z')
      const tier2 = getVPTierForTime(date2, 'na')
      expect(tier2.tier).toBe('peak')

      const date3 = new Date('2024-01-01T02:00:00Z')
      const tier3 = getVPTierForTime(date3, 'na')
      expect(tier3.tier).toBe('peak')
    })

    it('should handle hour boundaries correctly for EU', () => {
      const date1 = new Date('2024-01-01T18:00:00Z')
      const tier1 = getVPTierForTime(date1, 'eu')
      expect(tier1.tier).toBe('peak')

      const date2 = new Date('2024-01-01T21:59:59Z')
      const tier2 = getVPTierForTime(date2, 'eu')
      expect(tier2.tier).toBe('peak')

      const date3 = new Date('2024-01-01T22:00:00Z')
      const tier3 = getVPTierForTime(date3, 'eu')
      expect(tier3.tier).toBe('high')
    })
  })

  describe('getVPTierForTime - Different Days', () => {
    it('should return consistent tiers regardless of day', () => {
      const dates = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-15T00:00:00Z'),
        new Date('2024-12-31T00:00:00Z'),
      ]

      dates.forEach((date) => {
        const tier = getVPTierForTime(date, 'na')
        expect(tier.first).toBe(43)
        expect(tier.tier).toBe('peak')
      })
    })

    it('should handle leap year dates', () => {
      const date = new Date('2024-02-29T12:00:00Z')
      const tier = getVPTierForTime(date, 'na')
      expect(tier).toBeDefined()
      expect(tier.tier).toBe('low')
    })
  })

  describe('getVPTierForTime - Minutes and Seconds', () => {
    it('should base tier on hour only, ignoring minutes', () => {
      const times = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-01T00:30:00Z'),
        new Date('2024-01-01T00:59:59Z'),
      ]

      times.forEach((date) => {
        const tier = getVPTierForTime(date, 'na')
        expect(tier.tier).toBe('peak')
        expect(tier.first).toBe(43)
      })
    })
  })

  describe('getVPTierForTime - VP Values Consistency', () => {
    it('should always have first > second > third', () => {
      const hours = Array.from({ length: 24 }, (_, i) => i)
      const regions: ('na' | 'eu')[] = ['na', 'eu']

      regions.forEach((region) => {
        hours.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const tier = getVPTierForTime(date, region)

          expect(tier.first).toBeGreaterThan(tier.second)
          expect(tier.second).toBeGreaterThan(tier.third)
        })
      })
    })

    it('should have all VP values positive', () => {
      const hours = Array.from({ length: 24 }, (_, i) => i)
      const regions: ('na' | 'eu')[] = ['na', 'eu']

      regions.forEach((region) => {
        hours.forEach((hour) => {
          const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
          const tier = getVPTierForTime(date, region)

          expect(tier.first).toBeGreaterThan(0)
          expect(tier.second).toBeGreaterThan(0)
          expect(tier.third).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('getVPTierForTime - Peak Value Differences', () => {
    it('should show EU peak has higher values than NA peak', () => {
      const naPeak = getVPTierForTime(new Date('2024-01-01T00:00:00Z'), 'na')
      const euPeak = getVPTierForTime(new Date('2024-01-01T18:00:00Z'), 'eu')

      expect(euPeak.first).toBeGreaterThan(naPeak.first)
      expect(euPeak.second).toBeGreaterThan(naPeak.second)
      expect(euPeak.third).toBeGreaterThan(naPeak.third)
    })

    it('should show NA low has higher values than EU low', () => {
      const naLow = getVPTierForTime(new Date('2024-01-01T10:00:00Z'), 'na')
      const euLow = getVPTierForTime(new Date('2024-01-01T02:00:00Z'), 'eu')

      expect(naLow.first).toBeGreaterThan(euLow.first)
    })
  })

  describe('getRegionFromMatchId', () => {
    it('should return "na" for North America match IDs', () => {
      expect(getRegionFromMatchId('1-1')).toBe('na')
      expect(getRegionFromMatchId('1-5')).toBe('na')
      expect(getRegionFromMatchId('1-999')).toBe('na')
    })

    it('should return "eu" for Europe match IDs', () => {
      expect(getRegionFromMatchId('2-1')).toBe('eu')
      expect(getRegionFromMatchId('2-5')).toBe('eu')
      expect(getRegionFromMatchId('2-999')).toBe('eu')
    })

    it('should handle match IDs with extra hyphens', () => {
      expect(getRegionFromMatchId('1-5-extra')).toBe('na')
      expect(getRegionFromMatchId('2-5-extra')).toBe('eu')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid')
      // Should not throw, should return a fallback
      expect(() => getVPTierForTime(invalidDate, 'na')).not.toThrow()
    })

    it('should handle timezone conversions correctly', () => {
      // Create date in different timezone
      const date = new Date('2024-01-01T00:00:00-05:00') // EST
      const tier = getVPTierForTime(date, 'na')

      // Should still work correctly by using UTC
      expect(tier).toBeDefined()
    })

    it('should handle year boundaries', () => {
      const newYear = new Date('2024-01-01T00:00:00Z')
      const tier = getVPTierForTime(newYear, 'na')

      expect(tier.tier).toBe('peak')
    })
  })

  describe('Integration - Full Day Coverage', () => {
    it('should have tier defined for every hour of the day in NA', () => {
      for (let hour = 0; hour < 24; hour++) {
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
        const tier = getVPTierForTime(date, 'na')

        expect(tier).toBeDefined()
        expect(tier.tier).toBeDefined()
        expect(tier.first).toBeGreaterThan(0)
      }
    })

    it('should have tier defined for every hour of the day in EU', () => {
      for (let hour = 0; hour < 24; hour++) {
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
        const tier = getVPTierForTime(date, 'eu')

        expect(tier).toBeDefined()
        expect(tier.tier).toBeDefined()
        expect(tier.first).toBeGreaterThan(0)
      }
    })

    it('should have exactly 12 skirmishes per day with consistent tiers', () => {
      const skirmishes = []
      for (let i = 0; i < 12; i++) {
        const hour = i * 2 // Skirmishes every 2 hours
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`)
        const tier = getVPTierForTime(date, 'na')
        skirmishes.push(tier)
      }

      expect(skirmishes).toHaveLength(12)
      skirmishes.forEach((tier) => {
        expect(['low', 'medium', 'high', 'peak']).toContain(tier.tier)
      })
    })
  })

  describe('Real World Scenarios', () => {
    it('should correctly identify NA Prime Time (9 PM ET)', () => {
      // 9 PM ET = 2 AM UTC (next day during DST, 1 AM UTC during standard time)
      const date = new Date('2024-01-01T02:00:00Z')
      const tier = getVPTierForTime(date, 'na')

      expect(tier.tier).toBe('peak')
      expect(tier.first).toBe(43)
    })

    it('should correctly identify EU Prime Time (8 PM CET)', () => {
      // 8 PM CET = 7 PM UTC (CET is UTC+1)
      const date = new Date('2024-01-01T19:00:00Z')
      const tier = getVPTierForTime(date, 'eu')

      expect(tier.tier).toBe('peak')
      expect(tier.first).toBe(51)
    })

    it('should correctly identify off-hours for NA', () => {
      // Midday NA = low tier
      const date = new Date('2024-01-01T16:00:00Z') // 11 AM ET
      const tier = getVPTierForTime(date, 'na')

      expect(tier.tier).toBe('medium')
    })

    it('should correctly identify off-hours for EU', () => {
      // Early morning EU = low tier
      const date = new Date('2024-01-01T04:00:00Z') // 5 AM CET
      const tier = getVPTierForTime(date, 'eu')

      expect(tier.tier).toBe('low')
    })
  })
})
