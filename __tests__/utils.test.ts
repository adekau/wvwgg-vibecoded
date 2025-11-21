/**
 * Unit tests for utility functions
 *
 * Tests the cn() utility for className merging.
 */

import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('cn() - className merging', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const result = cn('base', isActive && 'active')
      expect(result).toBe('base active')
    })

    it('should handle false conditional classes', () => {
      const isActive = false
      const result = cn('base', isActive && 'active')
      expect(result).toBe('base')
    })

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar')
    })

    it('should handle objects', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
    })

    it('should merge Tailwind classes correctly', () => {
      // twMerge should merge conflicting Tailwind classes
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('should handle undefined and null', () => {
      expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
    })

    it('should handle empty strings', () => {
      expect(cn('foo', '', 'bar')).toBe('foo bar')
    })

    it('should handle complex combinations', () => {
      const result = cn(
        'base-class',
        { active: true, disabled: false },
        ['array-class-1', 'array-class-2'],
        undefined,
        'final-class'
      )
      expect(result).toContain('base-class')
      expect(result).toContain('active')
      expect(result).not.toContain('disabled')
      expect(result).toContain('array-class-1')
      expect(result).toContain('final-class')
    })
  })
})
