# Build System Scripts

Helper scripts for managing the GW2 build system data sync.

## Scripts

### `invoke-sync.sh`

Invokes the Sync Game Data Lambda to populate DynamoDB with GW2 game data.

**Usage:**
```bash
# Default (prod, default AWS credentials)
./scripts/invoke-sync.sh

# With specific stage
./scripts/invoke-sync.sh dev

# With AWS SSO profile
./scripts/invoke-sync.sh prod --profile my-sso-profile

# Stage + profile
./scripts/invoke-sync.sh dev --profile my-dev-profile
```

**What it does:**
- Invokes `WvWGGSyncGameDataLambda-{stage}`
- Fetches ~150 itemstats from GW2 API
- Fetches ~450 items (runes, sigils, infusions, food)
- Extracts ~1,000 stat modifiers
- Creates 7 bidirectional stat formulas
- Writes ~1.6 MB to DynamoDB

**Duration:** ~5-8 minutes

**Output:**
```json
{
  "success": true,
  "itemStatsProcessed": 150,
  "itemsProcessed": 450,
  "modifiersExtracted": 1000,
  "formulasCreated": 7,
  "duration": 324567
}
```

---

### `verify-sync.sh`

Verifies that game data was synced successfully to DynamoDB.

**Usage:**
```bash
# Default (prod, default AWS credentials)
./scripts/verify-sync.sh

# With specific stage
./scripts/verify-sync.sh dev

# With AWS SSO profile
./scripts/verify-sync.sh prod --profile my-sso-profile

# Stage + profile
./scripts/verify-sync.sh dev --profile my-dev-profile
```

**What it checks:**
- Entity counts for all data types
- GSI queries (items by category)
- Sample data (Berserker stats, Scholar Rune, formulas)
- Validates expected counts

**Output:**
```
📊 Entity Counts:

  ItemStats:                  150 items
  Enhanced Items:             450 items
  Stat Modifiers:            1000 items
  Stat Formulas:                7 items
  Game Versions:                1 items

📦 Items by Category (using GSI):

  Runes:                       80 items
  Sigils:                     120 items
  Infusions:                   50 items
  Food:                       100 items
  Utility:                    100 items

📋 Sample Data:

  Berserker Stats (id: 584):
    ✅ Found: Berserker
  Superior Rune of the Scholar (id: 24836):
    ✅ Found: Superior Rune of the Scholar
  Critical Chance Formula:
    ✅ Found: (precision - 895) / 21

✅ All checks passed! Game data sync successful.
```

---

## AWS SSO Profile Setup

If you're using AWS SSO, configure your profile in `~/.aws/config`:

```ini
[profile my-sso-profile]
sso_start_url = https://my-company.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = AdministratorAccess
region = us-east-1
```

Then login:
```bash
aws sso login --profile my-sso-profile
```

Use the profile with scripts:
```bash
./scripts/invoke-sync.sh prod --profile my-sso-profile
./scripts/verify-sync.sh prod --profile my-sso-profile
```

---

## Common Workflows

### Initial Data Sync

```bash
# 1. Invoke sync
./scripts/invoke-sync.sh prod --profile my-profile

# 2. Verify data
./scripts/verify-sync.sh prod --profile my-profile
```

### Re-sync After Balance Patch

```bash
# Just re-run the sync (idempotent)
./scripts/invoke-sync.sh prod --profile my-profile
```

### Troubleshooting

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/WvWGGSyncGameDataLambda-prod --follow --profile my-profile
```

**Query DynamoDB Directly:**
```bash
# Count itemstats
aws dynamodb query \
  --table-name wvwgg-prod \
  --key-condition-expression "#type = :type" \
  --expression-attribute-names '{"#type":"type"}' \
  --expression-attribute-values '{":type":{"S":"itemstat"}}' \
  --select COUNT \
  --profile my-profile

# Get Berserker stats
aws dynamodb get-item \
  --table-name wvwgg-prod \
  --key '{"type":{"S":"itemstat"},"id":{"S":"584"}}' \
  --profile my-profile | jq .
```

---

## Documentation

- **Full Guide**: `docs/SYNC_GAME_DATA.md`
- **Database Schema**: `docs/BUILD_DATABASE_SCHEMA.md`
- **Setup Summary**: `docs/BUILD_SYSTEM_SETUP.md`

---

## Support

For issues or questions:
- Check `docs/SYNC_GAME_DATA.md` for troubleshooting
- Open a GitHub issue
- Review CloudWatch Logs for detailed error messages
