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
          <p className="text-muted-foreground mb-4">
            Browse and search WvW guilds
          </p>
          <div className="p-4 rounded-md border bg-muted/50 text-sm space-y-2">
            <p>
              <strong>About this list:</strong> This page displays guilds that participate in World vs World.
              A guild appears here when at least one member has set it as their WvW guild preference in-game.
            </p>
            <p>
              <strong>Guild not listed?</strong> If you're a guild leader and your guild doesn't appear here,
              you can add it by clicking on any existing guild and using the "Update Guild Info" button.
              You'll need a Guild Wars 2 API key with "guilds" permission to verify ownership.
            </p>
          </div>
        </div>

        <GuildsList guilds={guilds} worldMap={worldMap} />
      </main>
    </div>
  )
}
