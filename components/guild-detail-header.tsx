'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'
import { IGuild } from '@/server/queries'
import { GuildUpdateModal } from '@/components/guild-update-modal'

interface GuildDetailHeaderProps {
  guild: IGuild
  allGuilds: IGuild[]
  classification?: string
}

export function GuildDetailHeader({ guild, allGuilds, classification }: GuildDetailHeaderProps) {
  const [updateModalOpen, setUpdateModalOpen] = useState(false)

  return (
    <>
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

        <Button
          variant="outline"
          size="sm"
          onClick={() => setUpdateModalOpen(true)}
        >
          <Shield className="h-4 w-4 mr-2" />
          Update Guild Info
        </Button>
      </div>

      <GuildUpdateModal
        guild={guild}
        allGuilds={allGuilds}
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        onSuccess={() => {
          // Refresh the page to show updated data
          window.location.reload()
        }}
      />
    </>
  )
}
