import { Duration, aws_lambda as lambda, aws_lambda_nodejs as lambdaNode, aws_s3 as s3, aws_stepfunctions as sfn, aws_stepfunctions_tasks as sfnTasks } from 'aws-cdk-lib';
import { DefinitionBody, QueryLanguage, S3JsonItemReader, S3ObjectsItemReader, StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import path from "path";

interface WvWGGSyncGameDataStepFunctionProps {
    bucket: s3.Bucket;
    region: string;
}

export class WvWGGSyncGameDataStepFunction extends Construct {
    private props: WvWGGSyncGameDataStepFunctionProps;
    public stateMachine: StateMachine;
    public syncBaseDataLambda: lambdaNode.NodejsFunction;
    public fetchItemsBatchUpgradeLambda: lambdaNode.NodejsFunction;
    public fetchItemsBatchConsumableLambda: lambdaNode.NodejsFunction;

    constructor(scope: Construct, id: string, props: WvWGGSyncGameDataStepFunctionProps) {
        super(scope, id);
        this.props = props;

        // Step 1: Sync ItemStats + Formulas (fast)
        const syncBaseDataTask = this.createSyncBaseDataTask();

        // Step 2: Get ALL item IDs (UpgradeComponents + Consumables)
        const getAllItemIdsTask = this.createGetAllItemIdsTask();

        // Step 3: Process all items
        const processItemsMap = this.createProcessItemsMap('all-items');

        // Chain the steps together
        const definition = syncBaseDataTask
            .next(getAllItemIdsTask)
            .next(processItemsMap);

        this.stateMachine = new StateMachine(this, 'sync-game-data-state-machine', {
            definitionBody: DefinitionBody.fromChainable(definition),
            queryLanguage: QueryLanguage.JSONATA,
            timeout: Duration.hours(2) // Allow for long sync
        });
    }

    /**
     * Step 1: Sync ItemStats + Formulas
     * Fast operation (~30 seconds)
     */
    private createSyncBaseDataTask() {
        this.syncBaseDataLambda = new lambdaNode.NodejsFunction(this, 'sync-base-data-lambda', {
            entry: path.join(__dirname, '../../lambda/sync-game-data.ts'),
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            timeout: Duration.minutes(2),
            memorySize: 512,
            environment: {
                // TABLE_NAME will be added later by WvWGGStack
                REGION: this.props.region
            }
        });

        return new sfnTasks.LambdaInvoke(this, 'sync-base-data', {
            lambdaFunction: this.syncBaseDataLambda,
            queryLanguage: QueryLanguage.JSONATA,
            payload: sfn.TaskInput.fromObject({
                syncItemStats: true,
                syncItems: false, // Skip items in this step
                syncFormulas: true
            }),
            outputs: '{% $states.result.Payload %}',
            comment: 'Sync ItemStats and Formulas (fast)'
        });
    }

    /**
     * Step 2: Get ALL item IDs (UpgradeComponents + Consumables) and write to S3
     * Returns array of S3 keys for batch processing
     */
    private createGetAllItemIdsTask() {
        const l = new lambdaNode.NodejsFunction(this, 'get-all-item-ids-lambda', {
            entry: path.join(__dirname, '../../lambda/get-all-item-ids.ts'),
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            timeout: Duration.seconds(60),  // Fetching both types
            memorySize: 256,
            environment: {
                REGION: this.props.region,
                BUCKET_NAME: this.props.bucket.bucketName,
                GW2_API_BASE: 'https://api.guildwars2.com/v2'
            }
        });
        l.node.addDependency(this.props.bucket);
        this.props.bucket.grantWrite(l);

        return new sfnTasks.LambdaInvoke(this, 'get-all-item-ids', {
            lambdaFunction: l,
            queryLanguage: QueryLanguage.JSONATA,
            outputs: '{% $states.result.Payload.body.fileNames %}',  // Return array of S3 keys
            comment: 'Get all item IDs (UpgradeComponents + Consumables) and write to S3'
        });
    }

    /**
     * Step 3/5: Process item batches using DistributedMap
     * Wrapped in regular Map to prevent output size limit (same as guild sync)
     */
    private createProcessItemsMap(mapName: string) {
        // Outer regular Map (like create-batches-map in guild sync)
        const outerMap = new sfn.Map(this, `${mapName}-outer-map`, {
            maxConcurrency: 1,
            outputs: {} // Discards all output from inner map
        });

        // Inner DistributedMap (like process-batches-map in guild sync)
        const innerMap = new sfn.DistributedMap(this, `process-${mapName}-map`, {
            queryLanguage: QueryLanguage.JSONATA,
            maxConcurrency: 1, // Same as guild sync
            mapExecutionType: sfn.StateMachineType.EXPRESS,
            itemReader: new S3JsonItemReader({
                bucket: this.props.bucket,
                key: '{% $states.input %}'  // Outer map passes S3 key as input
            }),
            itemBatcher: new sfn.ItemBatcher({
                maxItemsPerBatch: 200
            }),
            outputs: {}, // Minimize inner output
            toleratedFailurePercentage: 5
        });

        // Wait state for rate limiting (same as guild sync)
        const waitState = new sfn.Wait(this, `wait-${mapName}`, {
            time: sfn.WaitTime.duration(Duration.seconds(5)),
            comment: 'Wait 5 seconds to avoid rate limiting'
        });

        // Lambda to fetch and process a batch of items
        const fetchItemsBatchTask = this.createFetchItemsBatchTask(mapName);

        innerMap.itemProcessor(
            waitState.next(fetchItemsBatchTask),
            {
                mode: sfn.ProcessorMode.DISTRIBUTED,
                executionType: sfn.ProcessorType.EXPRESS
            }
        );

        // Outer map contains the inner DistributedMap
        outerMap.itemProcessor(innerMap, {
            mode: sfn.ProcessorMode.INLINE,
            executionType: sfn.ProcessorType.EXPRESS
        });

        return outerMap;
    }

    /**
     * Lambda to fetch and process a batch of items
     */
    private createFetchItemsBatchTask(mapName: string) {
        const lambdaFn = new lambdaNode.NodejsFunction(this, `fetch-items-batch-${mapName}-lambda`, {
            entry: path.join(__dirname, '../../lambda/fetch-items-batch.ts'),
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            timeout: Duration.seconds(60), // Increased from 30s to handle larger batches
            memorySize: 512,
            environment: {
                // TABLE_NAME will be added later by WvWGGStack
                REGION: this.props.region,
                GW2_API_BASE: 'https://api.guildwars2.com/v2'
            }
        });

        // Store reference to Lambda for DynamoDB permission grants
        this.fetchItemsBatchUpgradeLambda = lambdaFn;
        this.fetchItemsBatchConsumableLambda = lambdaFn;  // Same Lambda for both

        return new sfnTasks.LambdaInvoke(this, `fetch-items-batch-${mapName}`, {
            lambdaFunction: lambdaFn,
            queryLanguage: QueryLanguage.JSONATA,
            payload: sfn.TaskInput.fromText('{% $states.input %}'),
            comment: `Fetch and process batch of items for ${mapName}`
        });
    }
}
