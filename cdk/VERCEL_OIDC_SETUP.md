# Vercel OIDC Setup - Complete ✅

This document explains the Vercel OIDC (OpenID Connect) integration with AWS that's now configured for this project.

## What is Vercel OIDC?

Vercel OIDC allows your Vercel deployments to securely access AWS resources without storing long-lived credentials. Instead, Vercel provides short-lived OIDC tokens that can be exchanged for temporary AWS credentials.

## Benefits

✅ **No long-lived credentials** - No access keys to leak or rotate
✅ **Automatic token refresh** - Vercel handles token management
✅ **Officially supported** - Built-in Vercel integration
✅ **Simple setup** - Just one environment variable
✅ **Secure** - Uses cryptographic proof of identity

## Architecture

```
Vercel Function
    ↓ (OIDC Token)
AWS OIDC Identity Provider
    ↓ (validates token)
IAM Role: vercel-oidc-prod
    ↓ (temporary credentials)
DynamoDB: wvwgg-prod
```

## Infrastructure Deployed

### AWS Resources (via CDK)

1. **OIDC Identity Provider**
   - Provider URL: `https://oidc.vercel.com`
   - Audience: `https://vercel.com`
   - Thumbprint: `6938fd4d98bab03faadb97b34396831e3780aea1`

2. **IAM Role: `vercel-oidc-prod`**
   - ARN: `arn:aws:iam::774305602775:role/vercel-oidc-prod`
   - Permissions: DynamoDB read access (GetItem, Scan, Query)
   - Trust policy: Allows Vercel OIDC provider to assume the role

3. **DynamoDB Table: `wvwgg-prod`**
   - Explicit table name for consistency
   - On-demand billing

### Vercel Configuration

**Environment Variables (Production):**
- `AWS_ROLE_ARN`: `arn:aws:iam::774305602775:role/vercel-oidc-prod`
- `AWS_REGION`: `us-east-1`
- `TABLE_NAME`: `wvwgg-prod`

**Legacy credentials** (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are kept as fallback.

## Code Implementation

### Credential Provider (`server/aws-credentials.ts`)

```typescript
import { awsCredentialsProvider } from '@vercel/functions/oidc';

export function createCredentialsProvider() {
  const roleArn = process.env.AWS_ROLE_ARN;

  if (roleArn) {
    // Use Vercel OIDC (recommended)
    return awsCredentialsProvider({ roleArn });
  }

  // Fallback to legacy credentials if needed
  // ...
}
```

### Usage (`server/queries.ts`)

```typescript
import { createCredentialsProvider } from './aws-credentials';

const credentials = createCredentialsProvider();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  ...(credentials && { credentials }),
});
```

## How It Works

1. **Deployment**: When Vercel deploys your function, it generates an OIDC token
2. **Token Exchange**: The `awsCredentialsProvider` sends this token to AWS STS
3. **Validation**: AWS validates the token against the OIDC Identity Provider
4. **Credentials**: AWS returns temporary credentials (valid ~1 hour)
5. **Caching**: The provider caches credentials until expiration
6. **Renewal**: Automatically requests new credentials when needed

## Testing

### Local Development

For local development, the code falls back to legacy IAM credentials:

```bash
# .env.local
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
TABLE_NAME=wvwgg-dev
```

### Production (Vercel)

Production uses OIDC automatically via `AWS_ROLE_ARN`. No other credentials needed!

## Migration Path

Current state: **OIDC Active** ✅

- ✅ OIDC infrastructure deployed
- ✅ Vercel configured with AWS_ROLE_ARN
- ✅ Code updated to use OIDC credentials
- ✅ Legacy credentials available as fallback
- 🔄 Monitor production for successful OIDC authentication
- 🔜 Remove legacy IAM user credentials after verification

## Troubleshooting

### "Access Denied" errors

1. Verify `AWS_ROLE_ARN` is set in Vercel
2. Check the IAM role exists: `aws iam get-role --role-name vercel-oidc-prod --profile adekau`
3. Verify OIDC provider exists in AWS IAM console
4. Check CloudWatch logs for credential provider selection

### Falling back to legacy credentials

If you see "Using legacy IAM user credentials" in logs:
- `AWS_ROLE_ARN` may not be set in the deployment environment
- OIDC token exchange may be failing
- Check Vercel deployment logs for OIDC-related errors

### Role assumption fails

1. Verify the trust policy allows `oidc.vercel.com`
2. Check the audience matches `https://vercel.com`
3. Ensure the role has DynamoDB permissions

## Security Best Practices

✅ **Principle of least privilege**: Role only has read access to DynamoDB
✅ **Scoped permissions**: Access limited to specific table
✅ **Temporary credentials**: Auto-expire hourly
✅ **No credential storage**: Vercel never stores AWS credentials
✅ **Audit trail**: CloudTrail logs all role assumptions

## Maintenance

### Certificate Rotation
Not applicable - OIDC uses JWTs, not certificates. Vercel handles all token management.

### Role Updates
Update the role permissions in CDK and redeploy:

```bash
cd cdk
export WVWGG_STAGE=prod
cdk deploy WvWGG-Prod-DataLayer --profile adekau
```

### Monitoring
Monitor role usage in CloudTrail:
- Event: `AssumeRoleWithWebIdentity`
- Role: `vercel-oidc-prod`
- Principal: `oidc.vercel.com`

## Resources

- [Vercel OIDC Docs](https://vercel.com/docs/oidc/aws)
- [AWS OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [@vercel/functions Package](https://vercel.com/docs/functions/oidc)

## Support

For issues:
1. Check Vercel deployment logs
2. Check AWS CloudWatch logs for Lambda functions
3. Verify environment variables in Vercel dashboard
4. Review CloudTrail for authentication attempts
