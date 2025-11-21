import { getGuilds, getWorlds } from '@/server/queries'
import { notFound } from 'next/navigation'
import { GuildDetailPanel } from '@/components/guild-detail-panel'
import { Card, CardContent } from '@/components/ui/card'

interface PageProps {
  params: Promise<{ guildId: string }>
}

export default async function GuildDetailSlot({ params }: PageProps) {
  const { guildId } = await params
  const [guilds, worldsData] = await Promise.all([getGuilds(), getWorlds()])

  const guild = guilds.find(g => g.id === guildId)

  if (!guild) {
    notFound()
  }

  // Create a map of world IDs to world names
  const worldMap = new Map<number, string>()
  if (worldsData) {
    Object.values(worldsData).forEach(world => {
      worldMap.set(world.id, world.name)
    })
  }

  return (
    <Card className="panel-border inset-card flex-1 overflow-auto">
      <CardContent className="p-8">
        <GuildDetailPanel
          guild={guild}
          allGuilds={guilds}
          worldMap={worldMap}
          isModal={false}
        />
      </CardContent>
    </Card>
  )
}
