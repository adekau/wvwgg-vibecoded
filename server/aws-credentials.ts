import { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { awsCredentialsProvider } from '@vercel/functions/oidc';

/**
 * Creates AWS credentials provider that supports:
 * 1. Vercel OIDC (recommended) - uses AWS_ROLE_ARN
 * 2. Legacy IAM user credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 */
export function createCredentialsProvider(): AwsCredentialIdentityProvider | undefined {
  // Check for Vercel OIDC (recommended)
  const roleArn = process.env.AWS_ROLE_ARN;

  if (roleArn) {
    return awsCredentialsProvider({ roleArn });
  }

  // Fall back to legacy IAM user credentials
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return async () => ({
      accessKeyId,
      secretAccessKey,
    });
  }

  // Let AWS SDK use default credential chain
  return undefined;
}
