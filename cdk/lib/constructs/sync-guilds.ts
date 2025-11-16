import { Duration, aws_lambda as lambda, aws_lambda_nodejs as lambdaNode, aws_s3 as s3, aws_stepfunctions as sfn, aws_stepfunctions_tasks as sfnTasks } from 'aws-cdk-lib';
import { DefinitionBody, QueryLanguage, S3JsonItemReader, StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import path from "path";

interface WvWSyncGuildsStepFunctionProps {
    bucket: s3.Bucket;
    region: string;
}

export class WvWGGSyncGuildsStepFunction extends Construct {
    private props: WvWSyncGuildsStepFunctionProps;
    public getGuildBatchLambdaFn: lambdaNode.NodejsFunction;

    constructor(scope: Construct, id: string, props: WvWSyncGuildsStepFunctionProps) {
        super(scope, id);
        this.props = props;

        const getWvwGuildsLambda = new lambdaNode.NodejsFunction(scope, 'get-wvw-guilds-lambda', {
            entry: path.join(__dirname, '../../lambda/get-wvw-guilds.ts'),
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            timeout: Duration.seconds(30),
            environment: {
                REGION: this.props.region,
                BUCKET_NAME: this.props.bucket.bucketName,
                WVW_GUILDS_ENDPOINT: 'https://api.guildwars2.com/v2/wvw/guilds'
            }
        });
        getWvwGuildsLambda.node.addDependency(this.props.bucket);
        this.props.bucket.grantWrite(getWvwGuildsLambda);

        const getWvwGuilds = new sfnTasks.LambdaInvoke(this, 'get-wvw-guilds', {
            lambdaFunction: getWvwGuildsLambda,
            queryLanguage: QueryLanguage.JSONATA,
            outputs: '{% $states.result.Payload.body.fileNames %}',
            assign: {
                tableNames: '{% $states.input.tableNames %}'
            }
        });

        const sm = new StateMachine(this, 'sync-guilds-state-machine', {
            definitionBody: DefinitionBody.fromChainable(getWvwGuilds.next(this.createBatchesMap())),
            queryLanguage: QueryLanguage.JSONATA
        });
    }

    private createBatchesMap() {
        const map = new sfn.Map(this, 'create-batches-map', {
            maxConcurrency: 1,
            outputs: {} // prevent output from going to next state so the data limit is not exceeded
        });
        const processBatchesMap = this.processBatchesMap();
        map.itemProcessor(processBatchesMap, { mode: sfn.ProcessorMode.INLINE, executionType: sfn.ProcessorType.EXPRESS });
        return map;
    }

    private processBatchesMap() {
        const map = new sfn.DistributedMap(this, 'process-batches-map', {
            queryLanguage: QueryLanguage.JSONATA,
            maxConcurrency: 1,
            mapExecutionType: sfn.StateMachineType.EXPRESS,
            itemReader: new S3JsonItemReader({
                bucket: this.props.bucket,
                key: '{% $states.input %}'
            }),
            itemBatcher: new sfn.ItemBatcher({
                // TODO: remove magic numbers
                maxItemsPerBatch: 25,
                batchInput: {
                    tableNames: '{% $tableNames %}'
                }
            }),
            outputs: {}, // prevent output from going to next state so the data limit is not exceeded
            toleratedFailurePercentage: 5
        });
        // TODO: remove magic numbers
        const waitState = new sfn.Wait(this, 'wait', {
            time: sfn.WaitTime.duration(Duration.seconds(5)),
            comment: 'Wait for 5 seconds to avoid rate limiting'
        });
        const getGuildBatch = this.getGuildBatchLambda();
        // STANDARD should probably be changed to EXPRESS later to cost optimize
        map.itemProcessor(waitState.next(getGuildBatch), { mode: sfn.ProcessorMode.DISTRIBUTED, executionType: sfn.ProcessorType.EXPRESS });

        return map;
    }

    private getGuildBatchLambda() {
        const fnToInvoke = new lambdaNode.NodejsFunction(this, 'get-guild-batch-lambda', {
            entry: path.join(__dirname, '../../lambda/get-guild-batch.ts'),
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'handler',
            timeout: Duration.seconds(30),
            environment: {
                REGION: this.props.region,
                ANET_GUILD_ENDPOINT: 'https://api.guildwars2.com/v2/guild',
            }
        });
        this.getGuildBatchLambdaFn = fnToInvoke;
        return new sfnTasks.LambdaInvoke(this, 'get-guild-batch', {
            lambdaFunction: fnToInvoke,
            queryLanguage: QueryLanguage.JSONATA,
            payload: sfn.TaskInput.fromText('{% $states.input %}')
        });
    }
}