import { Card, CardContent } from '@/components/ui/card'

export default function DetailDefault() {
  return (
    <Card className="panel-border inset-card flex-1 hidden lg:flex items-center justify-center">
      <CardContent className="text-center text-muted-foreground p-12">
        <p className="text-lg font-medium mb-2">No guild selected</p>
        <p className="text-sm">Select a guild from the list to view details</p>
      </CardContent>
    </Card>
  )
}
