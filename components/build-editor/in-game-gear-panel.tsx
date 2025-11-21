'use client'

import { useState } from 'react'
import type { GearSelection, GearPiece, WeaponPiece, ItemStat, Item, ItemRarity } from '@/lib/gw2/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Swords, Shield } from 'lucide-react'

interface InGameGearPanelProps {
  gear: GearSelection
  itemStats: ItemStat[]
  runes: Item[]
  sigils: Item[]
  onUpdateGear: (gear: GearSelection) => void
}

type GearSlot = 'helm' | 'shoulders' | 'coat' | 'gloves' | 'leggings' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'accessory1' | 'accessory2' | 'backItem' | 'relic'
type WeaponSlot = 'weaponSet1Main' | 'weaponSet1Off'

/**
 * In-Game styled gear panel with vertical equipment slots
 */
export function InGameGearPanel({
  gear,
  itemStats,
  runes,
  sigils,
  onUpdateGear,
}: InGameGearPanelProps) {
  const [editingSlot, setEditingSlot] = useState<GearSlot | WeaponSlot | null>(null)

  const handleUpdatePiece = (slot: GearSlot | WeaponSlot, piece: GearPiece | WeaponPiece) => {
    onUpdateGear({
      ...gear,
      [slot]: piece,
    })
    setEditingSlot(null)
  }

  const getStatName = (statId: number) => {
    return itemStats.find((s) => s.id === statId)?.name || 'Unknown'
  }

  const getRuneName = (runeId?: number) => {
    if (!runeId) return null
    return runes.find((r) => r.id === runeId)?.name
  }

  const getSigilName = (sigilId?: number) => {
    if (!sigilId) return null
    return sigils.find((s) => s.id === sigilId)?.name
  }

  const rarityColor = (rarity: ItemRarity) => {
    return {
      Junk: 'text-gray-500',
      Common: 'text-white',
      Fine: 'text-blue-400',
      Masterwork: 'text-green-400',
      Rare: 'text-yellow-400',
      Exotic: 'text-orange-400',
      Ascended: 'text-pink-400',
      Legendary: 'text-purple-400',
    }[rarity]
  }

  const slots = [
    { key: 'helm' as const, label: 'Helm' },
    { key: 'shoulders' as const, label: 'Shoulders' },
    { key: 'coat' as const, label: 'Coat' },
    { key: 'gloves' as const, label: 'Gloves' },
    { key: 'leggings' as const, label: 'Leggings' },
    { key: 'boots' as const, label: 'Boots' },
    { type: 'separator' },
    { key: 'amulet' as const, label: 'Amulet' },
    { key: 'ring1' as const, label: 'Ring' },
    { key: 'ring2' as const, label: 'Ring' },
    { key: 'accessory1' as const, label: 'Accessory' },
    { key: 'accessory2' as const, label: 'Accessory' },
    { key: 'backItem' as const, label: 'Back' },
    { type: 'separator' },
    { key: 'weaponSet1Main' as const, label: 'Main Hand', icon: Swords },
    { key: 'weaponSet1Off' as const, label: 'Off Hand', icon: Shield },
  ]

  return (
    <div className="space-y-1">
      {slots.map((slot, idx) => {
        if (slot.type === 'separator') {
          return <div key={idx} className="h-2" />
        }

        const slotKey = slot.key as GearSlot | WeaponSlot
        const piece = gear[slotKey] as GearPiece | undefined

        if (!piece) return null

        const statName = getStatName(piece.statId)
        const upgrade = slotKey.includes('weapon')
          ? getSigilName(piece.upgradeId)
          : getRuneName(piece.upgradeId)

        return (
          <button
            key={slotKey}
            onClick={() => setEditingSlot(slotKey)}
            className="w-full p-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded hover:border-amber-500/50 transition-all hover:bg-black/60 group"
          >
            <div className="flex items-center gap-2">
              {slot.icon && <slot.icon className="w-4 h-4 text-white/50" />}
              <div className="flex-1 text-left min-w-0">
                <div className="text-[10px] text-white/50 uppercase font-medium">{slot.label}</div>
                <div className={cn('text-xs font-medium truncate', rarityColor(piece.rarity))}>
                  {statName}
                </div>
                {upgrade && (
                  <div className="text-[9px] text-white/40 truncate">{upgrade}</div>
                )}
              </div>
            </div>
          </button>
        )
      })}

      {/* Gear editor dialog */}
      {editingSlot && (
        <InGameGearEditor
          open={editingSlot !== null}
          onClose={() => setEditingSlot(null)}
          slot={editingSlot}
          piece={gear[editingSlot] as GearPiece}
          itemStats={itemStats}
          upgrades={editingSlot.includes('weapon') ? sigils : runes}
          onSave={(piece) => handleUpdatePiece(editingSlot, piece)}
        />
      )}
    </div>
  )
}

/**
 * In-game styled gear editor modal
 */
function InGameGearEditor({
  open,
  onClose,
  slot,
  piece,
  itemStats,
  upgrades,
  onSave,
}: {
  open: boolean
  onClose: () => void
  slot: string
  piece: GearPiece
  itemStats: ItemStat[]
  upgrades: Item[]
  onSave: (piece: GearPiece) => void
}) {
  const [selectedStat, setSelectedStat] = useState(piece.statId)
  const [selectedRarity, setSelectedRarity] = useState<ItemRarity>(piece.rarity)
  const [selectedUpgrade, setSelectedUpgrade] = useState<number | undefined>(piece.upgradeId)

  const currentStats = itemStats.find(s => s.id === piece.statId)
  const newStats = itemStats.find(s => s.id === selectedStat)

  const handleSave = () => {
    onSave({
      ...piece,
      statId: selectedStat,
      rarity: selectedRarity,
      upgradeId: selectedUpgrade,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-slate-900 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">Customize Equipment</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left side - Current equipment */}
          <div className="space-y-3">
            <div className="text-sm text-white/70 mb-2">Equipment</div>
            <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4">
              <div className="text-white font-medium mb-3">
                {currentStats?.name || 'Unknown'}
              </div>
              {currentStats && (
                <div className="space-y-1">
                  {currentStats.attributes.map((attr) => (
                    <div key={attr.attribute} className="flex justify-between text-sm">
                      <span className="text-green-400">+{attr.multiplier > 0 ? Math.round(attr.multiplier * 100) : attr.value}</span>
                      <span className="text-white/70">{attr.attribute}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Available options */}
          <div className="space-y-3">
            <div className="text-sm text-white/70 mb-2">Search...</div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {itemStats.slice(0, 30).map((stat) => (
                <button
                  key={stat.id}
                  onClick={() => setSelectedStat(stat.id)}
                  className={cn(
                    'w-full bg-black/40 backdrop-blur-sm border rounded-lg p-3 text-left transition-all',
                    selectedStat === stat.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-white/10 hover:border-white/30'
                  )}
                >
                  <div className="text-white font-medium mb-2">{stat.name}</div>
                  <div className="space-y-0.5">
                    {stat.attributes.map((attr) => (
                      <div key={attr.attribute} className="flex justify-between text-xs">
                        <span className="text-green-400">
                          +{attr.multiplier > 0 ? Math.round(attr.multiplier * 100) : attr.value}
                        </span>
                        <span className="text-white/60">{attr.attribute}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-black/30 border-white/20 hover:bg-black/50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
