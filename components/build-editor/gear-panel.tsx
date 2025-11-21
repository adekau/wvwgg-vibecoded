'use client'

import { useState } from 'react'
import type { GearSelection, GearPiece, WeaponPiece, ItemStat, Item, ItemRarity } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface GearPanelProps {
  gear: GearSelection
  itemStats: ItemStat[]
  runes: Item[]
  sigils: Item[]
  onUpdateGear: (gear: GearSelection) => void
}

type GearSlot = keyof Omit<GearSelection, 'weaponSet1Main' | 'weaponSet1Off' | 'weaponSet2Main' | 'weaponSet2Off' | 'aquaticWeapon'>
type WeaponSlot = 'weaponSet1Main' | 'weaponSet1Off' | 'weaponSet2Main' | 'weaponSet2Off' | 'aquaticWeapon'

/**
 * GearPanel - Individual gear piece editor
 */
export function GearPanel({
  gear,
  itemStats,
  runes,
  sigils,
  onUpdateGear,
}: GearPanelProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment</CardTitle>
        <CardDescription>
          Configure your armor, trinkets, and weapons
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="armor" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="armor">Armor</TabsTrigger>
            <TabsTrigger value="trinkets">Trinkets</TabsTrigger>
            <TabsTrigger value="weapons">Weapons</TabsTrigger>
          </TabsList>

          {/* Armor Tab */}
          <TabsContent value="armor" className="space-y-2">
            <GearSlotButton
              label="Helm"
              statName={getStatName(gear.helm.statId)}
              rarity={gear.helm.rarity}
              upgrade={getRuneName(gear.helm.upgradeId)}
              onClick={() => setEditingSlot('helm')}
            />
            <GearSlotButton
              label="Shoulders"
              statName={getStatName(gear.shoulders.statId)}
              rarity={gear.shoulders.rarity}
              upgrade={getRuneName(gear.shoulders.upgradeId)}
              onClick={() => setEditingSlot('shoulders')}
            />
            <GearSlotButton
              label="Coat"
              statName={getStatName(gear.coat.statId)}
              rarity={gear.coat.rarity}
              upgrade={getRuneName(gear.coat.upgradeId)}
              onClick={() => setEditingSlot('coat')}
            />
            <GearSlotButton
              label="Gloves"
              statName={getStatName(gear.gloves.statId)}
              rarity={gear.gloves.rarity}
              upgrade={getRuneName(gear.gloves.upgradeId)}
              onClick={() => setEditingSlot('gloves')}
            />
            <GearSlotButton
              label="Leggings"
              statName={getStatName(gear.leggings.statId)}
              rarity={gear.leggings.rarity}
              upgrade={getRuneName(gear.leggings.upgradeId)}
              onClick={() => setEditingSlot('leggings')}
            />
            <GearSlotButton
              label="Boots"
              statName={getStatName(gear.boots.statId)}
              rarity={gear.boots.rarity}
              upgrade={getRuneName(gear.boots.upgradeId)}
              onClick={() => setEditingSlot('boots')}
            />
          </TabsContent>

          {/* Trinkets Tab */}
          <TabsContent value="trinkets" className="space-y-2">
            <GearSlotButton
              label="Amulet"
              statName={getStatName(gear.amulet.statId)}
              rarity={gear.amulet.rarity}
              onClick={() => setEditingSlot('amulet')}
            />
            <GearSlotButton
              label="Ring 1"
              statName={getStatName(gear.ring1.statId)}
              rarity={gear.ring1.rarity}
              onClick={() => setEditingSlot('ring1')}
            />
            <GearSlotButton
              label="Ring 2"
              statName={getStatName(gear.ring2.statId)}
              rarity={gear.ring2.rarity}
              onClick={() => setEditingSlot('ring2')}
            />
            <GearSlotButton
              label="Accessory 1"
              statName={getStatName(gear.accessory1.statId)}
              rarity={gear.accessory1.rarity}
              onClick={() => setEditingSlot('accessory1')}
            />
            <GearSlotButton
              label="Accessory 2"
              statName={getStatName(gear.accessory2.statId)}
              rarity={gear.accessory2.rarity}
              onClick={() => setEditingSlot('accessory2')}
            />
            <GearSlotButton
              label="Back Item"
              statName={getStatName(gear.backItem.statId)}
              rarity={gear.backItem.rarity}
              onClick={() => setEditingSlot('backItem')}
            />
          </TabsContent>

          {/* Weapons Tab */}
          <TabsContent value="weapons" className="space-y-2">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Weapon Set 1</div>
              <GearSlotButton
                label="Main Hand"
                statName={getStatName(gear.weaponSet1Main.statId)}
                rarity={gear.weaponSet1Main.rarity}
                upgrade={getSigilName(gear.weaponSet1Main.upgradeId)}
                onClick={() => setEditingSlot('weaponSet1Main')}
              />
              {gear.weaponSet1Off && (
                <GearSlotButton
                  label="Off Hand"
                  statName={getStatName(gear.weaponSet1Off.statId)}
                  rarity={gear.weaponSet1Off.rarity}
                  upgrade={getSigilName(gear.weaponSet1Off.upgradeId)}
                  onClick={() => setEditingSlot('weaponSet1Off')}
                />
              )}
            </div>

            {gear.weaponSet2Main && (
              <div className="space-y-1 pt-2">
                <div className="text-sm font-medium text-muted-foreground">Weapon Set 2</div>
                <GearSlotButton
                  label="Main Hand"
                  statName={getStatName(gear.weaponSet2Main.statId)}
                  rarity={gear.weaponSet2Main.rarity}
                  upgrade={getSigilName(gear.weaponSet2Main.upgradeId)}
                  onClick={() => setEditingSlot('weaponSet2Main')}
                />
                {gear.weaponSet2Off && (
                  <GearSlotButton
                    label="Off Hand"
                    statName={getStatName(gear.weaponSet2Off.statId)}
                    rarity={gear.weaponSet2Off.rarity}
                    upgrade={getSigilName(gear.weaponSet2Off.upgradeId)}
                    onClick={() => setEditingSlot('weaponSet2Off')}
                  />
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Gear editor dialog */}
        {editingSlot && (
          <GearEditorDialog
            open={editingSlot !== null}
            onClose={() => setEditingSlot(null)}
            slot={editingSlot}
            piece={gear[editingSlot] as GearPiece}
            itemStats={itemStats}
            upgrades={editingSlot.includes('weapon') ? sigils : runes}
            onSave={(piece) => handleUpdatePiece(editingSlot, piece)}
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Gear slot button showing current configuration
 */
function GearSlotButton({
  label,
  statName,
  rarity,
  upgrade,
  onClick,
}: {
  label: string
  statName: string
  rarity: ItemRarity
  upgrade?: string | null
  onClick: () => void
}) {
  const rarityColor = {
    Junk: 'text-gray-500',
    Common: 'text-white',
    Fine: 'text-blue-400',
    Masterwork: 'text-green-400',
    Rare: 'text-yellow-400',
    Exotic: 'text-orange-400',
    Ascended: 'text-pink-400',
    Legendary: 'text-purple-400',
  }[rarity]

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg border-2 border-border hover:border-primary transition-all bg-card text-left group"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className={cn('text-xs', rarityColor)}>{statName}</div>
          {upgrade && (
            <div className="text-xs text-muted-foreground mt-0.5">{upgrade}</div>
          )}
        </div>
        <div className="text-muted-foreground group-hover:text-primary transition-colors">
          →
        </div>
      </div>
    </button>
  )
}

/**
 * Gear editor dialog for configuring a single piece
 */
function GearEditorDialog({
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
  const [statId, setStatId] = useState(piece.statId)
  const [rarity, setRarity] = useState<ItemRarity>(piece.rarity)
  const [upgradeId, setUpgradeId] = useState<number | undefined>(piece.upgradeId)

  const handleSave = () => {
    onSave({
      ...piece,
      statId,
      rarity,
      upgradeId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure {slot}</DialogTitle>
          <DialogDescription>
            Set the stat combination, rarity, and upgrades
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stat Combination */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Stat Combination</label>
            <Select
              value={statId.toString()}
              onValueChange={(value) => setStatId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {itemStats.map((stat) => (
                  <SelectItem key={stat.id} value={stat.id.toString()}>
                    {stat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rarity */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rarity</label>
            <Select
              value={rarity}
              onValueChange={(value) => setRarity(value as ItemRarity)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Exotic">Exotic</SelectItem>
                <SelectItem value="Ascended">Ascended</SelectItem>
                <SelectItem value="Legendary">Legendary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Upgrade (Rune or Sigil) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {slot.includes('weapon') ? 'Sigil' : 'Rune'}
            </label>
            <Select
              value={upgradeId?.toString() || 'none'}
              onValueChange={(value) =>
                setUpgradeId(value === 'none' ? undefined : parseInt(value))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">None</SelectItem>
                {upgrades.slice(0, 50).map((upgrade) => (
                  <SelectItem key={upgrade.id} value={upgrade.id.toString()}>
                    {upgrade.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
