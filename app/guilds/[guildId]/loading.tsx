import { MatchesHeader } from '@/components/matches-header'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8">
        <Card className="panel-border inset-card">
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading guild details...</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
