import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { IBaseGuild } from "../../shared/interfaces/base-guild.interface";
import { IWvwGuildsResponse } from "../../shared/interfaces/wvw-guilds-response.interface";

interface IGetWvwGuildsEvent {
    wvwRegion: string;
    filePrefix?: string;
    batchSize?: number;
}

const REGION = process.env.REGION;
const WVW_GUILDS_ENDPOINT = process.env.WVW_GUILDS_ENDPOINT;
const BUCKET_NAME = process.env.BUCKET_NAME;
const s3Client = new S3Client({ region: REGION });
const DEFAULT_BATCH_SIZE = 2500;

export const handler = async (event: IGetWvwGuildsEvent) => {
    const { wvwRegion, filePrefix, batchSize } = event;

    const guilds: IWvwGuildsResponse = await fetch(`${WVW_GUILDS_ENDPOINT}/${wvwRegion}`).then(res => res.json());

    const guildEntries = Object.entries(guilds);
    let batchNumber = 0;
    for (let i = 0; i < guildEntries.length; i += batchSize ?? DEFAULT_BATCH_SIZE) {
        const guildsToSave = guildEntries
            .slice(i, i + (batchSize ?? DEFAULT_BATCH_SIZE))
            .map(([guildId, worldId]) => ({ guildId, worldId: parseInt(worldId, 10) } as IBaseGuild));

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `${wvwRegion}/${filePrefix ? `${filePrefix}-` : ''}${++batchNumber}.json`,
            Body: JSON.stringify(guildsToSave)
        });
        await s3Client.send(command);
    }

    return {
        statusCode: 200,
        body: {
            count: Object.keys(guilds).length,
            batchCount: batchNumber,
            fileNames: Array.from({ length: batchNumber }).map((_, i) => `${wvwRegion}/${filePrefix ? `${filePrefix}-` : ''}${i + 1}.json`),
            wvwRegion
        }
    };
}