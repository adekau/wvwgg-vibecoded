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
                <div className="grid grid-cols-5 gap-2">
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
                              className="w-full h-full object-contain p-1.5 drop-shadow-lg"
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
      className="relative p-4 rounded-lg border-2 bg-gradient-to-r from-background to-muted/30"
      style={{ borderColor: `hsl(var(--primary) / 0.3)` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg bg-cover bg-center flex items-center justify-center"
          style={{ backgroundImage: `url(${specialization.background})` }}
        >
          {specialization.icon && (
            <img
              src={specialization.icon}
              alt={specialization.name}
              className="w-8 h-8 drop-shadow-lg"
            />
          )}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{specialization.name}</div>
          <div className="text-xs text-muted-foreground">
            {specialization.elite ? 'Elite Specialization' : 'Core Specialization'}
          </div>
        </div>
        <Button
          onClick={onRemove}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Trait tiers */}
      <div className="space-y-3">
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
    <div className="flex items-center gap-2">
      <div className="w-16 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex-1 flex gap-2">
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
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            'flex-1 aspect-square rounded-lg border-2 transition-all',
            'hover:scale-110 hover:shadow-lg',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            isSelected
              ? 'border-primary bg-primary/10 scale-110 shadow-lg'
              : 'border-border hover:border-primary/50 bg-card'
          )}
        >
          {trait.icon && (
            <img
              src={trait.icon}
              alt={trait.name}
              className={cn(
                'w-full h-full object-contain p-1',
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
            <div>
              <div className="font-semibold">{trait.name}</div>
              <div className="text-xs text-muted-foreground">
                {trait.tier === 1 ? 'Adept' : trait.tier === 2 ? 'Master' : 'Grandmaster'} Trait
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{trait.description}</p>
          {trait.facts && trait.facts.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              {trait.facts.slice(0, 3).map((fact, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  • {fact.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
