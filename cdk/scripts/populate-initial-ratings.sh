#!/bin/bash

# Script to populate initial Glicko-2 ratings for alliance guilds
# This is a one-time setup script that initializes default ratings for guilds without ratings

set -e

# Configuration
STAGE="${1:-dev}"  # Default to dev if not specified
DRY_RUN="${2:-true}"  # Default to dry run

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== Populate Initial Glicko-2 Ratings =====${NC}"
echo "Stage: ${STAGE}"
echo "Dry Run: ${DRY_RUN}"
echo ""

# Get Lambda function name
FUNCTION_NAME="WvWGG-${STAGE}-WvWGGPopulateInitialGlickoRatingsLambda-${STAGE}"

echo -e "${YELLOW}Looking for Lambda function: ${FUNCTION_NAME}${NC}"

# Check if function exists
if ! aws lambda get-function --function-name "${FUNCTION_NAME}" &>/dev/null; then
    echo -e "${RED}Error: Lambda function not found${NC}"
    echo "Expected function name: ${FUNCTION_NAME}"
    echo ""
    echo "Make sure you've deployed the CDK stack first:"
    echo "  cd cdk && cdk deploy WvWGG-${STAGE}-DataLayer"
    exit 1
fi

echo -e "${GREEN}Found Lambda function${NC}"
echo ""

# Create payload
PAYLOAD="{\"dryRun\": ${DRY_RUN}}"

echo -e "${YELLOW}Invoking Lambda function...${NC}"
echo "Payload: ${PAYLOAD}"
echo ""

# Invoke Lambda
RESPONSE=$(aws lambda invoke \
    --function-name "${FUNCTION_NAME}" \
    --payload "${PAYLOAD}" \
    --cli-binary-format raw-in-base64-out \
    /dev/stdout 2>&1)

# Extract response
LAMBDA_OUTPUT=$(echo "${RESPONSE}" | sed -n '/^{/,/^}$/p' | head -n -1)
STATUS_CODE=$(echo "${RESPONSE}" | tail -n 1 | jq -r '.StatusCode // empty')

echo ""
echo -e "${GREEN}===== Lambda Response =====${NC}"

if [ -n "${LAMBDA_OUTPUT}" ]; then
    echo "${LAMBDA_OUTPUT}" | jq '.'
else
    echo "${RESPONSE}"
fi

echo ""

if [ "${STATUS_CODE}" == "200" ]; then
    echo -e "${GREEN}✓ Lambda invocation successful${NC}"

    if [ "${DRY_RUN}" == "true" ]; then
        echo ""
        echo -e "${YELLOW}This was a DRY RUN - no changes were made${NC}"
        echo "To actually populate ratings, run:"
        echo "  ./scripts/populate-initial-ratings.sh ${STAGE} false"
    else
        echo ""
        echo -e "${GREEN}✓ Initial ratings have been populated!${NC}"
    fi
else
    echo -e "${RED}✗ Lambda invocation failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}===== Complete =====${NC}"
