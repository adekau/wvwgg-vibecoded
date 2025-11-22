#!/bin/bash
# verify-sync.sh - Verify that game data was synced successfully
# Usage: ./verify-sync.sh [stage] [--profile profile-name]

set -e

# Parse arguments
STAGE="prod"
AWS_PROFILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      AWS_PROFILE="--profile $2"
      shift 2
      ;;
    *)
      STAGE="$1"
      shift
      ;;
  esac
done

TABLE_NAME="wvwgg-${STAGE}"

echo "🔍 Verifying game data sync in ${TABLE_NAME}..."
if [ -n "$AWS_PROFILE" ]; then
  echo "   Using AWS profile: ${AWS_PROFILE#--profile }"
fi
echo ""

# Function to query and count
query_count() {
  local TYPE=$1
  local LABEL=$2

  COUNT=$(aws dynamodb query \
    --table-name "${TABLE_NAME}" \
    --key-condition-expression "#type = :type" \
    --expression-attribute-names '{"#type":"type"}' \
    --expression-attribute-values "{\":type\":{\"S\":\"${TYPE}\"}}" \
    --select COUNT \
    ${AWS_PROFILE} \
    --output json | jq -r .Count)

  printf "  %-25s %5d items\n" "${LABEL}:" "${COUNT}" >&2

  echo "${COUNT}"
}

# Function to query GSI and count
query_gsi_count() {
  local INDEX=$1
  local KEY=$2
  local VALUE=$3
  local LABEL=$4

  COUNT=$(aws dynamodb query \
    --table-name "${TABLE_NAME}" \
    --index-name "${INDEX}" \
    --key-condition-expression "${KEY} = :value" \
    --expression-attribute-values "{\":value\":{\"S\":\"${VALUE}\"}}" \
    --select COUNT \
    ${AWS_PROFILE} \
    --output json | jq -r .Count)

  printf "  %-25s %5d items\n" "${LABEL}:" "${COUNT}" >&2

  echo "${COUNT}"
}

# Check each entity type
echo "📊 Entity Counts:"
echo ""

ITEMSTATS=$(query_count "itemstat" "ItemStats")
ITEMS=$(query_count "enhanced-item" "Enhanced Items")
MODIFIERS=$(query_count "stat-modifier" "Stat Modifiers")
FORMULAS=$(query_count "stat-formula" "Stat Formulas")
VERSIONS=$(query_count "game-version" "Game Versions")

echo ""
echo "📦 Items by Category (using GSI):"
echo ""

RUNES=$(query_gsi_count "itemCategory-gameVersion-index" "itemCategory" "rune" "Runes")
SIGILS=$(query_gsi_count "itemCategory-gameVersion-index" "itemCategory" "sigil" "Sigils")
INFUSIONS=$(query_gsi_count "itemCategory-gameVersion-index" "itemCategory" "infusion" "Infusions")
FOOD=$(query_gsi_count "itemCategory-gameVersion-index" "itemCategory" "food" "Food")
UTILITY=$(query_gsi_count "itemCategory-gameVersion-index" "itemCategory" "utility" "Utility")

echo ""
echo "📋 Sample Data:"
echo ""

# Get Berserker stats (most common stat combo)
echo "  Berserker Stats (id: 584):"
BERSERKER=$(aws dynamodb get-item \
  --table-name "${TABLE_NAME}" \
  --key '{"type":{"S":"itemstat"},"id":{"S":"584"}}' \
  ${AWS_PROFILE} \
  --output json 2>/dev/null | jq -r '.Item.name.S // "Not found"')

if [ "$BERSERKER" = "Berserker" ]; then
  echo "    ✅ Found: Berserker"
else
  echo "    ❌ Not found or incorrect"
fi

# Get Scholar Rune (most popular rune)
echo "  Superior Rune of the Scholar (id: 24836):"
SCHOLAR=$(aws dynamodb get-item \
  --table-name "${TABLE_NAME}" \
  --key '{"type":{"S":"enhanced-item"},"id":{"S":"24836"}}' \
  ${AWS_PROFILE} \
  --output json 2>/dev/null | jq -r '.Item.gw2Data.M.name.S // "Not found"')

if [ "$SCHOLAR" = "Superior Rune of the Scholar" ]; then
  echo "    ✅ Found: $SCHOLAR"
else
  echo "    ❌ Not found or incorrect"
fi

# Get Critical Chance formula
echo "  Critical Chance Formula:"
CRIT_FORMULA=$(aws dynamodb get-item \
  --table-name "${TABLE_NAME}" \
  --key '{"type":{"S":"stat-formula"},"id":{"S":"formula-critChance"}}' \
  ${AWS_PROFILE} \
  --output json 2>/dev/null | jq -r '.Item.baseFormula.S // "Not found"')

if [ "$CRIT_FORMULA" = "(precision - 895) / 21" ]; then
  echo "    ✅ Found: $CRIT_FORMULA"
else
  echo "    ❌ Not found or incorrect"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify expected counts
TOTAL_ISSUES=0

if [ "$ITEMSTATS" -lt 100 ]; then
  echo "⚠️  Warning: Expected ~150 itemstats, found $ITEMSTATS"
  TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
fi

if [ "$ITEMS" -lt 300 ]; then
  echo "⚠️  Warning: Expected ~450 items, found $ITEMS"
  TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
fi

if [ "$MODIFIERS" -lt 500 ]; then
  echo "⚠️  Warning: Expected ~1000 modifiers, found $MODIFIERS"
  TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
fi

if [ "$FORMULAS" -ne 7 ]; then
  echo "⚠️  Warning: Expected 7 formulas, found $FORMULAS"
  TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
fi

if [ "$VERSIONS" -lt 1 ]; then
  echo "❌ Error: No game version found!"
  TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
fi

if [ "$TOTAL_ISSUES" -eq 0 ]; then
  echo "✅ All checks passed! Game data sync successful."
  echo ""
  echo "Database is ready for:"
  echo "  - Bidirectional build editor"
  echo "  - Propagator network implementation"
  echo "  - Gear ↔ Stats calculations"
  echo ""
  echo "Next steps:"
  echo "  1. Review docs/BUILD_DATABASE_SCHEMA.md"
  echo "  2. Implement propagator engine (lib/propagators/)"
  echo "  3. Build bidirectional build editor UI"
else
  echo ""
  echo "⚠️  Found $TOTAL_ISSUES issue(s). To check CloudWatch Logs:"
  echo ""
  echo "First, find the Lambda function name:"
  if [ -n "$AWS_PROFILE" ]; then
    echo "    aws lambda list-functions ${AWS_PROFILE} --query \"Functions[?contains(FunctionName, 'SyncGameData')].FunctionName\""
    echo ""
    echo "Then tail the logs:"
    echo "    aws logs tail /aws/lambda/FUNCTION_NAME --follow ${AWS_PROFILE}"
    echo ""
    echo "To re-run sync:"
    echo "    ./scripts/invoke-sync.sh ${STAGE} ${AWS_PROFILE}"
  else
    echo "    aws lambda list-functions --query \"Functions[?contains(FunctionName, 'SyncGameData')].FunctionName\""
    echo ""
    echo "Then tail the logs:"
    echo "    aws logs tail /aws/lambda/FUNCTION_NAME --follow"
    echo ""
    echo "To re-run sync:"
    echo "    ./scripts/invoke-sync.sh ${STAGE}"
  fi
fi

echo ""
