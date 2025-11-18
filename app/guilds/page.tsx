import { MatchesHeader } from '@/components/matches-header'
import { getGuilds, getWorlds } from '@/server/queries'
import { GuildsList } from '@/components/guilds-list'

export default async function GuildsPage() {
  const [guilds, worldsData] = await Promise.all([getGuilds(), getWorlds()]);

  // Create a map of world IDs to world names
  const worldMap = new Map<number, string>();
  if (worldsData) {
    Object.values(worldsData).forEach(world => {
      worldMap.set(world.id, world.name);
    });
  }

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Guilds</h1>
          <p className="text-muted-foreground">
            Browse and search WvW guilds
          </p>
        </div>

        <GuildsList guilds={guilds} worldMap={worldMap} />
      </main>
    </div>
  )
}
