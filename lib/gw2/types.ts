/**
 * TypeScript interfaces for Guild Wars 2 API v2 data
 * Based on official GW2 API documentation
 */

// ============================================================================
// PROFESSIONS & SPECIALIZATIONS
// ============================================================================

export type ProfessionId =
  | 'Guardian'
  | 'Warrior'
  | 'Engineer'
  | 'Ranger'
  | 'Thief'
  | 'Elementalist'
  | 'Mesmer'
  | 'Necromancer'
  | 'Revenant'

export interface Profession {
  id: ProfessionId
  name: string
  code: number
  icon: string
  icon_big: string
  specializations: number[]  // Specialization IDs
  weapons: Record<string, ProfessionWeapon>
  flags: string[]
  skills: ProfessionSkillsBySlot[]
  training: ProfessionTraining[]
}

export interface ProfessionWeapon {
  flags: ('Mainhand' | 'Offhand' | 'TwoHand' | 'Aquatic')[]
  skills: ProfessionWeaponSkill[]
  specialization?: number
}

export interface ProfessionWeaponSkill {
  id: number
  slot: 'Weapon_1' | 'Weapon_2' | 'Weapon_3' | 'Weapon_4' | 'Weapon_5'
  offhand?: string
  attunement?: string
}

export interface ProfessionSkillsBySlot {
  slot: 'Heal' | 'Utility' | 'Elite'
  skills: number[]
}

export interface ProfessionTraining {
  id: number
  category: 'Skills' | 'Specializations' | 'EliteSpecializations'
  name: string
  track: ProfessionTrainingTrack[]
}

export interface ProfessionTrainingTrack {
  cost: number
  type: 'Skill' | 'Trait'
  skill_id?: number
  trait_id?: number
}

export interface Specialization {
  id: number
  name: string
  profession: ProfessionId
  elite: boolean
  icon: string
  background: string
  minor_traits: number[]
  major_traits: number[]
  weapon_trait?: number
}

// ============================================================================
// TRAITS
// ============================================================================

export interface Trait {
  id: number
  tier: 1 | 2 | 3
  order: 0 | 1 | 2
  name: string
  description: string
  slot: 'Major' | 'Minor'
  facts?: TraitFact[]
  traited_facts?: TraitFact[]
  skills?: TraitSkill[]
  specialization: number
  icon?: string
}

export interface TraitFact {
  text: string
  type: string
  icon?: string
  // Varies by type - can include damage, duration, radius, etc.
  [key: string]: any
}

export interface TraitSkill {
  id: number
  name: string
  description: string
  facts?: TraitFact[]
  icon: string
}

// ============================================================================
// SKILLS
// ============================================================================

export type SkillSlot =
  | 'Weapon_1' | 'Weapon_2' | 'Weapon_3' | 'Weapon_4' | 'Weapon_5'
  | 'Heal'
  | 'Utility'
  | 'Elite'
  | 'Profession_1' | 'Profession_2' | 'Profession_3' | 'Profession_4' | 'Profession_5'
  | 'Downed_1' | 'Downed_2' | 'Downed_3' | 'Downed_4'
  | 'Pet'

export type SkillType =
  | 'Profession'
  | 'Heal'
  | 'Utility'
  | 'Elite'
  | 'Weapon'
  | 'Bundle'
  | 'Toolbelt'
  | 'Pet'

export interface Skill {
  id: number
  name: string
  description: string
  icon: string
  chat_link: string
  type?: SkillType
  weapon_type?: string
  professions?: ProfessionId[]
  slot?: SkillSlot
  facts?: SkillFact[]
  traited_facts?: SkillFact[]
  categories?: string[]
  attunement?: string
  cost?: number
  dual_wield?: string
  flip_skill?: number
  initiative?: number
  next_chain?: number
  prev_chain?: number
  specialization?: number
  dual_attunement?: string
}

export interface SkillFact {
  text: string
  type: SkillFactType
  icon?: string
  // Type-specific fields
  damage?: number
  hit_count?: number
  dmg_multiplier?: number
  distance?: number
  duration?: number
  apply_count?: number
  status?: string
  description?: string
  percent?: number
  [key: string]: any
}

