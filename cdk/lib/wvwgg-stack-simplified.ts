import * as cdk from 'aws-cdk-lib';
import { Effect, FederatedPrincipal, OpenIdConnectProvider, PolicyDocument, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import path from 'node:path';
import { AutomationStack } from './automation-stack';
import { AuthConstruct } from './constructs/auth';
import lambda = cdk.aws_lambda;
import lambdaNodejs = cdk.aws_lambda_nodejs;
import events = cdk.aws_events;
import eventTargets = cdk.aws_events_targets;

interface WvWGGStackProps extends cdk.StackProps {
  stage: 'dev' | 'prod';
  automationStack: AutomationStack;
  vercelTeamSlug?: string; // Optional: for team-level OIDC, omit for global
}

export class WvWGGStack extends cdk.Stack {
  public readonly dynamoDbTable: cdk.aws_dynamodb.TableV2;
  public readonly auth: AuthConstruct;

  constructor(scope: Construct, id: string, props: WvWGGStackProps) {
    super(scope, id, props);

    // Cognito User Pool for Admin Authentication
    this.auth = new AuthConstruct(this, 'Auth', {
      stage: props.stage,
    });

    // DynamoDB Table - Shared between AWS and Vercel
    this.dynamoDbTable = new cdk.aws_dynamodb.TableV2(this, `WvWGGTable-${props.stage}`, {
      tableName: `wvwgg-${props.stage}`,
      partitionKey: { name: 'type', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      billing: cdk.aws_dynamodb.Billing.onDemand(),
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // GSI for efficient querying
      globalSecondaryIndexes: [
        // Match history queries
        {
          indexName: 'type-interval-index',
          partitionKey: { name: 'type', type: cdk.aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'interval', type: cdk.aws_dynamodb.AttributeType.NUMBER },
        },
        {
          indexName: 'matchId-interval-index',
          partitionKey: { name: 'matchId', type: cdk.aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'interval', type: cdk.aws_dynamodb.AttributeType.NUMBER },
        },
        // Build system queries - DEPLOY PHASE 1: Version tracking
        {
          indexName: 'gameVersion-validFrom-index',
          partitionKey: { name: 'gameVersion', type: cdk.aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'validFrom', type: cdk.aws_dynamodb.AttributeType.STRING },
        }
        // Build system queries - DEPLOY PHASE 2: Item categorization
        // UNCOMMENT AFTER PHASE 1 COMPLETES (wait for gameVersion-validFrom-index to be ACTIVE)
        // {
        //   indexName: 'itemCategory-gameVersion-index',
        //   partitionKey: { name: 'itemCategory', type: cdk.aws_dynamodb.AttributeType.STRING },
        //   sortKey: { name: 'gameVersion', type: cdk.aws_dynamodb.AttributeType.STRING },
        // },
        // Build system queries - DEPLOY PHASE 3: Modifier source lookup
        // UNCOMMENT AFTER PHASE 2 COMPLETES (wait for itemCategory-gameVersion-index to be ACTIVE)
        // {
        //   indexName: 'sourceType-sourceId-index',
        //   partitionKey: { name: 'sourceType', type: cdk.aws_dynamodb.AttributeType.STRING },
        //   sortKey: { name: 'sourceId', type: cdk.aws_dynamodb.AttributeType.STRING },
        // }
      ]
    });

    // Grant guild batch lambda permission to write to DynamoDB
    props.automationStack.getGuildBatchLambda.addToRolePolicy(new PolicyStatement({
      actions: ['dynamodb:BatchWriteItem'],
      resources: [this.dynamoDbTable.tableArn]
    }));

    // Lambda: Fetch Matches (runs every 60 seconds)
    const fetchMatchesLambda = new lambdaNodejs.NodejsFunction(this, `WvWGGFetchMatchesLambda-${props.stage}`, {
      entry: path.join(__dirname, '../lambda/get-matches.ts'),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      timeout: cdk.Duration.minutes(5), // Increased to 5 minutes for prime time calculations
      environment: {
        TABLE_NAME: this.dynamoDbTable.tableName,
        ANET_MATCHES_ENDPOINT: 'https://api.guildwars2.com/v2/wvw/matches?ids=all',
        ANET_WORLDS_ENDPOINT: 'https://api.guildwars2.com/v2/worlds?ids=all',
        REGION: this.region
      }
    });
    fetchMatchesLambda.node.addDependency(this.dynamoDbTable);
    this.dynamoDbTable.grantReadWriteData(fetchMatchesLambda);

    // Lambda: Fetch Worlds (runs every 24 hours)
    const fetchWorldsLambda = new lambdaNodejs.NodejsFunction(this, `WvWGGFetchWorldsLambda-${props.stage}`, {
      entry: path.join(__dirname, '../lambda/get-worlds.ts'),
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      timeout: cdk.Duration.seconds(15),
      environment: {
        ANET_WORLDS_ENDPOINT: 'https://api.guildwars2.com/v2/worlds?ids=all',
        TABLE_NAME: this.dynamoDbTable.tableName,
        REGION: this.region
      }
    });
    fetchWorldsLambda.node.addDependency(this.dynamoDbTable);
    this.dynamoDbTable.grantReadWriteData(fetchWorldsLambda);

    // EventBridge Rule: Trigger fetchMatchesLambda every 60 seconds
    const fetchMatchesRule = new events.Rule(this, `WvWGGFetchMatchesRule-${props.stage}`, {
      schedule: events.Schedule.rate(cdk.Duration.seconds(60)),
      targets: [new eventTargets.LambdaFunction(fetchMatchesLambda)],
    });
    fetchMatchesRule.node.addDependency(fetchMatchesLambda);

    // EventBridge Rule: Trigger fetchWorldsLambda every 24 hours
    const fetchWorldsRule = new events.Rule(this, `WvWGGFetchWorldsRule-${props.stage}`, {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      targets: [new eventTargets.LambdaFunction(fetchWorldsLambda)]
    });
    fetchWorldsRule.node.addDependency(fetchWorldsLambda);

    // ===== Vercel OIDC Setup =====
    // OIDC provider URL and audience
    const oidcProviderUrl = props.vercelTeamSlug
      ? `oidc.vercel.com/${props.vercelTeamSlug}`
      : 'oidc.vercel.com';

    const oidcAudience = props.vercelTeamSlug
      ? `https://vercel.com/${props.vercelTeamSlug}`
      : 'https://vercel.com';

    // Create OIDC Identity Provider
    const vercelOidcProvider = new OpenIdConnectProvider(this, `VercelOidcProvider-${props.stage}`, {
      url: `https://${oidcProviderUrl}`,
      clientIds: [oidcAudience],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'] // Vercel OIDC thumbprint
    });

    // Create IAM Role for Vercel OIDC
    const vercelOidcRole = new Role(this, `VercelOidcRole-${props.stage}`, {
      roleName: `vercel-oidc-${props.stage}`,
      assumedBy: new FederatedPrincipal(
        vercelOidcProvider.openIdConnectProviderArn,
        {
          'StringEquals': {
            [`${oidcProviderUrl}:aud`]: oidcAudience
          }
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: `Role for Vercel OIDC to access DynamoDB (${props.stage})`,
      inlinePolicies: {
        DynamoDBAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:Scan',
                'dynamodb:Query'
              ],
              resources: [
                this.dynamoDbTable.tableArn,
                `${this.dynamoDbTable.tableArn}/index/*` // Allow access to GSI
              ]
            })
          ]
        })
      }
    });

    // Output OIDC Role ARN (this goes into Vercel env as AWS_ROLE_ARN)
    new cdk.CfnOutput(this, `VercelOidcRoleArn-${props.stage}`, {
      value: vercelOidcRole.roleArn,
      description: `Vercel OIDC Role ARN for ${props.stage} (use as AWS_ROLE_ARN)`,
      exportName: `VercelOidcRoleArn-${props.stage}`
    });

    // Outputs
    new cdk.CfnOutput(this, `DynamoDbTableName-${props.stage}`, {
      value: this.dynamoDbTable.tableName,
      description: `DynamoDB table name for ${props.stage} environment`,
      exportName: `WvWGGTableName-${props.stage}`
    });
  }
}
