import { ReactNode } from 'react'
import { MatchesHeader } from '@/components/matches-header'

export default function GuildsInboxLayout({
  children,
  list,
  detail,
}: {
  children: ReactNode
  list: ReactNode
  detail: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <MatchesHeader />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {children}
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-24rem)]">
          {/* Left Panel - Guild List */}
          <div className="flex flex-col gap-4 w-full lg:w-1/2">
            {list}
          </div>

          {/* Right Panel - Guild Details */}
          <div className="flex flex-col w-full lg:w-1/2">
            {detail}
          </div>
        </div>
      </main>
    </div>
  )
}
