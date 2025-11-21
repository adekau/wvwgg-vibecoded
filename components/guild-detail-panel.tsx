'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IGuild } from '@/server/queries'
import { Globe, Link as LinkIcon, Shield, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GuildDetailHeader } from '@/components/guild-detail-header'
import { useMemo, useCallback } from 'react'

interface GuildDetailPanelProps {
  guild: IGuild
  allGuilds: IGuild[]
  worldMap: Map<number, string>
  isModal?: boolean
}

export function GuildDetailPanel({ guild, allGuilds, worldMap, isModal = false }: GuildDetailPanelProps) {
  const router = useRouter()

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  // Create a Map for O(1) guild lookups
  const guildsById = useMemo(() => {
    const map = new Map<string, IGuild>()
    allGuilds.forEach(guild => {
      map.set(guild.id, guild)
    })
    return map
  }, [allGuilds])

  // Memoize expensive lookups
  const { allianceGuild, memberGuilds, displayWorldId, worldName } = useMemo(() => {
    // Use Map for O(1) lookup instead of O(n) find
    const allianceGuild = guild.allianceGuildId
      ? guildsById.get(guild.allianceGuildId)
      : undefined

    // Find member guilds if this is an alliance
    const memberGuilds = allGuilds.filter(g =>
      guild.memberGuildIds?.includes(g.id) || g.allianceGuildId === guild.id
    )

    // For member guilds, use alliance's world; otherwise use guild's world
    const displayWorldId = allianceGuild ? allianceGuild.worldId : guild.worldId
    const worldName = worldMap.get(displayWorldId) || `Unknown (${displayWorldId})`

    return { allianceGuild, memberGuilds, displayWorldId, worldName }
  }, [guild.id, guild.allianceGuildId, guild.memberGuildIds, guild.worldId, allGuilds, guildsById, worldMap])

  return (
    <div className="space-y-6">
      {/* Header with close button for modal */}
      {isModal && (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <GuildDetailHeader
              guild={guild}
              allGuilds={allGuilds}
              classification={guild.classification}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!isModal && (
        <GuildDetailHeader
          guild={guild}
          allGuilds={allGuilds}
          classification={guild.classification}
        />
      )}

      <div className="space-y-6">
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
                <span className="font-medium">{worldName}</span>
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
                <a href={`/guilds/${allianceGuild.id}`}>
                  <div className="p-3 rounded-md border hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {allianceGuild.tag}
                      </Badge>
                      <span className="font-medium">{allianceGuild.name}</span>
                    </div>
                  </div>
                </a>
              )}

              {memberGuilds.map((member) => (
                <a key={member.id} href={`/guilds/${member.id}`}>
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
                </a>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
