/**
 * Guild Wars 2 API v2 Client
 * Handles all communication with the official GW2 API
 */

import type {
  Profession,
  Specialization,
  Trait,
  Skill,
  Item,
  ItemStat,
  ProfessionId,
} from './types'

const GW2_API_BASE = 'https://api.guildwars2.com/v2'

/**
 * Rate limiting and caching configuration
 */
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const REQUEST_TIMEOUT_MS = 10000 // 10 seconds

/**
 * Generic fetch wrapper with error handling
 */
async function fetchGW2API<T>(endpoint: string, ids?: string | number[]): Promise<T> {
  const url = new URL(`${GW2_API_BASE}${endpoint}`)

  if (ids) {
    if (Array.isArray(ids)) {
      url.searchParams.set('ids', ids.join(','))
    } else {
      url.searchParams.set('ids', ids)
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`GW2 API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('GW2 API request timeout')
      }
      throw error
    }
    throw new Error('Unknown error fetching from GW2 API')
  }
}

/**
 * Batch fetch with automatic chunking for large ID lists
 * GW2 API has a limit of ~200 IDs per request
 */
async function fetchBatch<T>(
  endpoint: string,
  ids: number[],
  chunkSize = 200
): Promise<T[]> {
  const chunks: number[][] = []

  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    chunks.map(chunk => fetchGW2API<T[]>(endpoint, chunk))
  )

  return results.flat()
}

// ============================================================================
// PROFESSIONS
// ============================================================================

export async function getAllProfessions(): Promise<ProfessionId[]> {
  return fetchGW2API<ProfessionId[]>('/professions')
}

export async function getProfession(id: ProfessionId): Promise<Profession> {
  return fetchGW2API<Profession>(`/professions/${id}`)
}

export async function getAllProfessionDetails(): Promise<Profession[]> {
  const ids = await getAllProfessions()
  return Promise.all(ids.map(id => getProfession(id)))
}

// ============================================================================
// SPECIALIZATIONS
// ============================================================================

export async function getAllSpecializationIds(): Promise<number[]> {
  return fetchGW2API<number[]>('/specializations')
}

export async function getSpecialization(id: number): Promise<Specialization> {
  return fetchGW2API<Specialization>(`/specializations/${id}`)
}

export async function getSpecializations(ids: number[]): Promise<Specialization[]> {
  if (ids.length === 0) return []
  return fetchBatch<Specialization>('/specializations', ids)
}

export async function getAllSpecializations(): Promise<Specialization[]> {
  const ids = await getAllSpecializationIds()
  return getSpecializations(ids)
}

export async function getEliteSpecializations(): Promise<Specialization[]> {
  const all = await getAllSpecializations()
  return all.filter(spec => spec.elite)
}

// ============================================================================
// TRAITS
// ============================================================================

export async function getAllTraitIds(): Promise<number[]> {
  return fetchGW2API<number[]>('/traits')
}

export async function getTrait(id: number): Promise<Trait> {
  return fetchGW2API<Trait>(`/traits/${id}`)
}

export async function getTraits(ids: number[]): Promise<Trait[]> {
  if (ids.length === 0) return []
  return fetchBatch<Trait>('/traits', ids)
}

export async function getAllTraits(): Promise<Trait[]> {
  const ids = await getAllTraitIds()
  return getTraits(ids)
}

// ============================================================================
// SKILLS
// ============================================================================

export async function getAllSkillIds(): Promise<number[]> {
  return fetchGW2API<number[]>('/skills')
}

export async function getSkill(id: number): Promise<Skill> {
  return fetchGW2API<Skill>(`/skills/${id}`)
}

export async function getSkills(ids: number[]): Promise<Skill[]> {
  if (ids.length === 0) return []
  return fetchBatch<Skill>('/skills', ids)
}

export async function getAllSkills(): Promise<Skill[]> {
  const ids = await getAllSkillIds()
  return getSkills(ids)
}

// ============================================================================
// ITEMS
// ============================================================================

export async function getAllItemIds(): Promise<number[]> {
  return fetchGW2API<number[]>('/items')
}

export async function getItem(id: number): Promise<Item> {
  return fetchGW2API<Item>(`/items/${id}`)
}

export async function getItems(ids: number[]): Promise<Item[]> {
  if (ids.length === 0) return []
  return fetchBatch<Item>('/items', ids)
}

/**
 * Get popular runes (upgrade components for armor)
 * Using curated list to avoid fetching all items
 */
export async function getAllRunes(): Promise<Item[]> {
  // Popular runes for WvW and PvE
  const popularRuneIds = [
    24836, // Superior Rune of the Scholar
    24818, // Superior Rune of the Eagle
    24688, // Superior Rune of Strength
    24765, // Superior Rune of the Thief
    24762, // Superior Rune of the Pack
    83338, // Superior Rune of the Dragonhunter
    84171, // Superior Rune of Durability
    70600, // Superior Rune of the Chronomancer
    72339, // Superior Rune of Leadership
    24723, // Superior Rune of the Air
    24815, // Superior Rune of the Ranger
    24764, // Superior Rune of the Trapper
    24754, // Superior Rune of the Fire
    24842, // Superior Rune of Divinity
    67339, // Superior Rune of the Deadeye
    83284, // Superior Rune of the Firebrand
    84191, // Superior Rune of the Scourge
    91541, // Superior Rune of the Citadel
    100916, // Superior Rune of the Tempest
    70600,  // Superior Rune of the Chronomancer
    86180,  // Superior Rune of the Herald
  ]

  return getItems(popularRuneIds)
}

/**
 * Get popular sigils (upgrade components for weapons)
 * Using curated list to avoid fetching all items
 */
export async function getAllSigils(): Promise<Item[]> {
  // Popular sigils for WvW and PvE
  const popularSigilIds = [
    24615, // Superior Sigil of Force
    24868, // Superior Sigil of Accuracy
    24554, // Superior Sigil of Air
    24609, // Superior Sigil of Fire
    24599, // Superior Sigil of Earth
    24583, // Superior Sigil of Blood
    24618, // Superior Sigil of Geomancy
    24624, // Superior Sigil of Impact
    48911, // Superior Sigil of Concentration
    44944, // Superior Sigil of Agility
    74326, // Superior Sigil of Bursting
    24567, // Superior Sigil of Benevolence
    24624, // Superior Sigil of Impact
    24868, // Superior Sigil of Accuracy
    44950, // Superior Sigil of Draining
    24580, // Superior Sigil of Bloodlust
    24648, // Superior Sigil of Perception
    24582, // Superior Sigil of Centaur Slaying
    24639, // Superior Sigil of Malice
    84505, // Superior Sigil of Absorption
    72339, // Superior Sigil of Energy
    24661, // Superior Sigil of Stamina
  ]

  return getItems(popularSigilIds)
}

/**
 * Search items by name
 */
export async function searchItems(query: string): Promise<Item[]> {
  // The GW2 API doesn't have a built-in search, so we need to fetch all items
  // and filter. In production, we'd cache this data.
  const allIds = await getAllItemIds()
  const items = await fetchBatch<Item>('/items', allIds)

  const lowerQuery = query.toLowerCase()
  return items.filter(item =>
    item.name.toLowerCase().includes(lowerQuery)
  )
}

// ============================================================================
// ITEMSTATS (Stat Combinations)
// ============================================================================

export async function getAllItemStatIds(): Promise<number[]> {
  return fetchGW2API<number[]>('/itemstats')
}

export async function getItemStat(id: number): Promise<ItemStat> {
  return fetchGW2API<ItemStat>(`/itemstats/${id}`)
}

export async function getItemStats(ids: number[]): Promise<ItemStat[]> {
  if (ids.length === 0) return []
  return fetchBatch<ItemStat>('/itemstats', ids)
}

export async function getAllItemStats(): Promise<ItemStat[]> {
  const ids = await getAllItemStatIds()
  return getItemStats(ids)
}

/**
 * Get popular stat combinations for build editor
 */
export async function getPopularItemStats(): Promise<ItemStat[]> {
  // Common stat combos that players use
  const popularIds = [
    584,  // Berserker's
    1163, // Marauder
    656,  // Assassin's
    1125, // Viper's
    1064, // Sinister
    753,  // Rabid
    1118, // Grieving
    1134, // Minstrel's
    1115, // Commander's
    1119, // Marshal's
    1220, // Diviner's
    1153, // Harrier
    1162, // Plaguedoctor's
    588,  // Cleric's
    590,  // Dire
    591,  // Knight's
    592,  // Nomad's
    593,  // Rabid
    594,  // Rampager's
    595,  // Sentinel's
    596,  // Settler's
    597,  // Shaman's
    598,  // Soldier's
    599,  // Valkyrie
    1128, // Celestial
  ]

  return getItemStats(popularIds)
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if API is accessible
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    await fetchGW2API<{ id: string }>('/build')
    return true
  } catch {
    return false
  }
}

/**
 * Get current game build ID
 */
export async function getGameBuild(): Promise<number> {
  const response = await fetchGW2API<{ id: number }>('/build')
  return response.id
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all skills for a specific profession
 */
export async function getSkillsForProfession(profession: ProfessionId): Promise<Skill[]> {
  const allSkills = await getAllSkills()
  return allSkills.filter(skill =>
    skill.professions?.includes(profession)
  )
}

/**
 * Get weapon skills for a specific weapon type
 */
export async function getWeaponSkills(
  profession: ProfessionId,
  weaponType: string
): Promise<Skill[]> {
  const allSkills = await getAllSkills()
  return allSkills.filter(skill =>
    skill.professions?.includes(profession) &&
    skill.weapon_type === weaponType
  )
}

/**
 * Get traits for a specific specialization
 */
export async function getTraitsForSpecialization(specId: number): Promise<Trait[]> {
  const allTraits = await getAllTraits()
  return allTraits.filter(trait => trait.specialization === specId)
}
