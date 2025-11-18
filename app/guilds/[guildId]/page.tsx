import { MatchesHeader } from '@/components/matches-header'
import { getGuilds, getWorlds } from '@/server/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Users, Globe, Link as LinkIcon } from 'lucide-react'
import { notFound } from 'next/navigation'
import Link from 'next/link'

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

  const world = worldsData?.find(w => w.id === guild.worldId)

  // Find alliance if this is a member guild
  const allianceGuild = guilds.find(g => g.id === (guild as any).allianceGuildId)

  // Find member guilds if this is an alliance
  const memberGuilds = guilds.filter(g =>
    (guild as any).memberGuildIds?.includes(g.id)
  )

  const classification = (guild as any).classification as string | undefined

  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                {guild.tag}
              </Badge>
              {classification && (
                <Badge variant={
                  classification === 'alliance' ? 'default' :
                  classification === 'member' ? 'secondary' : 'outline'
                }>
                  {classification}
                </Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold">{guild.name}</h1>
          </div>

          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Update Guild Info
          </Button>
        </div>

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
                <div className="text-sm text-muted-foreground mb-1">World/Server</div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {world?.name || `Unknown (${guild.worldId})`}
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
