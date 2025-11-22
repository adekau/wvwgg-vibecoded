'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Users, Shield } from 'lucide-react'
import { IGuild } from '@/server/queries'
import Link from 'next/link'

interface WorldAlliancesProps {
  worlds: Array<{
    id: number
    name: string
    color: 'red' | 'blue' | 'green'
  }>
  guilds: IGuild[]
}

const colorClasses = {
  red: {
    bg: 'bg-chart-1/18',
    text: 'text-chart-1',
    border: 'border-chart-1/25',
    badge: 'bg-chart-1/60 text-primary-foreground border-chart-1/70 font-medium',
  },
  blue: {
    bg: 'bg-chart-2/18',
    text: 'text-chart-2',
    border: 'border-chart-2/25',
    badge: 'bg-chart-2/60 text-primary-foreground border-chart-2/70 font-medium',
  },
  green: {
    bg: 'bg-chart-3/18',
    text: 'text-chart-3',
    border: 'border-chart-3/25',
    badge: 'bg-chart-3/60 text-primary-foreground border-chart-3/70 font-medium',
  },
}

export function WorldAlliances({ worlds, guilds }: WorldAlliancesProps) {
  // Group guilds by world
  const guildsByWorld = worlds.map((world) => {
    const worldGuilds = guilds.filter((guild) => guild.worldId === world.id)

    // Find all alliances on this world based on the alliance's worldId
    // Member guilds inherit their alliance's world placement
    // Include both regular alliances and solo alliances
    const allAllianceGuilds = guilds.filter((guild) =>
      guild.classification === 'alliance' || guild.classification === 'solo-alliance'
    )
    const relevantAlliances = allAllianceGuilds.filter((alliance) => {
      return alliance.worldId === world.id
    })

    const independents = worldGuilds.filter((guild) => guild.classification === 'independent')

    // Get member guilds for each alliance
    // IMPORTANT: Member guilds are ALWAYS shown under their alliance regardless of
    // what worldId the member guild has assigned. We filter by allianceGuildId ONLY,
    // not by worldId. This ensures member guild tags appear under their alliance
    // even if the member guild's worldId differs from the alliance's worldId.
    const alliancesWithMembers = relevantAlliances.map((alliance) => {
      const members = guilds.filter(
        (guild) =>
          guild.classification === 'member' &&
          guild.allianceGuildId === alliance.id
          // Note: We deliberately do NOT filter by worldId here
      )
      return {
        ...alliance,
        members,
      }
    })

    return {
      ...world,
      alliances: alliancesWithMembers,
      independents,
      totalGuilds: worldGuilds.length,
    }
  })

  return (
    <Card className="panel-border inset-card frosted-panel" style={{ background: 'transparent' }}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Alliances by World</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {guildsByWorld.map((world) => {
            const classes = colorClasses[world.color]

            return (
              <div
                key={world.id}
                className={`rounded-md p-4 border world-card-frosted ${classes.bg} ${classes.border}`}
              >
                <div className="mb-3">
                  <div className="font-medium text-sm mb-1">{world.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {world.totalGuilds} {world.totalGuilds === 1 ? 'guild' : 'guilds'} registered
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Alliances */}
                  {world.alliances.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                        Alliances ({world.alliances.length})
                      </div>
                      <div className="space-y-2">
                        {world.alliances.map((alliance) => (
                          <div key={alliance.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/guilds/${alliance.id}`}
                                className="flex items-center gap-2 hover:underline"
                              >
                                <Shield className="h-3 w-3" />
                                <span className="font-semibold text-sm">
                                  [{alliance.tag}] {alliance.name}
                                </span>
                              </Link>
                              {alliance.members.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs h-5 ${classes.badge} border cursor-help`}
                                    >
                                      {alliance.members.length} {alliance.members.length === 1 ? 'guild' : 'guilds'}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <div className="text-xs space-y-1">
                                      {alliance.members.map((member) => (
                                        <div key={member.id}>
                                          [{member.tag}] {member.name}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Independent Guilds */}
                  {world.independents.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                        Independent ({world.independents.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {world.independents.map((guild) => (
                          <Link
                            key={guild.id}
                            href={`/guilds/${guild.id}`}
                          >
                            <Badge
                              variant="outline"
                              className={`text-xs h-5 ${classes.badge} border cursor-pointer hover:opacity-80 transition-opacity`}
                            >
                              [{guild.tag}]
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No guilds */}
                  {world.alliances.length === 0 && world.independents.length === 0 && (
                    <div className="text-sm text-muted-foreground italic py-2">
                      No guilds registered yet
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
