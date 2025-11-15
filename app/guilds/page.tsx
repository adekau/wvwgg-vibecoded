import { MatchesHeader } from '@/components/matches-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Swords, Trophy } from 'lucide-react'

// Mock guild data
const mockGuilds = [
  { name: 'Dragon Warriors', tag: '[DW]', members: 125, kills: 15678, tier: 'NA-1', color: 'red' },
  { name: 'Storm Legion', tag: '[STRM]', members: 98, kills: 12456, tier: 'NA-1', color: 'blue' },
  { name: 'Night Blades', tag: '[NB]', members: 87, kills: 10234, tier: 'NA-2', color: 'green' },
  { name: 'Iron Guard', tag: '[IRON]', members: 112, kills: 14567, tier: 'NA-1', color: 'red' },
  { name: 'Shadow Wolves', tag: '[SW]', members: 76, kills: 9876, tier: 'EU-1', color: 'blue' },
]

export default function GuildsPage() {
  return (
    <div className="min-h-screen">
      <MatchesHeader />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Guilds</h1>
          <p className="text-muted-foreground">Top performing guilds in World vs World</p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockGuilds.map((guild, idx) => (
            <Card key={guild.tag} className="panel-border inset-card hover:shadow-lg transition-all duration-300 hover:scale-[1.02]" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{guild.name}</h3>
                      <Badge variant="outline" className="font-mono text-xs">{guild.tag}</Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {guild.tier}
                    </Badge>
                  </div>
                  <Trophy className="h-5 w-5 text-accent" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Members</div>
                      <div className="font-mono font-semibold">{guild.members}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Kills</div>
                      <div className="font-mono font-semibold">{guild.kills.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
