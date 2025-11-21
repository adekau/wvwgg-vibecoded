'use client'

import type { Specialization, ProfessionId } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SpecializationSelectorProps {
  specializations: Specialization[]
  professionId: ProfessionId
  selected: number | null
  onSelect: (specId: number | null) => void
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
    <Card>
      <CardHeader>
        <CardTitle>Elite Specialization</CardTitle>
        <CardDescription>
          Optional: Select an elite specialization for advanced abilities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-2">
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
            <div className="aspect-square flex items-center justify-center bg-muted">
              <span className="text-xl text-muted-foreground">∅</span>
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
          {eliteSpecs.map((spec) => {
            const isSelected = spec.id === selected

            return (
              <button
                key={spec.id}
                onClick={() => onSelect(spec.id)}
                className={cn(
                  'relative overflow-hidden rounded-lg border-2 transition-all',
                  'hover:scale-105 hover:shadow-md',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  isSelected
                    ? 'border-primary shadow-md scale-105'
                    : 'border-border hover:border-primary/50'
                )}
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
          })}
        </div>
      </CardContent>
    </Card>
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