export type SkillFactType =
  | 'AttributeAdjust'
  | 'Buff'
  | 'ComboField'
  | 'ComboFinisher'
  | 'Damage'
  | 'Distance'
  | 'Duration'
  | 'Heal'
  | 'HealingAdjust'
  | 'NoData'
  | 'Number'
  | 'Percent'
  | 'PrefixedBuff'
  | 'Radius'
  | 'Range'
  | 'Recharge'
  | 'StunBreak'
  | 'Time'
  | 'Unblockable'

// ============================================================================
// ITEMS (GEAR, RUNES, SIGILS)
// ============================================================================

export type ItemRarity = 'Junk' | 'Common' | 'Fine' | 'Masterwork' | 'Rare' | 'Exotic' | 'Ascended' | 'Legendary'

export type ItemType =
  | 'Armor'
  | 'Back'
  | 'Trinket'
  | 'Weapon'
  | 'UpgradeComponent'
  | 'Consumable'

export type ArmorSlot = 'Helm' | 'Shoulders' | 'Coat' | 'Gloves' | 'Leggings' | 'Boots'
export type TrinketSlot = 'Accessory' | 'Amulet' | 'Ring'
export type WeaponSlot = 'MainHand' | 'OffHand' | 'TwoHand'

export interface Item {
  id: number
  chat_link: string
  name: string
  icon: string
  description?: string
  type: ItemType
  rarity: ItemRarity
  level: number
  vendor_value: number
  flags: string[]
  game_types: string[]
  restrictions: string[]

  // Type-specific details
  details?: ItemDetails
}

export type ItemDetails =
  | ArmorDetails
  | WeaponDetails
  | TrinketDetails
  | UpgradeComponentDetails
  | ConsumableDetails

export interface ArmorDetails {
  type: 'Boots' | 'Coat' | 'Gloves' | 'Helm' | 'Leggings' | 'Shoulders'
  weight_class: 'Heavy' | 'Medium' | 'Light'
  defense: number
  infusion_slots: InfusionSlot[]
  infix_upgrade?: InfixUpgrade
  suffix_item_id?: number
  secondary_suffix_item_id?: string
  stat_choices?: number[]
}

export interface WeaponDetails {
  type: string  // 'Axe', 'Sword', 'Staff', etc.
  damage_type: 'Physical' | 'Fire' | 'Ice' | 'Lightning' | 'Choking'
  min_power: number
  max_power: number
  defense: number
  infusion_slots: InfusionSlot[]
  infix_upgrade?: InfixUpgrade
  suffix_item_id?: number
  secondary_suffix_item_id?: string
  stat_choices?: number[]
}

export interface TrinketDetails {
  type: 'Accessory' | 'Amulet' | 'Ring'
  infusion_slots: InfusionSlot[]
  infix_upgrade?: InfixUpgrade
  suffix_item_id?: number
  secondary_suffix_item_id?: string
  stat_choices?: number[]
}

export interface UpgradeComponentDetails {
  type: 'Rune' | 'Sigil' | 'Gem'
  flags: ('HeavyArmor' | 'MediumArmor' | 'LightArmor' | 'Trinket' | 'Sword' | 'Axe')[]
  infusion_upgrade_flags: string[]
  suffix: string
  infix_upgrade?: InfixUpgrade
  bonuses?: string[]
}

export interface ConsumableDetails {
  type: 'Food' | 'Utility' | 'Generic' | 'Unlock'
  description?: string
  duration_ms?: number
  apply_count?: number
  name?: string
  icon?: string
  skins?: number[]
}

export interface InfusionSlot {
  flags: ('Enrichment' | 'Infusion' | 'Defense' | 'Offense' | 'Utility' | 'Agony')[]
  item_id?: number
}

export interface InfixUpgrade {
  id: number
  attributes: ItemAttribute[]
  buff?: ItemBuff
}

export interface ItemAttribute {
  attribute: AttributeType
  modifier: number
}

