'use client'

import { useState } from 'react'
import type { Specialization, Trait, SpecializationSelection } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface TraitLineSelectorProps {
  availableSpecializations: Specialization[]
  selectedLines: SpecializationSelection[]
  allTraits: Trait[]
  onUpdateLines: (lines: SpecializationSelection[]) => void
  maxLines?: number
}

/**
 * TraitLineSelector - Interactive trait line and trait picker
 * Allows selection of 3 specializations and traits within each
 */
export function TraitLineSelector({
  availableSpecializations,
  selectedLines,
  allTraits,
  onUpdateLines,
  maxLines = 3,
}: TraitLineSelectorProps) {
  const [selectingLineIndex, setSelectingLineIndex] = useState<number | null>(null)

  const handleSelectSpecialization = (specId: number) => {
    if (selectingLineIndex === null) return

    const newLines = [...selectedLines]
    newLines[selectingLineIndex] = {
      id: specId,
      traits: [0, 0, 0], // Default to first trait in each tier
    }
    onUpdateLines(newLines)
    setSelectingLineIndex(null)
  }

  const handleSelectTrait = (lineIndex: number, tierIndex: number, traitId: number) => {
    const newLines = [...selectedLines]
    const line = newLines[lineIndex]
    if (line) {
      const newTraits = [...line.traits] as [number, number, number]
      newTraits[tierIndex] = traitId
      line.traits = newTraits
      onUpdateLines(newLines)
    }
  }

  const handleRemoveLine = (lineIndex: number) => {
    const newLines = selectedLines.filter((_, i) => i !== lineIndex)
    onUpdateLines(newLines)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trait Lines</CardTitle>
        <CardDescription>
          Select up to {maxLines} specializations and choose traits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected trait lines */}
        {selectedLines.map((line, lineIndex) => {
          const spec = availableSpecializations.find((s) => s.id === line.id)
          if (!spec) return null

          return (
            <TraitLineDisplay
              key={lineIndex}
              specialization={spec}
              selection={line}
              allTraits={allTraits}
              onSelectTrait={(tierIndex, traitId) =>
                handleSelectTrait(lineIndex, tierIndex, traitId)
              }
              onRemove={() => handleRemoveLine(lineIndex)}
            />
          )
        })}

        {/* Add new line button */}
        {selectedLines.length < maxLines && (
          <>
            {selectingLineIndex === null ? (
              <Button
                onClick={() => setSelectingLineIndex(selectedLines.length)}
                variant="outline"
                className="w-full"
              >
                + Add Specialization
              </Button>
            ) : (
              <div className="p-4 border-2 border-dashed rounded-lg space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Select a specialization</span>
                  <Button
                    onClick={() => setSelectingLineIndex(null)}
                    variant="ghost"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {availableSpecializations
                    .filter((spec) => !selectedLines.some((l) => l.id === spec.id))
                    .map((spec) => (
                      <button
                        key={spec.id}
                        onClick={() => handleSelectSpecialization(spec.id)}
                        className="relative overflow-hidden rounded-lg border-2 border-border hover:border-primary hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <div
                          className="aspect-square bg-cover bg-center"
                          style={{ backgroundImage: `url(${spec.background})` }}
                        >
                          {spec.icon && (
                            <img
                              src={spec.icon}
                              alt={spec.name}
                              className="w-full h-full object-contain p-1 drop-shadow-lg"
                            />
                          )}
                        </div>
                        <div className="py-1 text-center text-xs font-medium bg-card">
                          {spec.name}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Display for a single trait line with trait picker
 */
function TraitLineDisplay({
  specialization,
  selection,
  allTraits,
  onSelectTrait,
  onRemove,
}: {
  specialization: Specialization
  selection: SpecializationSelection
  allTraits: Trait[]
  onSelectTrait: (tierIndex: number, traitId: number) => void
  onRemove: () => void
}) {
  // Get traits for this specialization
  const specTraits = allTraits.filter((t) => t.specialization === specialization.id)

  // Group traits by tier
  const traitsByTier = {
    adept: specTraits.filter((t) => t.tier === 1),
    master: specTraits.filter((t) => t.tier === 2),
    grandmaster: specTraits.filter((t) => t.tier === 3),
  }

  return (
    <div
      className="relative p-2 rounded-lg border bg-gradient-to-r from-background to-muted/20"
      style={{ borderColor: `hsl(var(--primary) / 0.3)` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded bg-cover bg-center flex items-center justify-center"
          style={{ backgroundImage: `url(${specialization.background})` }}
        >
          {specialization.icon && (
            <img
              src={specialization.icon}
              alt={specialization.name}
              className="w-5 h-5 drop-shadow-lg"
            />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{specialization.name}</div>
        </div>
        <Button
          onClick={onRemove}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Trait tiers */}
      <div className="space-y-1.5">
        {/* Adept (Tier 1) */}
        <TraitTier
          label="Adept"
          traits={traitsByTier.adept}
          selectedId={selection.traits[0]}
          onSelect={(id) => onSelectTrait(0, id)}
        />

        {/* Master (Tier 2) */}
        <TraitTier
          label="Master"
          traits={traitsByTier.master}
          selectedId={selection.traits[1]}
          onSelect={(id) => onSelectTrait(1, id)}
        />

        {/* Grandmaster (Tier 3) */}
        <TraitTier
          label="Grandmaster"
          traits={traitsByTier.grandmaster}
          selectedId={selection.traits[2]}
          onSelect={(id) => onSelectTrait(2, id)}
        />
      </div>
    </div>
  )
}

/**
 * Single trait tier with 3 trait options
 */
function TraitTier({
  label,
  traits,
  selectedId,
  onSelect,
}: {
  label: string
  traits: Trait[]
  selectedId: number
  onSelect: (traitId: number) => void
}) {
  // Only show major traits (player-selectable)
  const majorTraits = traits.filter((t) => t.slot === 'Major')

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="flex-1 flex gap-1.5">
        {majorTraits.map((trait) => (
          <TraitButton
            key={trait.id}
            trait={trait}
            isSelected={trait.id === selectedId}
            onSelect={() => onSelect(trait.id)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Individual trait button with hover tooltip
 */
function TraitButton({
  trait,
  isSelected,
  onSelect,
}: {
  trait: Trait
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            'flex-1 aspect-square rounded border-2 transition-all',
            'hover:scale-105 hover:shadow-md',
            'focus:outline-none focus:ring-1 focus:ring-primary',
            isSelected
              ? 'border-primary bg-primary/10 scale-105 shadow-md'
              : 'border-border hover:border-primary/50 bg-card'
          )}
        >
          {trait.icon && (
            <img
              src={trait.icon}
              alt={trait.name}
              className={cn(
                'w-full h-full object-contain p-0.5',
                !isSelected && 'opacity-70 hover:opacity-100'
              )}
            />
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {trait.icon && (
              <img
                src={trait.icon}
                alt={trait.name}
                className="w-8 h-8 rounded border"
              />
            )}
            <div className="flex-1">
              <div className="text-sm font-semibold">{trait.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {trait.tier === 1 ? 'Adept' : trait.tier === 2 ? 'Master' : 'Grandmaster'} Trait
              </div>
            </div>
          </div>
          <p className="text-xs text-foreground">{trait.description}</p>
          {trait.facts && trait.facts.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              {trait.facts.map((fact, i) => (
                <TraitFactDisplay key={i} fact={fact} />
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Enhanced fact display component for traits showing detailed information
 */
function TraitFactDisplay({ fact }: { fact: any }) {
  const renderFactValue = () => {
    switch (fact.type) {
      case 'Damage':
        return (
          <span className="font-medium text-orange-400">
            {fact.hit_count ? `${fact.hit_count}x ` : ''}
            Damage: {fact.damage || fact.dmg_multiplier ? `${fact.dmg_multiplier || 1}x` : '?'}
          </span>
        )

      case 'Heal':
      case 'HealingAdjust':
        return (
          <span className="font-medium text-green-400">
            Healing: {fact.hit_count || '?'}
          </span>
        )

      case 'Buff':
      case 'PrefixedBuff':
        return (
          <span className="font-medium text-blue-400">
            {fact.status || fact.description || fact.text}
            {fact.duration ? ` (${fact.duration}s)` : ''}
            {fact.apply_count ? ` x${fact.apply_count}` : ''}
          </span>
        )

      case 'Duration':
        return (
          <span className="font-medium text-purple-400">
            Duration: {fact.duration}s
          </span>
        )

      case 'Distance':
      case 'Range':
        return (
          <span className="font-medium text-cyan-400">
            {fact.type}: {fact.distance}
          </span>
        )

      case 'Radius':
        return (
          <span className="font-medium text-cyan-400">
            Radius: {fact.distance}
          </span>
        )

      case 'Recharge':
        return (
          <span className="font-medium text-gray-400">
            Recharge: {fact.value}s
          </span>
        )

      case 'Number':
        return (
          <span className="font-medium">
            {fact.text}
          </span>
        )

      case 'Percent':
        return (
          <span className="font-medium text-yellow-400">
            {fact.text}: {fact.percent}%
          </span>
        )

      case 'ComboField':
        return (
          <span className="font-medium text-indigo-400">
            Combo Field: {fact.field_type}
          </span>
        )

      case 'ComboFinisher':
        return (
          <span className="font-medium text-indigo-400">
            Combo Finisher: {fact.finisher_type} ({fact.percent}%)
          </span>
        )

      case 'StunBreak':
        return (
          <span className="font-medium text-red-400">
            Breaks Stun
          </span>
        )

      case 'Unblockable':
        return (
          <span className="font-medium text-red-400">
            Unblockable
          </span>
        )

      case 'AttributeAdjust':
        return (
          <span className="font-medium text-amber-400">
            {fact.text}
          </span>
        )

      case 'Time':
        return (
          <span className="font-medium">
            {fact.text}: {fact.duration}s
          </span>
        )

      default:
        return (
          <span className="text-muted-foreground">
            {fact.text}
          </span>
        )
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {fact.icon && (
        <img src={fact.icon} alt="" className="w-4 h-4 flex-shrink-0" />
      )}
      {renderFactValue()}
    </div>
  )
}
