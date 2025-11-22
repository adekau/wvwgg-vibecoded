import * as cdk from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import s3 = cdk.aws_s3;
import { WvWGGSyncGuildsStepFunction } from "./constructs/sync-guilds";
import { WvWGGSyncGameDataStepFunction } from "./constructs/sync-game-data";
import lambdaNode = cdk.aws_lambda_nodejs;

export class AutomationStack extends Stack {
    public readonly getGuildBatchLambda: lambdaNode.NodejsFunction;
    public readonly gameDataStepFunction: WvWGGSyncGameDataStepFunction;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const bucket = new s3.Bucket(this, 'automation-results-bucket', {
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        const populateWvwGuildsMachine = new WvWGGSyncGuildsStepFunction(this, 'populate-wvw-guilds', {
            bucket,
            region: this.region
        });
        this.getGuildBatchLambda = populateWvwGuildsMachine.getGuildBatchLambdaFn;

        // Game Data Sync Step Function
        this.gameDataStepFunction = new WvWGGSyncGameDataStepFunction(this, 'sync-game-data', {
            bucket,
            region: this.region
        });
    }
}