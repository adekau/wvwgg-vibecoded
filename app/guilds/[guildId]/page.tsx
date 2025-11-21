import { MatchesHeader } from '@/components/matches-header'
import { Button } from '@/components/ui/button'
import { getGuilds, getWorlds } from '@/server/queries'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GuildDetailPanel } from '@/components/guild-detail-panel'

// Use auto to let Next.js decide, but enable dynamic params
export const dynamicParams = true
export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ guildId: string }>
}

// Pre-generate a limited number of guild pages to ensure route is recognized
// Limit to prevent disk space issues on Vercel
export async function generateStaticParams() {
  try {
    const guilds = await getGuilds()
    // Only pre-generate first 100 guilds to save build time/space
    return guilds.slice(0, 100).map(guild => ({
      guildId: guild.id,
    }))
  } catch (error) {
    console.error('Error generating static params for guilds:', error)
    return []
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { guildId } = await params
  const guilds = await getGuilds()
  const guild = guilds.find(g => g.id === guildId)

  if (!guild) {
    return {
      title: 'Guild Not Found',
    }
  }

  return {
    title: `[${guild.tag}] ${guild.name} - Guild Details`,
    description: `View details for ${guild.name} [${guild.tag}] WvW guild`,
  }
}

export default async function GuildDetailPage({ params }: PageProps) {
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
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <GuildDetailPanel
          guild={guild}
          allGuilds={guilds}
          worldMap={worldMap}
          isModal={false}
        />

        {/* Back to Guilds */}
        <div className="pt-4">
          <Link href="/guilds">
            <Button variant="outline">
              ← Back to Guilds
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
