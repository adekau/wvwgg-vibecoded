import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

        // Use UpdateCommand to preserve custom fields (classification, alliance relationships, etc.)
        // This approach only updates the 'data' field with GW2 API data while keeping all other fields intact
        const validGuilds = guilds.filter((guild) => guild != null);
        const now = Date.now();

        // Process updates for each table
        for (const tableName of tableNames) {
            await Promise.all(
                validGuilds.map(async (guild) => {
                    try {
                        await dynamoDb.send(
                            new UpdateCommand({
                                TableName: tableName,
                                Key: {
                                    type: 'guild',
                                    id: guild.id
                                },
                                UpdateExpression: 'SET #data = :data, #updatedAt = :updatedAt',
                                ExpressionAttributeNames: {
                                    '#data': 'data',
                                    '#updatedAt': 'updatedAt'
                                },
                                ExpressionAttributeValues: {
                                    ':data': guild,
                                    ':updatedAt': now
                                }
                            })
                        );
                    } catch (error) {
                        console.error(`Failed to update guild ${guild.id} in table ${tableName}:`, error);
                        // Continue processing other guilds even if one fails
                    }
                })
            );
        }
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