export type AttributeType =
  | 'Power'
  | 'Precision'
  | 'Toughness'
  | 'Vitality'
  | 'ConditionDamage'
  | 'ConditionDuration'
  | 'Healing'
  | 'BoonDuration'
  | 'CritDamage'
  | 'AgonyResistance'

export interface ItemBuff {
  skill_id: number
  description?: string
}

// ============================================================================
// ITEMSTATS (Stat Combinations like Berserker, Marauder)
// ============================================================================

export interface ItemStat {
  id: number
  name: string
  attributes: ItemStatAttribute[]
}

export interface ItemStatAttribute {
  attribute: AttributeType
  multiplier: number
  value: number
}

// ============================================================================
// BUILDS (Custom data structure for our application)
// ============================================================================

export interface Build {
  id: string                    // build-{uuid}
  userId?: string               // Optional for anonymous builds
  createdAt: number
  updatedAt: number
  name: string
  description?: string
  profession: ProfessionId
  specializations: SpecializationSelection[]
  skills: SkillSelection
  gear: GearSelection
  food?: number                 // Consumable item ID
  utility?: number              // Consumable item ID
  isPublic: boolean
  tags: string[]
  viewCount: number
  likeCount: number
}

export interface SpecializationSelection {
  id: number                    // Specialization ID
  traits: [number, number, number]  // 3 major trait choices (adept, master, grandmaster)
}

export interface SkillSelection {
  heal: number
  utility1: number
  utility2: number
  utility3: number
  elite: number
  aquaticHeal?: number
  aquaticUtility1?: number
  aquaticUtility2?: number
  aquaticUtility3?: number
  aquaticElite?: number
}

export interface GearSelection {
  helm: GearPiece
  shoulders: GearPiece
  coat: GearPiece
  gloves: GearPiece
  leggings: GearPiece
  boots: GearPiece
  amulet: GearPiece
  ring1: GearPiece
  ring2: GearPiece
  accessory1: GearPiece
  accessory2: GearPiece
  backItem: GearPiece
  relic: GearPiece
  weaponSet1Main: WeaponPiece
  weaponSet1Off?: WeaponPiece
  weaponSet2Main?: WeaponPiece
  weaponSet2Off?: WeaponPiece
  aquaticWeapon?: WeaponPiece
}

export interface GearPiece {
  itemId?: number               // Specific item (for unique items)
  statId: number                // ItemStat ID (Berserker, Marauder, etc.)
  rarity: ItemRarity
  upgradeId?: number            // Rune ID
  infusions: number[]           // Infusion item IDs
}

export interface WeaponPiece extends GearPiece {
  weaponType: WeaponType        // Weapon type (Sword, Axe, Staff, etc.)
  upgradeId?: number            // Sigil ID (can have 2 for two-handed)
  upgrade2Id?: number           // Second sigil for two-handed weapons
}

// ============================================================================
// CALCULATED STATS
// ============================================================================

export interface BaseStats {
  power: number
  precision: number
  toughness: number
  vitality: number
  ferocity: number
  conditionDamage: number
  expertise: number              // Condition Duration
  concentration: number          // Boon Duration
  healingPower: number
  agonyResistance: number
}

export interface DerivedStats {
  critChance: number             // (Precision - 895) / 21
  critDamage: number             // 1.5 + Ferocity / 1500
  health: number                 // Base health + (Vitality * 10)
  armor: number                  // Base armor + Toughness
  boonDuration: number           // Concentration / 1500
  conditionDuration: number      // Expertise / 1500
}

export interface CalculatedStats extends BaseStats, DerivedStats {
  // Advanced metrics
  effectivePower: number         // Power × (1 + CritChance × (CritDamage - 1))
  effectiveHealth: number        // Health × (Armor / 1000)
  effectiveHealthPower: number   // EP × EH

  // DPS estimates
  weaponDPS?: number             // Skill-based DPS calculation
  conditionDPS?: number          // Condition damage over time

  // Sustain metrics
  healingPerSecond?: number
  barrierGeneration?: number
}

// ============================================================================
// PROFESSION BASE STATS
// ============================================================================

