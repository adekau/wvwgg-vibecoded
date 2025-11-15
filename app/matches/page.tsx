import { MatchesHeader } from '@/components/matches-header'
import { RegionTabs } from '@/components/region-tabs'
import { MatchesGrid } from '@/components/matches-grid'

// Mock data - replace with your actual data fetching
const mockMatches = [
  {
    tier: 'NA-1',
    worlds: [
      { name: 'Ruined Cathedral of Blood', kills: 27908, deaths: 38418, color: 'red' },
      { name: 'Lutgardis Conservatory', kills: 52599, deaths: 36721, color: 'blue' },
      { name: "Dwayna's Temple", kills: 29069, deaths: 37052, color: 'green' },
    ]
  },
  {
    tier: 'NA-2',
    worlds: [
      { name: 'Moogooloo', kills: 44646, deaths: 40240, color: 'red' },
      { name: 'Tombs of Drascir', kills: 25657, deaths: 38383, color: 'blue' },
      { name: 'Yohlon Haven', kills: 44304, deaths: 39170, color: 'green' },
    ]
  },
  {
    tier: 'NA-3',
    worlds: [
      { name: 'Hall of Judgment', kills: 48296, deaths: 38998, color: 'red' },
      { name: 'Domain of Torment', kills: 32273, deaths: 39899, color: 'blue' },
      { name: "Abbaddon's Prison", kills: 36349, deaths: 41337, color: 'green' },
    ]
  },
  {
    tier: 'EU-1',
    worlds: [
      { name: 'Frost Citadel', kills: 2737, deaths: 2430, color: 'red' },
      { name: "Ettin's Back", kills: 2033, deaths: 2781, color: 'blue' },
      { name: 'Skrittsburgh', kills: 2526, deaths: 2324, color: 'green' },
    ]
  },
]

export default function MatchesPage() {
  return (
    <div className="min-h-screen">
      <MatchesHeader />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="brushstroke-accent rounded-lg">
          <RegionTabs />
        </div>
        
        <MatchesGrid matches={mockMatches} />
      </main>
    </div>
  )
}
