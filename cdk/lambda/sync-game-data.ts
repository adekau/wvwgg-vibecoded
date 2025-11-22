/**
 * Lambda: Sync Game Data from GW2 API
 *
 * Fetches and processes game data from GW2 API and stores in DynamoDB:
 * - ItemStats (stat combinations like Berserker, Marauder)
 * - Items (runes, sigils, infusions, food, utility)
 * - Stat Modifiers (extracted from items)
 * - Stat Formulas (for propagator network)
 *
 * Triggered: Manual or scheduled (daily)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import type {
  ItemStatEntity,
  EnhancedItemEntity,
  StatModifierEntity,
  StatFormulaEntity,
  GameVersionEntity,
} from '../../lib/gw2/build-data-types';

// ============================================================================
// TYPES
// ============================================================================

interface GW2ItemStat {
  id: number;
  name: string;
  attributes: Array<{
    attribute: string;
    multiplier: number;
    value: number;
  }>;
}

interface GW2Item {
  id: number;
  name: string;
  description?: string;
  type: string;
  rarity: string;
  level: number;
  icon: string;
  details?: any;
  flags: string[];
  game_types: string[];
}

interface SyncResult {
  success: boolean;
  itemStatsProcessed: number;
  itemsProcessed: number;
  modifiersExtracted: number;
  formulasCreated: number;
  errors: string[];
  duration: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GW2_API_BASE = 'https://api.guildwars2.com/v2';
const BATCH_SIZE = 25; // DynamoDB batch write limit
const GAME_VERSION = new Date().toISOString().split('T')[0]; // Current date as version

// ============================================================================
// DYNAMODB CLIENT
// ============================================================================

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

// ============================================================================
// GW2 API HELPERS
// ============================================================================

async function fetchFromGW2API<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${GW2_API_BASE}${endpoint}`);

  if (!response.ok) {
    throw new Error(`GW2 API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchAllItemStats(): Promise<GW2ItemStat[]> {
  console.log('Fetching itemstats from GW2 API...');

  // Get all itemstat IDs
  const ids = await fetchFromGW2API<number[]>('/itemstats');
  console.log(`Found ${ids.length} itemstats`);

  // Fetch in batches (GW2 API supports ?ids=1,2,3)
  const batchSize = 200;
  const itemStats: GW2ItemStat[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchData = await fetchFromGW2API<GW2ItemStat[]>(
      `/itemstats?ids=${batch.join(',')}`
    );
    itemStats.push(...batchData);

    console.log(`Fetched ${itemStats.length}/${ids.length} itemstats`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return itemStats;
}

async function fetchItemsByType(type: 'UpgradeComponent' | 'Consumable'): Promise<GW2Item[]> {
  console.log(`Fetching items of type ${type}...`);

  // Search for items by type
  const response = await fetch(`${GW2_API_BASE}/items?type=${type}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} items`);
  }

  const ids = await response.json() as number[];
  console.log(`Found ${ids.length} ${type} items`);

  // Fetch in batches
  const batchSize = 200;
  const items: GW2Item[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchData = await fetchFromGW2API<GW2Item[]>(
      `/items?ids=${batch.join(',')}`
    );
    items.push(...batchData);

    console.log(`Fetched ${items.length}/${ids.length} ${type} items`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return items;
}

// ============================================================================
// ITEMSTAT PROCESSING
// ============================================================================

function processItemStat(gw2ItemStat: GW2ItemStat): ItemStatEntity {
  return {
    type: 'itemstat',
    id: String(gw2ItemStat.id),
    name: gw2ItemStat.name,
    attributes: gw2ItemStat.attributes,
    lastGW2Sync: Date.now(),
    gameVersion: GAME_VERSION,
    isPvE: true,
    isPvP: true,
    isWvW: true,
    // Add aliases for common stat names
    aliases: getStatAliases(gw2ItemStat.name),
    buildTypes: inferBuildTypes(gw2ItemStat),
    metaRating: inferMetaRating(gw2ItemStat.name),
  };
}

function getStatAliases(name: string): string[] {
  const aliasMap: Record<string, string[]> = {
    'Berserker': ['Zerk', 'Zerker'],
    'Assassin': ['Assassins', 'Sins'],
    'Marauder': ['Mara'],
    'Valkyrie': ['Valk'],
    'Celestial': ['Cele', 'Celes'],
  };

  return aliasMap[name] || [];
}

function inferBuildTypes(itemStat: GW2ItemStat): string[] {
  const types: string[] = [];
  const attrs = itemStat.attributes.map(a => a.attribute.toLowerCase());

  if (attrs.includes('power') && attrs.includes('precision')) {
    types.push('power-dps');
  }
  if (attrs.includes('conditiondamage')) {
    types.push('condition-dps');
  }
  if (attrs.includes('toughness') || attrs.includes('vitality')) {
    types.push('defensive');
  }
  if (attrs.includes('healingpower')) {
    types.push('support');
  }
  if (types.length > 1) {
    types.push('hybrid');
  }

  return types;
}

function inferMetaRating(name: string): number {
  // Common meta stat combos get higher ratings
  const metaStats: Record<string, number> = {
    'Berserker': 5,
    'Marauder': 5,
    'Assassin': 4,
    'Valkyrie': 4,
    'Diviner': 5,
    'Celestial': 4,
    'Trailblazer': 4,
    'Viper': 5,
  };

  return metaStats[name] || 3;
}

// ============================================================================
// ITEM PROCESSING & CATEGORIZATION
// ============================================================================

function categorizeItem(item: GW2Item): EnhancedItemEntity['itemCategory'] | null {
  if (item.type === 'UpgradeComponent') {
    const upgradeType = item.details?.type;
    if (upgradeType === 'Rune') return 'rune';
    if (upgradeType === 'Sigil') return 'sigil';
    if (upgradeType === 'Gem') return 'infusion';
  }

  if (item.type === 'Consumable') {
    const consumableType = item.details?.type;
    if (consumableType === 'Food') return 'food';
    if (consumableType === 'Utility') return 'utility';
  }

  return null;
}

function processItem(gw2Item: GW2Item, modifiers: StatModifierEntity[]): EnhancedItemEntity | null {
  const category = categorizeItem(gw2Item);
  if (!category) return null;

  // Extract stat types from the item
  const statTypes = extractStatTypes(gw2Item);

  return {
    type: 'enhanced-item',
    id: String(gw2Item.id),
    gw2Data: gw2Item,
    itemCategory: category,
    modifiers: modifiers.map(m => m.id),
    lastGW2Sync: Date.now(),
    gameVersion: GAME_VERSION,
    statTypes,
    maxStatValue: calculateMaxStatValue(gw2Item),
  };
}

function extractStatTypes(item: GW2Item): string[] {
  const types = new Set<string>();

  // From bonuses (runes/sigils)
  if (item.details?.bonuses) {
    for (const bonus of item.details.bonuses) {
      const match = bonus.match(/\+\d+\s+(\w+(?:\s+\w+)?)/);
      if (match) {
        types.add(match[1]);
      }
    }
  }

  // From infix_upgrade (infusions)
  if (item.details?.infix_upgrade?.attributes) {
    for (const attr of item.details.infix_upgrade.attributes) {
      types.add(attr.attribute);
    }
  }

  return Array.from(types);
}

function calculateMaxStatValue(item: GW2Item): number {
  let maxValue = 0;

  // Parse bonuses for numeric values
  if (item.details?.bonuses) {
    for (const bonus of item.details.bonuses) {
      const match = bonus.match(/\+(\d+)/);
      if (match) {
        const value = parseInt(match[1]);
        if (value > maxValue) maxValue = value;
      }
    }
  }

  return maxValue;
}

// ============================================================================
// MODIFIER EXTRACTION
// ============================================================================

function extractModifiersFromItem(item: GW2Item): StatModifierEntity[] {
  const modifiers: StatModifierEntity[] = [];
  const category = categorizeItem(item);
  if (!category) return modifiers;

  // Extract from runes (have piece count requirements)
  if (category === 'rune' && item.details?.bonuses) {
    item.details.bonuses.forEach((bonus: string, index: number) => {
      const modifier = parseRuneBonus(
        item.id,
        item.name,
        bonus,
        index + 1 // Rune count (1-6)
      );
      if (modifier) modifiers.push(modifier);
    });
  }

  // Extract from sigils
  if (category === 'sigil' && item.details?.bonuses) {
    item.details.bonuses.forEach((bonus: string) => {
      const modifier = parseSigilBonus(item.id, item.name, bonus);
      if (modifier) modifiers.push(modifier);
    });
  }

  // Extract from infusions
  if (category === 'infusion' && item.details?.infix_upgrade?.attributes) {
    item.details.infix_upgrade.attributes.forEach((attr: any) => {
      const modifier = parseInfusionAttribute(
        item.id,
        item.name,
        attr.attribute,
        attr.modifier
      );
      if (modifier) modifiers.push(modifier);
    });
  }

  // Extract from food/utility
  if ((category === 'food' || category === 'utility') && item.details?.bonuses) {
    item.details.bonuses.forEach((bonus: string) => {
      const modifier = parseConsumableBonus(
        item.id,
        item.name,
        bonus,
        category
      );
      if (modifier) modifiers.push(modifier);
    });
  }

  return modifiers;
}

function parseRuneBonus(
  itemId: number,
  itemName: string,
  bonus: string,
  runeCount: number
): StatModifierEntity | null {
  // Pattern: "+25 Power"
  const flatMatch = bonus.match(/\+(\d+)\s+(\w+(?:\s+\w+)?)/);
  if (flatMatch) {
    const value = parseInt(flatMatch[1]);
    const stat = normalizeStatName(flatMatch[2]);

    return {
      type: 'stat-modifier',
      id: `mod-rune-${itemId}-${stat}-${runeCount}`,
      sourceType: 'rune',
      sourceId: String(itemId),
      sourceName: itemName,
      targetStat: stat,
      modifierType: 'flat',
      flatValue: value,
      runeCount,
      displayText: bonus,
      stackable: false,
      gameVersion: GAME_VERSION,
      validFrom: GAME_VERSION,
      tags: [stat.toLowerCase(), 'rune'],
    };
  }

  // Pattern: "+10% Might Duration"
  const percentMatch = bonus.match(/\+(\d+)%\s+(\w+(?:\s+\w+)?)/);
  if (percentMatch) {
    const value = parseInt(percentMatch[1]);
    const stat = normalizeStatName(percentMatch[2]);

    return {
      type: 'stat-modifier',
      id: `mod-rune-${itemId}-${stat}-${runeCount}`,
      sourceType: 'rune',
      sourceId: String(itemId),
      sourceName: itemName,
      targetStat: stat,
      modifierType: 'percentage',
      percentValue: value,
      runeCount,
      displayText: bonus,
      stackable: false,
      gameVersion: GAME_VERSION,
      validFrom: GAME_VERSION,
      tags: [stat.toLowerCase(), 'rune'],
    };
  }

  // Pattern: "+5% damage while health >=90%"
  const conditionalMatch = bonus.match(/\+(\d+)%\s+(\w+).*?(>=|>|<=|<|==)\s*(\d+)%?/);
  if (conditionalMatch) {
    const value = parseInt(conditionalMatch[1]);
    const stat = normalizeStatName(conditionalMatch[2]);
    const operator = conditionalMatch[3] as any;
    const threshold = parseInt(conditionalMatch[4]);

    return {
      type: 'stat-modifier',
      id: `mod-rune-${itemId}-${stat}-${runeCount}`,
      sourceType: 'rune',
      sourceId: String(itemId),
      sourceName: itemName,
      targetStat: stat === 'damage' ? 'damageMultiplier' : stat,
      modifierType: 'conditional',
      percentValue: value,
      conditions: [{
        type: 'health',
        operator,
        value: threshold,
        description: bonus,
      }],
      runeCount,
      displayText: bonus,
      stackable: false,
      gameVersion: GAME_VERSION,
      validFrom: GAME_VERSION,
      tags: [stat.toLowerCase(), 'conditional', 'rune'],
      isMeta: runeCount === 6, // 6-piece bonuses are often meta-defining
    };
  }

  return null;
}

function parseSigilBonus(
  itemId: number,
  itemName: string,
  bonus: string
): StatModifierEntity | null {
  // Similar to rune parsing but without runeCount
  const flatMatch = bonus.match(/\+(\d+)\s+(\w+(?:\s+\w+)?)/);
  if (flatMatch) {
    const value = parseInt(flatMatch[1]);
    const stat = normalizeStatName(flatMatch[2]);

    return {
      type: 'stat-modifier',
      id: `mod-sigil-${itemId}-${stat}`,
      sourceType: 'sigil',
      sourceId: String(itemId),
      sourceName: itemName,
      targetStat: stat,
      modifierType: 'flat',
      flatValue: value,
      displayText: bonus,
      stackable: false,
      gameVersion: GAME_VERSION,
      validFrom: GAME_VERSION,
      tags: [stat.toLowerCase(), 'sigil'],
    };
  }

  // "+5% Critical Chance"
  const percentMatch = bonus.match(/\+(\d+)%\s+(?:Critical|Crit)\s+(?:Chance|Damage)/i);
  if (percentMatch) {
    const value = parseInt(percentMatch[1]);

    // Convert to stat: crit chance -> precision, crit damage -> ferocity
    const isCritChance = bonus.toLowerCase().includes('chance');
    const stat = isCritChance ? 'precision' : 'ferocity';

    // Convert: 1% crit chance = 21 precision, 1% crit damage = 15 ferocity
    const flatValue = isCritChance ? value * 21 : value * 15;

    return {
      type: 'stat-modifier',
      id: `mod-sigil-${itemId}-${stat}`,
      sourceType: 'sigil',
      sourceId: String(itemId),
      sourceName: itemName,
      targetStat: stat,
      modifierType: 'flat',
      flatValue,
      displayText: bonus,
      stackable: false,
      gameVersion: GAME_VERSION,
      validFrom: GAME_VERSION,
      tags: [stat, 'sigil'],
    };
  }

  return null;
}

function parseInfusionAttribute(
  itemId: number,
  itemName: string,
  attribute: string,
  value: number
): StatModifierEntity | null {
  const stat = normalizeStatName(attribute);

  return {
    type: 'stat-modifier',
    id: `mod-infusion-${itemId}-${stat}`,
    sourceType: 'infusion',
    sourceId: String(itemId),
    sourceName: itemName,
    targetStat: stat,
    modifierType: 'flat',
    flatValue: value,
    displayText: `+${value} ${attribute}`,
    stackable: true, // Infusions stack
    maxStacks: 18, // Max infusion slots
    stackType: 'intensity',
    gameVersion: GAME_VERSION,
    validFrom: GAME_VERSION,
    tags: [stat.toLowerCase(), 'infusion'],
  };
}

function parseConsumableBonus(
  itemId: number,
  itemName: string,
  bonus: string,
  category: 'food' | 'utility'
): StatModifierEntity | null {
  // Similar to sigil parsing
  const flatMatch = bonus.match(/\+(\d+)\s+(\w+(?:\s+\w+)?)/);
  if (flatMatch) {
    const value = parseInt(flatMatch[1]);
    const stat = normalizeStatName(flatMatch[2]);

    return {
      type: 'stat-modifier',
      id: `mod-${category}-${itemId}-${stat}`,
      sourceType: category,
      sourceId: String(itemId),
      sourceName: itemName,
      targetStat: stat,
      modifierType: 'flat',
      flatValue: value,
      displayText: bonus,
      stackable: false,
      uniqueGroup: category, // Food and utility don't stack with same type
      gameVersion: GAME_VERSION,
      validFrom: GAME_VERSION,
      tags: [stat.toLowerCase(), category],
    };
  }

  return null;
}

function normalizeStatName(stat: string): string {
  const map: Record<string, string> = {
    'Power': 'power',
    'Precision': 'precision',
    'Toughness': 'toughness',
    'Vitality': 'vitality',
    'Ferocity': 'ferocity',
    'Condition Damage': 'conditionDamage',
    'Expertise': 'expertise',
    'Concentration': 'concentration',
    'Healing Power': 'healingPower',
    'Might Duration': 'concentration',
    'Boon Duration': 'concentration',
    'Condition Duration': 'expertise',
    'Agony Resistance': 'agonyResistance',
  };

  return map[stat] || stat.toLowerCase().replace(/\s+/g, '');
}

// ============================================================================
// STAT FORMULAS
// ============================================================================

function createStatFormulas(): StatFormulaEntity[] {
  const formulas: StatFormulaEntity[] = [];

  // Critical Chance
  formulas.push({
    type: 'stat-formula',
    id: 'formula-critChance',
    stat: 'critChance',
    category: 'derived',
    baseFormula: '(precision - 895) / 21',
    bidirectionalFormulas: {
      forward: '(precision - 895) / 21',
      inverse: ['critChance * 21 + 895'],
    },
    forwardFunction: '(precision) => Math.min(100, Math.max(0, (precision - 895) / 21))',
    inverseFunctions: ['(critChance) => critChance * 21 + 895'],
    inputStats: ['precision'],
    affectedBy: ['mod-sigil-*-precision', 'mod-trait-*-precision'],
    displayFormula: 'Critical Chance = (Precision - 895) / 21',
    displayName: 'Critical Chance',
    explanation: 'Each point of Precision above 895 grants 1/21 = 0.0476% critical chance. Maximum 100%.',
    unit: '%',
    minValue: 0,
    maxValue: 100,
    gameVersion: GAME_VERSION,
    validFrom: '2012-08-28',
    tags: ['combat', 'offensive', 'critical'],
    importance: 5,
  });

  // Critical Damage
  formulas.push({
    type: 'stat-formula',
    id: 'formula-critDamage',
    stat: 'critDamage',
    category: 'derived',
    baseFormula: '1.5 + (ferocity / 1500)',
    bidirectionalFormulas: {
      forward: '1.5 + (ferocity / 1500)',
      inverse: ['(critDamage - 1.5) * 1500'],
    },
    forwardFunction: '(ferocity) => 1.5 + ferocity / 1500',
    inverseFunctions: ['(critDamage) => (critDamage - 1.5) * 1500'],
    inputStats: ['ferocity'],
    affectedBy: ['mod-sigil-*-ferocity', 'mod-trait-*-ferocity'],
    displayFormula: 'Critical Damage = 1.5 + (Ferocity / 1500)',
    displayName: 'Critical Damage',
    explanation: 'Base critical damage is 150%. Each 15 points of Ferocity adds 1% critical damage.',
    unit: 'x',
    minValue: 1.5,
    gameVersion: GAME_VERSION,
    validFrom: '2014-04-15',
    tags: ['combat', 'offensive', 'critical'],
    importance: 5,
  });

  // Effective Power
  formulas.push({
    type: 'stat-formula',
    id: 'formula-effectivePower',
    stat: 'effectivePower',
    category: 'effective',
    baseFormula: 'power * (1 + (critChance / 100) * (critDamage - 1))',
    bidirectionalFormulas: {
      forward: 'power * (1 + (critChance / 100) * (critDamage - 1))',
      inverse: [
        'effectivePower / (1 + (critChance / 100) * (critDamage - 1))',
        '((effectivePower / power - 1) / (critDamage - 1)) * 100',
        '(effectivePower / power - 1) / (critChance / 100) + 1',
      ],
    },
    forwardFunction: '(power, critChance, critDamage) => power * (1 + (critChance / 100) * (critDamage - 1))',
    inverseFunctions: [
      '(ep, critChance, critDamage) => ep / (1 + (critChance / 100) * (critDamage - 1))',
      '(ep, power, critDamage) => ((ep / power - 1) / (critDamage - 1)) * 100',
      '(ep, power, critChance) => (ep / power - 1) / (critChance / 100) + 1',
    ],
    inputStats: ['power', 'critChance', 'critDamage'],
    affectedBy: [],
    displayFormula: 'Effective Power = Power × (1 + Crit% × (Crit Damage - 1))',
    displayName: 'Effective Power',
    explanation: 'Average damage multiplier accounting for critical hits. Higher is better for DPS.',
    gameVersion: GAME_VERSION,
    validFrom: '2012-08-28',
    tags: ['combat', 'offensive', 'metric'],
    importance: 5,
  });

  // Health
  formulas.push({
    type: 'stat-formula',
    id: 'formula-health',
    stat: 'health',
    category: 'derived',
    baseFormula: 'baseHealth + (vitality * 10)',
    bidirectionalFormulas: {
      forward: 'baseHealth + (vitality * 10)',
      inverse: ['(health - baseHealth) / 10'],
    },
    forwardFunction: '(baseHealth, vitality) => baseHealth + vitality * 10',
    inverseFunctions: ['(health, baseHealth) => (health - baseHealth) / 10'],
    inputStats: ['vitality'],
    affectedBy: ['mod-*-vitality'],
    displayFormula: 'Health = Base Health + (Vitality × 10)',
    displayName: 'Health',
    explanation: 'Each point of Vitality grants 10 health points. Base health varies by profession.',
    gameVersion: GAME_VERSION,
    validFrom: '2012-08-28',
    tags: ['defensive', 'survivability'],
    importance: 4,
  });

  // Armor
  formulas.push({
    type: 'stat-formula',
    id: 'formula-armor',
    stat: 'armor',
    category: 'derived',
    baseFormula: 'baseArmor + toughness',
    bidirectionalFormulas: {
      forward: 'baseArmor + toughness',
      inverse: ['armor - baseArmor'],
    },
    forwardFunction: '(baseArmor, toughness) => baseArmor + toughness',
    inverseFunctions: ['(armor, baseArmor) => armor - baseArmor'],
    inputStats: ['toughness'],
    affectedBy: ['mod-*-toughness'],
    displayFormula: 'Armor = Base Armor + Toughness',
    displayName: 'Armor',
    explanation: 'Each point of Toughness adds 1 armor. Base armor varies by profession.',
    gameVersion: GAME_VERSION,
    validFrom: '2012-08-28',
    tags: ['defensive', 'survivability'],
    importance: 4,
  });

  // Boon Duration
  formulas.push({
    type: 'stat-formula',
    id: 'formula-boonDuration',
    stat: 'boonDuration',
    category: 'derived',
    baseFormula: '(concentration / 1500) * 100',
    bidirectionalFormulas: {
      forward: '(concentration / 1500) * 100',
      inverse: ['(boonDuration / 100) * 1500'],
    },
    forwardFunction: '(concentration) => (concentration / 1500) * 100',
    inverseFunctions: ['(boonDuration) => (boonDuration / 100) * 1500'],
    inputStats: ['concentration'],
    affectedBy: ['mod-*-concentration'],
    displayFormula: 'Boon Duration = (Concentration / 1500) × 100',
    displayName: 'Boon Duration',
    explanation: 'Each 15 points of Concentration grants 1% boon duration.',
    unit: '%',
    gameVersion: GAME_VERSION,
    validFrom: '2015-06-23',
    tags: ['support', 'boon'],
    importance: 4,
  });

  // Condition Duration
  formulas.push({
    type: 'stat-formula',
    id: 'formula-conditionDuration',
    stat: 'conditionDuration',
    category: 'derived',
    baseFormula: '(expertise / 1500) * 100',
    bidirectionalFormulas: {
      forward: '(expertise / 1500) * 100',
      inverse: ['(conditionDuration / 100) * 1500'],
    },
    forwardFunction: '(expertise) => (expertise / 1500) * 100',
    inverseFunctions: ['(conditionDuration) => (conditionDuration / 100) * 1500'],
    inputStats: ['expertise'],
    affectedBy: ['mod-*-expertise'],
    displayFormula: 'Condition Duration = (Expertise / 1500) × 100',
    displayName: 'Condition Duration',
    explanation: 'Each 15 points of Expertise grants 1% condition duration.',
    unit: '%',
    gameVersion: GAME_VERSION,
    validFrom: '2015-06-23',
    tags: ['combat', 'condition'],
    importance: 4,
  });

  return formulas;
}

// ============================================================================
// DYNAMODB HELPERS
// ============================================================================

async function batchWrite(items: any[]): Promise<void> {
  if (items.length === 0) return;

  // Split into batches of 25 (DynamoDB limit)
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    }));

    console.log(`Wrote batch ${i / BATCH_SIZE + 1}/${Math.ceil(items.length / BATCH_SIZE)}`);
  }
}

async function createGameVersion(
  itemStatsCount: number,
  itemsCount: number,
  modifiersCount: number,
  formulasCount: number
): Promise<void> {
  const versionEntity: GameVersionEntity = {
    type: 'game-version',
    id: `version-${GAME_VERSION}`,
    versionNumber: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    patchDate: GAME_VERSION,
    changes: [{
      type: 'item',
      action: 'added',
      entityId: 'initial-sync',
      description: `Initial sync: ${itemStatsCount} itemstats, ${itemsCount} items, ${modifiersCount} modifiers, ${formulasCount} formulas`,
    }],
    modifiedFormulas: [],
    modifiedModifiers: [],
    newItems: [],
    removedItems: [],
    dataStatus: 'complete',
    syncStarted: Date.now(),
    syncCompleted: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'system',
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: versionEntity,
  }));

  console.log(`Created game version record: ${GAME_VERSION}`);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(event: any): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log('Starting game data sync...');

  try {
    // 1. Fetch ItemStats
    console.log('\n=== PHASE 1: ItemStats ===');
    const gw2ItemStats = await fetchAllItemStats();
    const itemStatEntities = gw2ItemStats.map(processItemStat);
    await batchWrite(itemStatEntities);
    console.log(`✅ Synced ${itemStatEntities.length} itemstats`);

    // 2. Fetch Upgrade Components (Runes, Sigils, Infusions)
    console.log('\n=== PHASE 2: Upgrade Components ===');
    const upgradeComponents = await fetchItemsByType('UpgradeComponent');

    // Process upgrade components and extract modifiers
    const upgradeEntities: EnhancedItemEntity[] = [];
    const upgradeModifiers: StatModifierEntity[] = [];

    for (const item of upgradeComponents) {
      const modifiers = extractModifiersFromItem(item);
      const entity = processItem(item, modifiers);

      if (entity) {
        upgradeEntities.push(entity);
        upgradeModifiers.push(...modifiers);
      }
    }

    await batchWrite(upgradeEntities);
    console.log(`✅ Synced ${upgradeEntities.length} upgrade components`);

    // 3. Fetch Consumables (Food, Utility)
    console.log('\n=== PHASE 3: Consumables ===');
    const consumables = await fetchItemsByType('Consumable');

    const consumableEntities: EnhancedItemEntity[] = [];
    const consumableModifiers: StatModifierEntity[] = [];

    for (const item of consumables) {
      const modifiers = extractModifiersFromItem(item);
      const entity = processItem(item, modifiers);

      if (entity) {
        consumableEntities.push(entity);
        consumableModifiers.push(...modifiers);
      }
    }

    await batchWrite(consumableEntities);
    console.log(`✅ Synced ${consumableEntities.length} consumables`);

    // 4. Write Modifiers
    console.log('\n=== PHASE 4: Modifiers ===');
    const allModifiers = [...upgradeModifiers, ...consumableModifiers];
    await batchWrite(allModifiers);
    console.log(`✅ Synced ${allModifiers.length} modifiers`);

    // 5. Create Stat Formulas
    console.log('\n=== PHASE 5: Stat Formulas ===');
    const formulas = createStatFormulas();
    await batchWrite(formulas);
    console.log(`✅ Created ${formulas.length} stat formulas`);

    // 6. Create Game Version Record
    console.log('\n=== PHASE 6: Game Version ===');
    await createGameVersion(
      itemStatEntities.length,
      upgradeEntities.length + consumableEntities.length,
      allModifiers.length,
      formulas.length
    );

    const duration = Date.now() - startTime;

    console.log(`\n✅ Sync complete in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      itemStatsProcessed: itemStatEntities.length,
      itemsProcessed: upgradeEntities.length + consumableEntities.length,
      modifiersExtracted: allModifiers.length,
      formulasCreated: formulas.length,
      errors,
      duration,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Sync failed:', errorMessage);
    errors.push(errorMessage);

    return {
      success: false,
      itemStatsProcessed: 0,
      itemsProcessed: 0,
      modifiersExtracted: 0,
      formulasCreated: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }
}