export interface ProfessionBaseStats {
  profession: ProfessionId
  baseHealth: number
  baseArmor: number
  basePower: number
  basePrecision: number
  baseToughness: number
  baseVitality: number
}

// Base stats per profession at level 80
export const PROFESSION_BASE_STATS: Record<ProfessionId, ProfessionBaseStats> = {
  Guardian: {
    profession: 'Guardian',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Warrior: {
    profession: 'Warrior',
    baseHealth: 1922,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Engineer: {
    profession: 'Engineer',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Ranger: {
    profession: 'Ranger',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Thief: {
    profession: 'Thief',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Elementalist: {
    profession: 'Elementalist',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Mesmer: {
    profession: 'Mesmer',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Necromancer: {
    profession: 'Necromancer',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
  Revenant: {
    profession: 'Revenant',
    baseHealth: 1645,
    baseArmor: 967,
    basePower: 1000,
    basePrecision: 1000,
    baseToughness: 1000,
    baseVitality: 1000,
  },
}

// ============================================================================
// WEAPONS
// ============================================================================

export type WeaponType =
  // Two-handed weapons
  | 'Greatsword'
  | 'Hammer'
  | 'Longbow'
  | 'Rifle'
  | 'Shortbow'
  | 'Staff'
  // One-handed weapons
  | 'Axe'
  | 'Dagger'
  | 'Mace'
  | 'Pistol'
  | 'Scepter'
  | 'Sword'
  // Off-hand only
  | 'Focus'
  | 'Shield'
  | 'Torch'
  | 'Warhorn'
  // Aquatic weapons
  | 'Harpoon Gun'
  | 'Spear'
  | 'Trident'

export const TWO_HANDED_WEAPONS: WeaponType[] = [
  'Greatsword',
  'Hammer',
  'Longbow',
  'Rifle',
  'Shortbow',
  'Staff',
  'Harpoon Gun',
  'Spear',
  'Trident',
]

export const OFF_HAND_ONLY_WEAPONS: WeaponType[] = [
  'Focus',
  'Shield',
  'Torch',
  'Warhorn',
]

export const MAIN_HAND_WEAPONS: WeaponType[] = [
  'Axe',
  'Dagger',
  'Mace',
  'Pistol',
  'Scepter',
  'Sword',
]

export function isTwoHandedWeapon(weaponType: string): boolean {
  return TWO_HANDED_WEAPONS.includes(weaponType as WeaponType)
}

export function isOffHandOnly(weaponType: string): boolean {
  return OFF_HAND_ONLY_WEAPONS.includes(weaponType as WeaponType)
}

// ============================================================================
// GAME DATA CACHE
// ============================================================================

export interface GameDataCache {
  id: string                    // e.g., 'profession-Guardian', 'skill-12345'
  type: 'profession' | 'skill' | 'trait' | 'item' | 'specialization' | 'itemstat'
  data: any                     // The actual API data
  lastUpdated: number           // Timestamp
  ttl: number                   // DynamoDB TTL for auto-expiration
}

// ============================================================================
// OPTIMIZATION
// ============================================================================

export type OptimizationGoalType =
  | 'maximize-ep'
  | 'maximize-eh'
  | 'maximize-ehp'
  | 'maximize-dps'
  | 'custom'

export interface OptimizationGoal {
  type: OptimizationGoalType
  customFormula?: string
  constraints: OptimizationConstraint[]
}

export interface OptimizationConstraint {
  stat: keyof BaseStats | keyof DerivedStats
  min?: number
  max?: number
  target?: number
}

export interface OptimizationOptions {
  allowedRarities: ItemRarity[]
  allowedStatCombos?: number[]
  useInfusions: boolean
  infusionType?: 'power' | 'precision' | 'versatile'
  maxInfusionCost?: number
  includeFood: boolean
  includeUtility: boolean
}

export interface OptimizedGear {
  gear: GearSelection
  stats: CalculatedStats
  improvements: {
    effectivePower: number
    effectiveHealth: number
    effectiveHealthPower: number
  }
  cost?: number
  achievable: boolean
  message?: string
}
