import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommandInput, DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { IBaseGuild } from "../../shared/interfaces/base-guild.interface";
import { IGuildResponse } from "../../shared/interfaces/guild-response.interface";
import { IGuild } from "../../shared/interfaces/guild.interface";

interface IGuildBatchEvent {
    Items: IBaseGuild[];
    BatchInput: {
        tableNames: string[];
    };
}

const REGION = process.env.REGION;
const ANET_GUILD_ENDPOINT = process.env.ANET_GUILD_ENDPOINT;
const dynamoDb = DynamoDBDocument.from(new DynamoDB({ region: REGION }));

export async function handler(event: IGuildBatchEvent) {

    const { Items, BatchInput: { tableNames } } = event;
    try {
        const guilds = await Promise.all(
            Items.map(({ guildId, worldId }) => fetch(`${ANET_GUILD_ENDPOINT}/${guildId}`)
                .then<IGuildResponse>((x) => x.json().catch((e) => {
                    console.error(`Error parsing JSON for guild ${guildId}`, e);
                    throw e;
                }))
                .then((guildResponse) => {
                    if (!validateGuildResponse(guildResponse)) {
                        console.error(`Invalid guild response for guild ${guildId}`, JSON.stringify(guildResponse, null, 2));
                        return undefined;
                    }

                    return {
                        id: guildResponse.id,
                        worldId: worldId,
                        name: guildResponse.name,
                        tag: guildResponse.tag
                    } as IGuild;
                }))
        );

        const putRequests = guilds
            .filter((guild) => guild != null)
            .map((guild) => {
                return {
                    PutRequest: {
                        Item: {
                            type: 'guild',
                            id: guild.id,
                            data: guild,
                            updatedAt: Date.now()
                        }
                    }
                }
            });

        const requestItemsPerTable = tableNames.reduce((acc, tableName) => {
            return {
                ...acc,
                [tableName]: putRequests
            };
        }, {} as BatchWriteCommandInput['RequestItems'])

        await dynamoDb.batchWrite({
            RequestItems: requestItemsPerTable
        });
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error instanceof Error ? error.message : 'Internal server error' })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'ok' })
    };
}

function validateGuildResponse(x: any): x is IGuildResponse {
    return typeof x === 'object' &&
        x !== null &&
        typeof x.id === 'string' &&
        typeof x.name === 'string' &&
        typeof x.tag === 'string';
}