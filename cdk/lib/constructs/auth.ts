import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthConstructProps {
  stage: 'dev' | 'prod';
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    // Create Cognito User Pool for admin authentication
    this.userPool = new cognito.UserPool(this, `GuildsAdminUserPool-${props.stage}`, {
      userPoolName: `wvwgg-guilds-admins-${props.stage}`,
      selfSignUpEnabled: false, // Disable public signup - invite-only
      signInAliases: {
        username: true,
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create app client for Next.js
    this.userPoolClient = this.userPool.addClient(`WebClient-${props.stage}`, {
      userPoolClientName: `wvwgg-web-client-${props.stage}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // Outputs for environment variables
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: `Cognito User Pool ID for ${props.stage}`,
      exportName: `WvWGG-UserPoolId-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: `Cognito User Pool Client ID for ${props.stage}`,
      exportName: `WvWGG-UserPoolClientId-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: `Cognito User Pool ARN for ${props.stage}`,
    });
  }
}
