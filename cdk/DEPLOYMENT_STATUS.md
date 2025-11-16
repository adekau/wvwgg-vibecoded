# Deployment Status

## ✅ Completed

### Infrastructure (CDK)
- [x] Explicit DynamoDB table names (`wvwgg-prod`, `wvwgg-dev`)
- [x] Lambda functions with historical snapshot tracking
- [x] EventBridge rules (60s for matches, 24h for worlds)
- [x] **Vercel OIDC Integration** (Recommended - ACTIVE):
  - AWS OIDC Identity Provider
  - IAM Role (`vercel-oidc-prod`) with DynamoDB access
  - No certificates or long-lived credentials needed
- [x] Legacy IAM user (fallback for local development)
- [x] Circular dependency fix

### Application Features
- [x] Real-time updates (60-second auto-refresh)
- [x] Enhanced match details (rankings, K/D ratios, activity levels)
- [x] Live objectives tracking (30-second refresh)
- [x] Match history with charts (24h, 3d, 7d views)
- [x] Historical data storage (hourly snapshots, 7-day TTL)

### Security & Authentication
- [x] Vercel OIDC credential provider implemented
- [x] AWS SDK integration with OIDC
- [x] Environment variables configured
- [x] Legacy credential fallback for local dev

### Scripts & Documentation
- [x] Vercel OIDC setup guide (`VERCEL_OIDC_SETUP.md`)
- [x] Deployment status tracking
- [x] ~~Certificate generation script~~ (replaced by OIDC)

## 🔄 In Progress

### Monitoring & Validation
- [ ] Monitor production deployment for OIDC authentication
- [ ] Verify no errors in CloudWatch logs
- [ ] Check CloudTrail for successful role assumptions

## 📋 Next Steps

### Immediate (Verification)
1. Deploy to Vercel and verify OIDC works:
   ```bash
   vercel --prod
   ```

2. Check application logs for:
   ```
   "Using Vercel OIDC credentials provider"
   ```

3. Verify DynamoDB access works without errors

4. Monitor CloudTrail for:
   - Event: `AssumeRoleWithWebIdentity`
   - Role: `vercel-oidc-prod`
   - Status: Success

### Optional (Future Enhancement)
5. After OIDC verification, consider removing legacy IAM user:
   - Remove AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from Vercel
   - Keep legacy user only for local development

6. Set up CloudWatch alarms for:
   - Failed OIDC authentication attempts
   - DynamoDB throttling errors
   - Lambda errors

## Current Configuration

### AWS Resources
- **OIDC Provider**: `https://oidc.vercel.com`
- **IAM Role**: `arn:aws:iam::774305602775:role/vercel-oidc-prod`
- **DynamoDB Tables**:
  - Dev: `wvwgg-dev`
  - Prod: `wvwgg-prod`

### Vercel Environment Variables (Production)

**Active (OIDC):**
```env
AWS_ROLE_ARN=arn:aws:iam::774305602775:role/vercel-oidc-prod
AWS_REGION=us-east-1
TABLE_NAME=wvwgg-prod
```

**Fallback (Legacy):**
```env
AWS_ACCESS_KEY_ID=... (still configured for fallback)
AWS_SECRET_ACCESS_KEY=... (still configured for fallback)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js App (Edge/Node Runtime)                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Credential Provider                            │  │  │
│  │  │  1. OIDC (production) ✅                        │  │  │
│  │  │  2. Legacy IAM (fallback)                       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┼───────────────────────────────────────┘
                     │
            ┌────────┴────────┐
            │  OIDC Token     │
            │  Exchange       │
            └────────┬────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  AWS OIDC Provider      │
        │  (oidc.vercel.com)      │
        └─────────────┬───────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │  IAM Role               │
        │  vercel-oidc-prod       │
        │  (temp credentials)     │
        └─────────────┬───────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │  DynamoDB               │
        │  wvwgg-prod             │
        │  (read access)          │
        └─────────────────────────┘
```

## Removed/Deprecated

- ❌ IAM Roles Anywhere infrastructure (replaced by simpler OIDC)
- ❌ X.509 certificates (not needed with OIDC)
- ❌ Certificate generation scripts (not needed with OIDC)
- ❌ Complex credential signing logic (handled by Vercel)

## Migration History

1. **Initial**: IAM user with access keys
2. **Attempt**: IAM Roles Anywhere with X.509 certificates
3. **Final**: Vercel OIDC (current - simplest and most secure) ✅
