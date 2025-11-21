'use client'

import { useState } from 'react'
import type { ProfessionId, Profession } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProfessionSelectorProps {
  professions: Profession[]
  selected: ProfessionId
  onSelect: (professionId: ProfessionId) => void
}

/**
 * Profession color themes for visual distinction
 */
const PROFESSION_COLORS: Record<ProfessionId, string> = {
  Guardian: 'from-blue-500 to-cyan-400',
  Warrior: 'from-yellow-600 to-amber-500',
  Engineer: 'from-amber-600 to-orange-500',
  Ranger: 'from-green-600 to-lime-500',
  Thief: 'from-gray-600 to-slate-500',
  Elementalist: 'from-red-500 to-pink-500',
  Mesmer: 'from-purple-600 to-pink-500',
  Necromancer: 'from-emerald-600 to-teal-500',
  Revenant: 'from-red-600 to-orange-600',
}

/**
 * ProfessionSelector - Visual profession picker with icons
 */
export function ProfessionSelector({
  professions,
  selected,
  onSelect,
}: ProfessionSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {professions.map((profession) => {
        const isSelected = profession.id === selected
        const colorClass = PROFESSION_COLORS[profession.id]

        return (
          <button
            key={profession.id}
            onClick={() => onSelect(profession.id)}
            className={cn(
              'relative overflow-hidden rounded-lg border-2 transition-all',
              'hover:scale-105 hover:shadow-lg',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isSelected
                ? 'border-primary shadow-lg scale-105'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div
              className={cn(
                'w-12 h-12 p-1.5 bg-gradient-to-br flex items-center justify-center',
                colorClass,
                !isSelected && 'opacity-60 hover:opacity-80'
              )}
            >
              {/* Profession icon from GW2 API */}
              {profession.icon_big && (
                <img
                  src={profession.icon_big}
                  alt={profession.name}
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              )}
            </div>

            {/* Profession name */}
            <div
              className={cn(
                'py-1 text-center text-xs font-medium',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground'
              )}
            >
              {profession.name}
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary border border-white shadow-lg" />
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Compact profession selector dropdown (alternative UI)
 */
export function ProfessionSelectorCompact({
  professions,
  selected,
  onSelect,
}: ProfessionSelectorProps) {
  const selectedProfession = professions.find((p) => p.id === selected)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
        {selectedProfession?.icon && (
          <div
            className={cn(
              'w-12 h-12 rounded-lg bg-gradient-to-br p-2',
              PROFESSION_COLORS[selected]
            )}
          >
            <img
              src={selectedProfession.icon}
              alt={selectedProfession.name}
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">Profession</div>
          <div className="font-semibold">{selectedProfession?.name}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Toggle dropdown or open modal
            // Implementation depends on UI pattern
          }}
        >
          Change
        </Button>
      </div>
    </div>
  )
}
