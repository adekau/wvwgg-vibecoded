import { GuildDetailHeader } from '@/components/guild-detail-header'
import { MatchesHeader } from '@/components/matches-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getGuilds, getWorlds } from '@/server/queries'
import { Globe, Link as LinkIcon, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ guildId: string }>
}

export default async function GuildDetailPage({ params }: PageProps) {
  const { guildId } = await params
  const [guilds, worldsData] = await Promise.all([getGuilds(), getWorlds()])

  const guild = guilds.find(g => g.id === guildId)

  if (!guild) {
    notFound()
  }

  // Find alliance if this is a member guild
  const allianceGuild = guilds.find(g => g.id === guild.allianceGuildId)

  // Find member guilds if this is an alliance
  // Check both memberGuildIds (admin set) and find guilds that reference this as their alliance
  const memberGuilds = guilds.filter(g =>
    guild.memberGuildIds?.includes(g.id) || g.allianceGuildId === guild.id
  )

  // For member guilds, use alliance's world; otherwise use guild's world
  const displayWorldId = allianceGuild ? allianceGuild.worldId : guild.worldId
  const world = worldsData?.find(w => w.id === displayWorldId)

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <GuildDetailHeader
          guild={guild}
          allGuilds={guilds}
          classification={guild.classification}
        />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card className="panel-border inset-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Guild Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  World/Server
                  {allianceGuild && <span className="ml-1">(from Alliance)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {world?.name || `Unknown (${displayWorldId})`}
                  </span>
                </div>
              </div>

              {guild.member_count !== undefined && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Members</div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{guild.member_count}</span>
                  </div>
                </div>
              )}

              {guild.level && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Guild Level</div>
                  <span className="font-medium">{guild.level}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alliance Info */}
          {(allianceGuild || memberGuilds.length > 0) && (
            <Card className="panel-border inset-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  {allianceGuild ? 'Alliance Membership' : 'Member Guilds'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {allianceGuild && (
                  <Link href={`/guilds/${allianceGuild.id}`}>
                    <div className="p-3 rounded-md border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {allianceGuild.tag}
                        </Badge>
                        <span className="font-medium">{allianceGuild.name}</span>
                      </div>
                    </div>
                  </Link>
                )}

                {memberGuilds.map((member) => (
                  <Link key={member.id} href={`/guilds/${member.id}`}>
                    <div className="p-3 rounded-md border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {member.tag}
                        </Badge>
                        <span className="font-medium">{member.name}</span>
                      </div>
                      {member.member_count && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {member.member_count} members
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

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
