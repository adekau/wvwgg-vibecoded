/**
 * React Query hooks for GW2 data
 * Provides client-side caching and automatic refetching
 */

'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  Profession,
  Skill,
  Trait,
  Item,
  ItemStat,
  Specialization,
  ProfessionId,
} from './types'

// ============================================================================
// QUERY KEYS
// ============================================================================

export const gw2QueryKeys = {
  professions: ['gw2', 'professions'] as const,
  profession: (id: ProfessionId) => ['gw2', 'professions', id] as const,
  skills: ['gw2', 'skills'] as const,
  skillsByIds: (ids: number[]) => ['gw2', 'skills', ids] as const,
  traits: ['gw2', 'traits'] as const,
  traitsByIds: (ids: number[]) => ['gw2', 'traits', ids] as const,
  items: (ids: number[]) => ['gw2', 'items', ids] as const,
  runes: ['gw2', 'items', 'runes'] as const,
  sigils: ['gw2', 'items', 'sigils'] as const,
  itemStats: ['gw2', 'itemstats'] as const,
  popularItemStats: ['gw2', 'itemstats', 'popular'] as const,
  specializations: ['gw2', 'specializations'] as const,
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_TIME = {
  long: 7 * 24 * 60 * 60 * 1000,    // 7 days (game data rarely changes)
  medium: 24 * 60 * 60 * 1000,      // 24 hours
  short: 5 * 60 * 1000,             // 5 minutes
}

// ============================================================================
// PROFESSIONS
// ============================================================================

/**
 * Fetch all professions
 */
export function useProfessions(): UseQueryResult<Profession[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.professions,
    queryFn: async () => {
      const response = await fetch('/api/gw2/professions')
      if (!response.ok) {
        throw new Error('Failed to fetch professions')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

/**
 * Fetch a specific profession
 */
export function useProfession(id: ProfessionId): UseQueryResult<Profession, Error> {
  return useQuery({
    queryKey: gw2QueryKeys.profession(id),
    queryFn: async () => {
      const response = await fetch(`/api/gw2/professions/${id}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch profession ${id}`)
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

// ============================================================================
// SKILLS
// ============================================================================

/**
 * Fetch all skills
 */
export function useSkills(): UseQueryResult<Skill[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.skills,
    queryFn: async () => {
      const response = await fetch('/api/gw2/skills')
      if (!response.ok) {
        throw new Error('Failed to fetch skills')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

/**
 * Fetch specific skills by IDs
 */
export function useSkillsByIds(ids: number[]): UseQueryResult<Skill[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.skillsByIds(ids),
    queryFn: async () => {
      if (ids.length === 0) return []
      const response = await fetch(`/api/gw2/skills?ids=${ids.join(',')}`)
      if (!response.ok) {
        throw new Error('Failed to fetch skills')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
    enabled: ids.length > 0,
  })
}

// ============================================================================
// TRAITS
// ============================================================================

/**
 * Fetch all traits
 */
export function useTraits(): UseQueryResult<Trait[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.traits,
    queryFn: async () => {
      const response = await fetch('/api/gw2/traits')
      if (!response.ok) {
        throw new Error('Failed to fetch traits')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

/**
 * Fetch specific traits by IDs
 */
export function useTraitsByIds(ids: number[]): UseQueryResult<Trait[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.traitsByIds(ids),
    queryFn: async () => {
      if (ids.length === 0) return []
      const response = await fetch(`/api/gw2/traits?ids=${ids.join(',')}`)
      if (!response.ok) {
        throw new Error('Failed to fetch traits')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
    enabled: ids.length > 0,
  })
}

// ============================================================================
// ITEMS
// ============================================================================

/**
 * Fetch specific items by IDs
 */
export function useItems(ids: number[]): UseQueryResult<Item[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.items(ids),
    queryFn: async () => {
      if (ids.length === 0) return []
      const response = await fetch(`/api/gw2/items?ids=${ids.join(',')}`)
      if (!response.ok) {
        throw new Error('Failed to fetch items')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
    enabled: ids.length > 0,
  })
}

/**
 * Fetch all runes
 */
export function useRunes(): UseQueryResult<Item[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.runes,
    queryFn: async () => {
      const response = await fetch('/api/gw2/items?type=runes')
      if (!response.ok) {
        throw new Error('Failed to fetch runes')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

/**
 * Fetch all sigils
 */
export function useSigils(): UseQueryResult<Item[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.sigils,
    queryFn: async () => {
      const response = await fetch('/api/gw2/items?type=sigils')
      if (!response.ok) {
        throw new Error('Failed to fetch sigils')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

// ============================================================================
// ITEMSTATS (Stat Combinations)
// ============================================================================

/**
 * Fetch all item stats
 */
export function useItemStats(): UseQueryResult<ItemStat[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.itemStats,
    queryFn: async () => {
      const response = await fetch('/api/gw2/itemstats')
      if (!response.ok) {
        throw new Error('Failed to fetch itemstats')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

/**
 * Fetch popular item stats (Berserker, Marauder, etc.)
 */
export function usePopularItemStats(): UseQueryResult<ItemStat[], Error> {
  return useQuery({
    queryKey: gw2QueryKeys.popularItemStats,
    queryFn: async () => {
      const response = await fetch('/api/gw2/itemstats?popular=true')
      if (!response.ok) {
        throw new Error('Failed to fetch popular itemstats')
      }
      return response.json()
    },
    staleTime: CACHE_TIME.long,
    gcTime: CACHE_TIME.long,
  })
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Prefetch all GW2 data for build editor
 * Call this on the build editor page to preload all necessary data
 */
export function usePrefetchBuildEditorData() {
  const { data: professions } = useProfessions()
  const { data: skills } = useSkills()
  const { data: traits } = useTraits()
  const { data: itemStats } = usePopularItemStats()
  const { data: runes } = useRunes()
  const { data: sigils } = useSigils()

  return {
    isReady: !!(professions && skills && traits && itemStats && runes && sigils),
    professions,
    skills,
    traits,
    itemStats,
    runes,
    sigils,
  }
}
