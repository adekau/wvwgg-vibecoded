'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Shield } from 'lucide-react'
import { IGuild } from '@/server/queries'

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
    badge: 'bg-chart-1/30 text-chart-1 border-chart-1/40',
  },
  blue: {
    bg: 'bg-chart-2/18',
    text: 'text-chart-2',
    border: 'border-chart-2/25',
    badge: 'bg-chart-2/30 text-chart-2 border-chart-2/40',
  },
  green: {
    bg: 'bg-chart-3/18',
    text: 'text-chart-3',
    border: 'border-chart-3/25',
    badge: 'bg-chart-3/30 text-chart-3 border-chart-3/40',
  },
}

export function WorldAlliances({ worlds, guilds }: WorldAlliancesProps) {
  // Group guilds by world
  const guildsByWorld = worlds.map((world) => {
    const worldGuilds = guilds.filter((guild) => guild.worldId === world.id)

    // Separate alliances and independent guilds
    const alliances = worldGuilds.filter((guild) => guild.classification === 'alliance')
    const independents = worldGuilds.filter((guild) => guild.classification === 'independent')

    // Get member guilds for each alliance
    const alliancesWithMembers = alliances.map((alliance) => {
      const members = worldGuilds.filter(
        (guild) => guild.classification === 'member' && guild.allianceGuildId === alliance.id
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
                className={`rounded-lg border p-4 ${classes.bg} ${classes.border}`}
              >
                <div className="mb-3">
                  <div className={`font-bold text-lg ${classes.text}`}>{world.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
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
                              <Shield className="h-3 w-3" />
                              <span className="font-semibold text-sm">
                                [{alliance.tag}] {alliance.name}
                              </span>
                            </div>
                            {alliance.members.length > 0 && (
                              <div className="ml-5 flex flex-wrap gap-1">
                                {alliance.members.map((member) => (
                                  <Badge
                                    key={member.id}
                                    variant="outline"
                                    className={`text-xs h-5 ${classes.badge} border`}
                                  >
                                    [{member.tag}]
                                  </Badge>
                                ))}
                              </div>
                            )}
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
                          <Badge
                            key={guild.id}
                            variant="outline"
                            className={`text-xs h-5 ${classes.badge} border`}
                          >
                            [{guild.tag}]
                          </Badge>
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
