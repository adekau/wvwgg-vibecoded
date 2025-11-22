/**
 * Lambda: Fetch Items Batch
 *
 * Fetches a batch of items from GW2 API, filters them,
 * extracts modifiers, and writes to DynamoDB
 *
 * Triggered by: Step Function DistributedMap
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import type {
  EnhancedItemEntity,
  StatModifierEntity,
} from '../../lib/gw2/build-data-types';

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;
const GW2_API_BASE = process.env.GW2_API_BASE!;
const BATCH_SIZE = 25; // DynamoDB batch write limit
const GAME_VERSION = new Date().toISOString().split('T')[0];

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

interface Event {
  Items: number[]; // Array of item IDs from S3
}

interface Result {
  success: boolean;
  itemsFetched: number;
  itemsWritten: number;
  modifiersWritten: number;
  error?: string;
}

export async function handler(event: Event): Promise<Result> {
  console.log(`Processing batch of ${event.Items.length} items`);

  try {
    const itemIds = event.Items;

    // Fetch items from GW2 API
    const response = await fetch(`${GW2_API_BASE}/items?ids=${itemIds.join(',')}`);

    if (!response.ok) {
      throw new Error(`GW2 API returned ${response.status}: ${response.statusText}`);
    }

    const gw2Items = await response.json() as GW2Item[];
    console.log(`Fetched ${gw2Items.length} items from GW2 API`);

    // Filter relevant items
    const relevantItems = gw2Items.filter(isRelevantItem);
    console.log(`Filtered to ${relevantItems.length} relevant items`);

    if (relevantItems.length === 0) {
      return {
        success: true,
        itemsFetched: gw2Items.length,
        itemsWritten: 0,
        modifiersWritten: 0
      };
    }

    // Process items and extract modifiers
    const enhancedItems: EnhancedItemEntity[] = [];
    const allModifiers: StatModifierEntity[] = [];

    for (const item of relevantItems) {
      const modifiers = extractModifiersFromItem(item);
      const entity = processItem(item, modifiers);

      if (entity) {
        enhancedItems.push(entity);
        allModifiers.push(...modifiers);
      }
    }

    // Write to DynamoDB
    await batchWrite([...enhancedItems, ...allModifiers]);

    console.log(`✅ Wrote ${enhancedItems.length} items and ${allModifiers.length} modifiers`);

    return {
      success: true,
      itemsFetched: gw2Items.length,
      itemsWritten: enhancedItems.length,
      modifiersWritten: allModifiers.length
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to process batch:', errorMessage);

    return {
      success: false,
      itemsFetched: 0,
      itemsWritten: 0,
      modifiersWritten: 0,
      error: errorMessage
    };
  }
}

// ============================================================================
// FILTERING AND PROCESSING (extracted from sync-game-data.ts)
// ============================================================================

function isRelevantItem(item: GW2Item): boolean {
  // Skip account-bound items (usually duplicates or special acquisition)
  if (item.flags?.includes('AccountBound') || item.flags?.includes('SoulbindOnAcquire')) {
    return false;
  }

  // Skip items with suspicious/legacy patterns in name
  const nameLower = item.name.toLowerCase();
  if (
    nameLower.includes('(beta)') ||
    nameLower.includes('(legacy)') ||
    nameLower.includes('test ') ||
    nameLower.includes('[test]')
  ) {
    return false;
  }

  // For UpgradeComponents: Only keep Exotic/Ascended rarity
  if (item.type === 'UpgradeComponent') {
    // Only keep Superior runes/sigils (Exotic), Ascended infusions
    if (item.rarity !== 'Exotic' && item.rarity !== 'Ascended') {
      return false;
    }

    // Skip PvP-only items
    if (item.game_types && item.game_types.length === 1 && item.game_types[0] === 'Pvp') {
      return false;
    }

    const upgradeType = item.details?.type;

    // For runes: Must have "Superior Rune" in name
    if (upgradeType === 'Rune' && !item.name.includes('Superior Rune')) {
      return false;
    }

    // For sigils: Must have "Superior Sigil" in name
    if (upgradeType === 'Sigil' && !item.name.includes('Superior Sigil')) {
      return false;
    }
  }

  // For Consumables: Only keep food/utility with stat bonuses
  if (item.type === 'Consumable') {
    const consumableType = item.details?.type;

    // Only food and utility
    if (consumableType !== 'Food' && consumableType !== 'Utility') {
      return false;
    }

    // Skip low-level food (level < 80)
    if (item.level < 80) {
      return false;
    }

    // Relaxed: Accept all level 80 food/utility
    // We'll filter more intelligently later based on actual data
    return true;
  }

  return true;
}

function processItem(gw2Item: GW2Item, modifiers: StatModifierEntity[]): EnhancedItemEntity | null {
  const category = categorizeItem(gw2Item);
  if (!category) return null;

  return {
    type: 'enhanced-item',
    id: String(gw2Item.id),
    itemCategory: category,
    gw2Data: gw2Item as any,
    modifierIds: modifiers.map(m => m.id),
    lastGW2Sync: Date.now(),
    gameVersion: GAME_VERSION,
    validFrom: GAME_VERSION,
    tags: [],
  };
}

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

function extractModifiersFromItem(item: GW2Item): StatModifierEntity[] {
  const modifiers: StatModifierEntity[] = [];

  if (item.type === 'UpgradeComponent') {
    const upgradeType = item.details?.type;

    if (upgradeType === 'Rune') {
      // Extract rune bonuses (6 tiers)
      const bonuses = item.details?.bonuses || [];
      bonuses.forEach((bonus: string, index: number) => {
        const modifier = parseRuneBonus(item.id, item.name, bonus, index + 1);
        if (modifier) modifiers.push(modifier);
      });
    } else if (upgradeType === 'Sigil') {
      // Extract sigil bonus
      const description = item.description || item.details?.infix_upgrade?.buff?.description || '';
      const modifier = parseSigilBonus(item.id, item.name, description);
      if (modifier) modifiers.push(modifier);
    }
  }

  // For consumables, extract from description
  if (item.type === 'Consumable') {
    const description = item.description || '';
    const modifier = parseConsumableBonus(item.id, item.name, description, item.type);
    if (modifier) modifiers.push(modifier);
  }

  return modifiers;
}

function parseRuneBonus(itemId: number, itemName: string, bonus: string, runeCount: number): StatModifierEntity | null {
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

  return null;
}

function parseSigilBonus(itemId: number, itemName: string, description: string): StatModifierEntity | null {
  // Very basic parsing - just flag that it exists
  const stat = 'unknown';
  return {
    type: 'stat-modifier',
    id: `mod-sigil-${itemId}`,
    sourceType: 'sigil',
    sourceId: String(itemId),
    sourceName: itemName,
    targetStat: stat,
    modifierType: 'flat',
    displayText: description,
    stackable: false,
    gameVersion: GAME_VERSION,
    validFrom: GAME_VERSION,
    tags: ['sigil'],
  };
}

function parseConsumableBonus(itemId: number, itemName: string, description: string, itemType: string): StatModifierEntity | null {
  const stat = 'unknown';
  return {
    type: 'stat-modifier',
    id: `mod-consumable-${itemId}`,
    sourceType: itemType === 'Food' ? 'food' : 'utility',
    sourceId: String(itemId),
    sourceName: itemName,
    targetStat: stat,
    modifierType: 'flat',
    displayText: description,
    stackable: false,
    gameVersion: GAME_VERSION,
    validFrom: GAME_VERSION,
    tags: [itemType.toLowerCase()],
  };
}

function normalizeStatName(stat: string): string {
  const statMap: Record<string, string> = {
    'Power': 'power',
    'Precision': 'precision',
    'Ferocity': 'ferocity',
    'Condition Damage': 'conditionDamage',
    'Expertise': 'expertise',
    'Concentration': 'concentration',
    'Healing Power': 'healingPower',
    'Vitality': 'vitality',
    'Toughness': 'toughness',
  };

  return statMap[stat] || stat.toLowerCase();
}

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
  }
}
