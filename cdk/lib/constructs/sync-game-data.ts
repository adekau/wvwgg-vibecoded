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

        // Step 2: Get UpgradeComponent IDs and write to S3
        const getUpgradeIdsTask = this.createGetItemIdsTask('UpgradeComponent');

        // Step 3: Process UpgradeComponent batches
        const processUpgradesMap = this.createProcessItemsMap('upgrade-components');

        // Step 4: Get Consumable IDs and write to S3
        const getConsumableIdsTask = this.createGetItemIdsTask('Consumable');

        // Step 5: Process Consumable batches
        const processConsumablesMap = this.createProcessItemsMap('consumables');

        // Chain the steps together
        const definition = syncBaseDataTask
            .next(getUpgradeIdsTask)
            .next(processUpgradesMap)
            .next(getConsumableIdsTask)
            .next(processConsumablesMap);

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
     * Step 2/4: Get item IDs and write to S3
     * Returns S3 key for batch processing
     */
    private createGetItemIdsTask(itemType: 'UpgradeComponent' | 'Consumable') {
        const l = new lambdaNode.NodejsFunction(this, `get-${itemType.toLowerCase()}-ids-lambda`, {
            entry: path.join(__dirname, '../../lambda/get-item-ids.ts'),
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            timeout: Duration.seconds(30),
            memorySize: 256,
            environment: {
                REGION: this.props.region,
                BUCKET_NAME: this.props.bucket.bucketName,
                GW2_API_BASE: 'https://api.guildwars2.com/v2'
            }
        });
        l.node.addDependency(this.props.bucket);
        this.props.bucket.grantWrite(l);

        return new sfnTasks.LambdaInvoke(this, `get-${itemType.toLowerCase()}-ids`, {
            lambdaFunction: l,
            queryLanguage: QueryLanguage.JSONATA,
            payload: sfn.TaskInput.fromObject({
                itemType: itemType
            }),
            outputs: '{% $states.result.Payload.body %}',
            comment: `Get ${itemType} IDs and write to S3`
        });
    }

    /**
     * Step 3/5: Process item batches using DistributedMap
     * Same pattern as guild sync with rate limiting
     */
    private createProcessItemsMap(mapName: string) {
        const map = new sfn.DistributedMap(this, `process-${mapName}-map`, {
            queryLanguage: QueryLanguage.JSONATA,
            maxConcurrency: 1, // Same as guild sync
            mapExecutionType: sfn.StateMachineType.EXPRESS,
            itemReader: new S3JsonItemReader({
                bucket: this.props.bucket,
                key: '{% $states.input.s3Key %}'
            }),
            itemBatcher: new sfn.ItemBatcher({
                maxItemsPerBatch: 100 // Reduced from 200 to avoid timeouts
            }),
            resultWriter: new sfn.ResultWriter({
                bucket: this.props.bucket,
                prefix: `game-data-sync/results/${mapName}/`
            }),
            toleratedFailurePercentage: 5
        });

        // Wait state for rate limiting (same as guild sync)
        const waitState = new sfn.Wait(this, `wait-${mapName}`, {
            time: sfn.WaitTime.duration(Duration.seconds(5)),
            comment: 'Wait 5 seconds to avoid rate limiting'
        });

        // Lambda to fetch and process a batch of items
        const fetchItemsBatchTask = this.createFetchItemsBatchTask(mapName);

        map.itemProcessor(
            waitState.next(fetchItemsBatchTask),
            {
                mode: sfn.ProcessorMode.DISTRIBUTED,
                executionType: sfn.ProcessorType.EXPRESS
            }
        );

        return map;
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

        // Store references to Lambdas for DynamoDB permission grants
        if (mapName === 'upgrade-components') {
            this.fetchItemsBatchUpgradeLambda = lambdaFn;
        } else if (mapName === 'consumables') {
            this.fetchItemsBatchConsumableLambda = lambdaFn;
        }

        return new sfnTasks.LambdaInvoke(this, `fetch-items-batch-${mapName}`, {
            lambdaFunction: lambdaFn,
            queryLanguage: QueryLanguage.JSONATA,
            payload: sfn.TaskInput.fromText('{% $states.input %}'),
            comment: `Fetch and process batch of items for ${mapName}`
        });
    }
}
