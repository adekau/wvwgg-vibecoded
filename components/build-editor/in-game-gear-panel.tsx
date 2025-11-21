'use client'

import { useState } from 'react'
import type { GearSelection, GearPiece, WeaponPiece, ItemStat, Item, ItemRarity, WeaponType } from '@/lib/gw2/types'
import { isTwoHandedWeapon, isOffHandOnly, TWO_HANDED_WEAPONS, MAIN_HAND_WEAPONS, OFF_HAND_ONLY_WEAPONS } from '@/lib/gw2/types'
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
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Swords, Shield, Search } from 'lucide-react'

interface InGameGearPanelProps {
  gear: GearSelection
  itemStats: ItemStat[]
  runes: Item[]
  sigils: Item[]
  onUpdateGear: (gear: GearSelection) => void
}

type GearSlot = 'helm' | 'shoulders' | 'coat' | 'gloves' | 'leggings' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'accessory1' | 'accessory2' | 'backItem' | 'relic'
type WeaponSlot = 'weaponSet1Main' | 'weaponSet1Off' | 'weaponSet2Main' | 'weaponSet2Off'

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

  // Check if weapon set 1 main hand is two-handed
  const weaponSet1MainHand = gear.weaponSet1Main
  const isSet1TwoHanded = weaponSet1MainHand && isTwoHandedWeapon(weaponSet1MainHand.weaponType)

  // Check if weapon set 2 main hand is two-handed
  const weaponSet2MainHand = gear.weaponSet2Main
  const isSet2TwoHanded = weaponSet2MainHand && isTwoHandedWeapon(weaponSet2MainHand.weaponType)

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
    { type: 'header', label: 'Weapon Set 1' },
    { key: 'weaponSet1Main' as const, label: 'Main Hand', icon: Swords },
    { key: 'weaponSet1Off' as const, label: 'Off Hand', icon: Shield, disabled: isSet1TwoHanded },
    { type: 'separator' },
    { type: 'header', label: 'Weapon Set 2' },
    { key: 'weaponSet2Main' as const, label: 'Main Hand', icon: Swords },
    { key: 'weaponSet2Off' as const, label: 'Off Hand', icon: Shield, disabled: isSet2TwoHanded },
  ]

  return (
    <div className="space-y-1">
      {slots.map((slot, idx) => {
        if (slot.type === 'separator') {
          return <div key={idx} className="h-2" />
        }

        if (slot.type === 'header') {
          return (
            <div key={idx} className="text-xs text-white/60 font-semibold uppercase pt-1 pb-1">
              {slot.label}
            </div>
          )
        }

        const slotKey = slot.key as GearSlot | WeaponSlot
        const piece = gear[slotKey] as GearPiece | WeaponPiece | undefined

        // Handle disabled off-hand slots (when main hand is two-handed)
        if (slot.disabled) {
          return (
            <div
              key={slotKey}
              className="w-full p-2 bg-black/20 backdrop-blur-sm border border-white/5 rounded opacity-50"
            >
              <div className="flex items-center gap-2">
                {slot.icon && <slot.icon className="w-4 h-4 text-white/30" />}
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[10px] text-white/30 uppercase font-medium">{slot.label}</div>
                  <div className="text-xs text-white/30">Disabled</div>
                </div>
              </div>
            </div>
          )
        }

        if (!piece) return null

        const statName = getStatName(piece.statId)
        const isWeapon = slotKey.includes('weapon')
        const weaponPiece = isWeapon ? (piece as WeaponPiece) : null
        const upgrade = isWeapon
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
                {weaponPiece && (
                  <div className="text-xs text-amber-400 font-medium">{weaponPiece.weaponType}</div>
                )}
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
  piece: GearPiece | WeaponPiece
  itemStats: ItemStat[]
  upgrades: Item[]
  onSave: (piece: GearPiece | WeaponPiece) => void
}) {
  const isWeapon = slot.includes('weapon')
  const weaponPiece = isWeapon ? (piece as WeaponPiece) : null
  const isOffHand = slot.includes('Off')

  const [selectedStat, setSelectedStat] = useState(piece.statId)
  const [selectedRarity, setSelectedRarity] = useState<ItemRarity>(piece.rarity)
  const [selectedUpgrade, setSelectedUpgrade] = useState<number | undefined>(piece.upgradeId)
  const [selectedWeaponType, setSelectedWeaponType] = useState<WeaponType | undefined>(
    weaponPiece?.weaponType
  )
  const [searchTerm, setSearchTerm] = useState('')

  const currentStats = itemStats.find(s => s.id === piece.statId)
  const newStats = itemStats.find(s => s.id === selectedStat)

  // Get available weapon types based on slot
  const availableWeaponTypes = isWeapon
    ? isOffHand
      ? [...MAIN_HAND_WEAPONS, ...OFF_HAND_ONLY_WEAPONS] // Off-hand can use one-handed or off-hand only
      : [...TWO_HANDED_WEAPONS, ...MAIN_HAND_WEAPONS] // Main-hand can use two-handed or one-handed
    : []

  const handleSave = () => {
    if (isWeapon && selectedWeaponType) {
      onSave({
        ...piece,
        statId: selectedStat,
        rarity: selectedRarity,
        upgradeId: selectedUpgrade,
        weaponType: selectedWeaponType,
      } as WeaponPiece)
    } else {
      onSave({
        ...piece,
        statId: selectedStat,
        rarity: selectedRarity,
        upgradeId: selectedUpgrade,
      })
    }
  }

  const filteredStats = itemStats.filter(stat =>
    stat.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl bg-slate-900 border-white/20 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isWeapon ? 'Customize Weapon' : 'Customize Equipment'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Weapon Type Selection (for weapons only) */}
          {isWeapon && (
            <div className="mb-6">
              <div className="text-sm text-white/70 mb-3">Weapon Type</div>
              <div className="grid grid-cols-6 gap-2">
                {availableWeaponTypes.map((weaponType) => (
                  <button
                    key={weaponType}
                    onClick={() => setSelectedWeaponType(weaponType)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-sm font-medium',
                      selectedWeaponType === weaponType
                        ? 'border-amber-500 bg-amber-500/20 text-white'
                        : 'border-white/10 bg-black/40 text-white/70 hover:border-white/30'
                    )}
                  >
                    {weaponType}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats Selection */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left side - Current stats */}
            <div className="space-y-3">
              <div className="text-sm text-white/70 mb-2">Current Stats</div>
              <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4">
                {isWeapon && weaponPiece && (
                  <div className="text-amber-400 font-medium mb-2">{weaponPiece.weaponType}</div>
                )}
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

            {/* Right side - Available stats */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Search stats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-black/40 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {filteredStats.slice(0, 30).map((stat) => (
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
