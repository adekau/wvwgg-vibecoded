import * as cdk from 'aws-cdk-lib';
import { Effect, PolicyStatement, User, Policy } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import path from 'node:path';
import { AutomationStack } from './automation-stack';
import lambda = cdk.aws_lambda;
import lambdaNodejs = cdk.aws_lambda_nodejs;
import events = cdk.aws_events;
import eventTargets = cdk.aws_events_targets;

interface WvWGGStackProps extends cdk.StackProps {
  stage: 'dev' | 'prod';
  automationStack: AutomationStack;
}

export class WvWGGStack extends cdk.Stack {
  public readonly dynamoDbTable: cdk.aws_dynamodb.TableV2;
  public readonly vercelDeploymentUser: User;

  constructor(scope: Construct, id: string, props: WvWGGStackProps) {
    super(scope, id, props);

    // DynamoDB Table - Shared between AWS and Vercel
    this.dynamoDbTable = new cdk.aws_dynamodb.TableV2(this, `WvWGGTable-${props.stage}`, {
      partitionKey: { name: 'type', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      billing: cdk.aws_dynamodb.Billing.onDemand(),
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
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
      timeout: cdk.Duration.seconds(15),
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

    // IAM User for Vercel Deployment
    this.vercelDeploymentUser = new User(this, `VercelDeploymentUser-${props.stage}`, {
      userName: `vercel-deployment-user-${props.stage}`,
    });

    // IAM Policy: DynamoDB Access for Vercel
    const vercelDynamoDbPolicy = new Policy(this, `VercelDynamoDbPolicy-${props.stage}`, {
      policyName: `VercelDynamoDbAccess-${props.stage}`,
      users: [this.vercelDeploymentUser],
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Scan',
            'dynamodb:Query'
          ],
          resources: [this.dynamoDbTable.tableArn]
        })
      ]
    });

    // Outputs
    new cdk.CfnOutput(this, `DynamoDbTableName-${props.stage}`, {
      value: this.dynamoDbTable.tableName,
      description: `DynamoDB table name for ${props.stage} environment`,
      exportName: `WvWGGTableName-${props.stage}`
    });

    new cdk.CfnOutput(this, `VercelUserArn-${props.stage}`, {
      value: this.vercelDeploymentUser.userArn,
      description: `Vercel deployment user ARN for ${props.stage}`,
      exportName: `VercelUserArn-${props.stage}`
    });

    new cdk.CfnOutput(this, `VercelUserName-${props.stage}`, {
      value: this.vercelDeploymentUser.userName,
      description: `Vercel deployment user name for ${props.stage}`,
      exportName: `VercelUserName-${props.stage}`
    });
  }
}
