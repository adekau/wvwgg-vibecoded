'use client'

import { useState, useEffect } from 'react'
import type { Specialization, ProfessionId } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { extractDominantColor, rgbToOklch, type RGB } from '@/lib/color-extractor'

interface SpecializationSelectorProps {
  specializations: Specialization[]
  professionId: ProfessionId
  selected: number | null
  onSelect: (specId: number | null) => void
}

/**
 * SpecializationButton - Individual specialization button with dynamic frosted color
 */
function SpecializationButton({
  spec,
  isSelected,
  onSelect,
}: {
  spec: Specialization
  isSelected: boolean
  onSelect: () => void
}) {
  const [dominantColor, setDominantColor] = useState<RGB | null>(null)
  const [oklchColor, setOklchColor] = useState<string>('')

  // Extract dominant color from icon
  useEffect(() => {
    if (spec.icon) {
      extractDominantColor(spec.icon, 3)
        .then((color) => {
          setDominantColor(color)
          setOklchColor(rgbToOklch(color))
        })
        .catch((err) => {
          console.error('Failed to extract color from specialization icon:', err)
          // Fallback to a default color
          setOklchColor('0.60 0.18 230') // Default blue
        })
    }
  }, [spec.icon])

  // Generate dynamic frosted card styles
  const getFrostedCardStyle = () => {
    if (!oklchColor) return {}

    return {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      backdropFilter: 'blur(6px) saturate(180%)',
      boxShadow: `
        0 1px 2px 0 rgb(0 0 0 / 0.08),
        0 2px 4px 0 rgb(0 0 0 / 0.06),
        0 4px 8px 0 rgb(0 0 0 / 0.05),
        0 0 0 1px rgb(0 0 0 / 0.03)
      `,
      border: `1px solid oklch(${oklchColor} / 0.25)`,
    }
  }

  const getBackgroundOverlays = () => {
    if (!oklchColor) return {}

    // Create the blurred background and color overlay layers
    return {
      '--spec-color': oklchColor,
    } as React.CSSProperties
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative overflow-hidden rounded-lg border-2 transition-all',
        'hover:scale-105 hover:shadow-md',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'frosted-spec-card',
        isSelected
          ? 'border-primary shadow-md scale-105'
          : 'border-border hover:border-primary/50'
      )}
      style={{
        ...getFrostedCardStyle(),
        ...getBackgroundOverlays(),
      }}
    >
      {/* Blurred background layer */}
      <div
        className="absolute inset-0 -z-2 frosted-spec-bg"
        style={{
          borderRadius: 'inherit',
          backgroundImage: `
            radial-gradient(circle at 15% 25%, rgba(0, 0, 0, 0.20), transparent 30%),
            radial-gradient(circle at 85% 15%, rgba(0, 0, 0, 0.15), transparent 25%),
            radial-gradient(circle at 50% 80%, rgba(0, 0, 0, 0.25), transparent 35%),
            radial-gradient(circle at 75% 60%, rgba(0, 0, 0, 0.12), transparent 20%),
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px),
            repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0, 0, 0, 0.02) 3px, rgba(0, 0, 0, 0.02) 6px),
            radial-gradient(circle at 20% 30%, rgba(0, 0, 0, 0.04) 0%, transparent 3%),
            radial-gradient(circle at 60% 70%, rgba(0, 0, 0, 0.03) 0%, transparent 4%),
            radial-gradient(circle at 80% 20%, rgba(0, 0, 0, 0.04) 0%, transparent 2%)
          `,
          backgroundColor: 'rgba(255 255 255 / 0.4)',
          filter: 'blur(3px)',
          pointerEvents: 'none' as const,
        }}
      />

      {/* Color overlay - light mode */}
      {oklchColor && (
        <>
          <div
            className="absolute inset-0 -z-1 dark:hidden"
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255, 255, 255, 0.02) 1px, rgba(255, 255, 255, 0.02) 2px),
                repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255, 255, 255, 0.02) 1px, rgba(255, 255, 255, 0.02) 2px)
              `,
              backgroundColor: `oklch(${oklchColor} / 0.10)`,
              pointerEvents: 'none' as const,
            }}
          />
          {/* Color overlay - dark mode */}
          <div
            className="absolute inset-0 -z-1 hidden dark:block"
            style={{
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 0, 0, 0.03) 1px, rgba(0, 0, 0, 0.03) 2px),
                repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0, 0, 0, 0.03) 1px, rgba(0, 0, 0, 0.03) 2px)
              `,
              backgroundColor: `oklch(${oklchColor} / 0.08)`,
              pointerEvents: 'none' as const,
            }}
          />
        </>
      )}

      <div
        className="w-12 h-12 bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url(${spec.background})` }}
      >
        {spec.icon && (
          <img
            src={spec.icon}
            alt={spec.name}
            className="max-w-full max-h-full object-contain p-0.5 drop-shadow-lg"
          />
        )}
      </div>

      <div
        className={cn(
          'py-1 text-center text-xs font-medium',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-foreground'
        )}
      >
        {spec.name}
      </div>

      {isSelected && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary border border-white shadow-lg" />
      )}
    </button>
  )
}

/**
 * SpecializationSelector - Elite specialization picker
 */
export function SpecializationSelector({
  specializations,
  professionId,
  selected,
  onSelect,
}: SpecializationSelectorProps) {
  // Filter for elite specs of the current profession
  const eliteSpecs = specializations.filter(
    (spec) => spec.elite && spec.profession === professionId
  )

  if (eliteSpecs.length === 0) {
    return null
  }

  return (
    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-white/80 mb-3">Elite Specialization</h2>
      <div className="flex flex-wrap gap-2">
          {/* None option */}
          <button
            onClick={() => onSelect(null)}
            className={cn(
              'relative overflow-hidden rounded-lg border-2 transition-all',
              'hover:scale-105 hover:shadow-md',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              selected === null
                ? 'border-primary shadow-md scale-105'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div className="w-12 h-12 flex items-center justify-center bg-muted">
              <span className="text-lg text-muted-foreground">∅</span>
            </div>
            <div
              className={cn(
                'py-1 text-center text-xs font-medium',
                selected === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground'
              )}
            >
              None
            </div>
          </button>

          {/* Elite specializations */}
          {eliteSpecs.map((spec) => (
            <SpecializationButton
              key={spec.id}
              spec={spec}
              isSelected={spec.id === selected}
              onSelect={() => onSelect(spec.id)}
            />
          ))}
      </div>
    </div>
  )
}

/**
 * Compact specialization display (for summary views)
 */
export function SpecializationBadge({
  specialization,
}: {
  specialization: Specialization | null
}) {
  if (!specialization) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground">
        <span>Core Specialization</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary border border-primary/20">
      {specialization.icon && (
        <img
          src={specialization.icon}
          alt={specialization.name}
          className="w-4 h-4"
        />
      )}
      <span className="font-medium">{specialization.name}</span>
    </div>
  )
}
