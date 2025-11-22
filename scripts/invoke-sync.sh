#!/bin/bash
# invoke-sync.sh - Invoke the Sync Game Data Lambda

set -e

STAGE="${1:-prod}"
FUNCTION_NAME="WvWGGSyncGameDataLambda-${STAGE}"

echo "🚀 Invoking ${FUNCTION_NAME}..."
echo ""
echo "This will:"
echo "  - Fetch ~150 itemstats from GW2 API"
echo "  - Fetch ~450 items (runes, sigils, infusions, food)"
echo "  - Extract ~1,000 stat modifiers"
echo "  - Create 7 bidirectional stat formulas"
echo "  - Write ~1.6 MB to DynamoDB"
echo ""
echo "Expected duration: 5-8 minutes"
echo ""
read -p "Press ENTER to continue..."

# Invoke Lambda
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  --log-type Tail \
  response.json

echo ""
echo "✅ Lambda invoked successfully!"
echo ""
echo "Response:"
cat response.json | jq .
echo ""

# Check if successful
SUCCESS=$(cat response.json | jq -r .success)

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Sync completed successfully!"
  echo ""
  echo "Summary:"
  cat response.json | jq '{
    itemStatsProcessed,
    itemsProcessed,
    modifiersExtracted,
    formulasCreated,
    duration: (.duration / 1000 | tostring + "s")
  }'
  echo ""
  echo "Next steps:"
  echo "  1. Run ./verify-sync.sh to verify data"
  echo "  2. Check docs/SYNC_GAME_DATA.md for queries"
  echo "  3. Start building propagator engine"
else
  echo "❌ Sync failed!"
  echo ""
  echo "Errors:"
  cat response.json | jq .errors
  echo ""
  echo "Check CloudWatch Logs for details:"
  echo "  aws logs tail /aws/lambda/${FUNCTION_NAME} --follow"
fi

# Clean up
rm response.json
