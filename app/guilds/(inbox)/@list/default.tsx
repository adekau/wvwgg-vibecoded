import { getGuilds, getWorlds } from '@/server/queries'
import { GuildsListPanel } from '@/components/guilds-list-panel'

export default async function ListDefault() {
  const [guilds, worldsData] = await Promise.all([getGuilds(), getWorlds()])

  // Create a map of world IDs to world names
  const worldMap = new Map<number, string>()
  if (worldsData) {
    Object.values(worldsData).forEach(world => {
      worldMap.set(world.id, world.name)
    })
  }

  return <GuildsListPanel guilds={guilds} worldMap={worldMap} />
}
