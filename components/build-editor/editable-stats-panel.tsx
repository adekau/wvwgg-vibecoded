'use client'

import { useState } from 'react'
import type { CalculatedStats } from '@/lib/gw2/types'
import { cn } from '@/lib/utils'
import {
  Sword,
  Target,
  Zap,
  Shield,
  Heart,
  Flame,
  Clock,
  Sparkles,
  Activity,
  TrendingUp,
  Pencil,
  Check,
  X
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface TargetStats {
  power?: number
  precision?: number
  ferocity?: number
  vitality?: number
  toughness?: number
  conditionDamage?: number
  expertise?: number
  concentration?: number
  healingPower?: number
}

interface EditableStatsPanelProps {
  stats: CalculatedStats | null
  targetStats?: TargetStats
  onTargetStatsChange?: (stats: TargetStats) => void
}

/**
 * In-game styled stats panel with editable target stats
 */
export function EditableStatsPanel({
  stats,
  targetStats = {},
  onTargetStatsChange
}: EditableStatsPanelProps) {
  const [editingMode, setEditingMode] = useState(false)
  const [tempTargets, setTempTargets] = useState<TargetStats>(targetStats)

  if (!stats) {
    return (
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 h-full flex items-center justify-center">
        <div className="text-white/30 text-sm">No stats calculated</div>
      </div>
    )
  }

  const handleEdit = () => {
    setTempTargets(targetStats)
    setEditingMode(true)
  }

  const handleSave = () => {
    onTargetStatsChange?.(tempTargets)
    setEditingMode(false)
  }

  const handleCancel = () => {
    setTempTargets(targetStats)
    setEditingMode(false)
  }

  const handleTargetChange = (stat: keyof TargetStats, value: string) => {
    const numValue = parseInt(value) || 0
    setTempTargets(prev => ({ ...prev, [stat]: numValue }))
  }

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-semibold text-lg mb-1">Attributes</div>
          <div className="text-white/50 text-xs">
            {editingMode ? 'Edit Target Stats' : 'Character Stats'}
          </div>
        </div>
        {!editingMode ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-white/50 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="text-green-400 hover:text-green-300 hover:bg-white/10"
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Primary Stats */}
      <div className="space-y-3">
        <EditableStatRow
          icon={Sword}
          value={stats.power}
          target={tempTargets.power}
          color="text-red-400"
          label="Power"
          statKey="power"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
        <EditableStatRow
          icon={Target}
          value={stats.precision}
          target={tempTargets.precision}
          percentage={(stats.critChance).toFixed(1) + '%'}
          color="text-red-400"
          label="Precision"
          statKey="precision"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
        <EditableStatRow
          icon={Zap}
          value={stats.ferocity}
          target={tempTargets.ferocity}
          percentage={(stats.critDamage * 100).toFixed(0) + '%'}
          color="text-red-400"
          label="Ferocity"
          statKey="ferocity"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
      </div>

      {/* Defense Stats */}
      <div className="space-y-3">
        <EditableStatRow
          icon={Shield}
          value={stats.toughness}
          target={tempTargets.toughness}
          color="text-blue-400"
          label="Toughness"
          statKey="toughness"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
        <EditableStatRow
          icon={Heart}
          value={stats.vitality}
          target={tempTargets.vitality}
          secondary={stats.health.toLocaleString()}
          color="text-blue-400"
          label="Vitality"
          statKey="vitality"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
      </div>

      {/* Condition Stats */}
      <div className="space-y-3">
        <EditableStatRow
          icon={Flame}
          value={stats.conditionDamage}
          target={tempTargets.conditionDamage}
          color="text-purple-400"
          label="Condition Damage"
          statKey="conditionDamage"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
        <EditableStatRow
          icon={Clock}
          value={stats.expertise}
          target={tempTargets.expertise}
          percentage={(stats.conditionDuration).toFixed(1) + '%'}
          color="text-purple-400"
          label="Expertise"
          statKey="expertise"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
        <EditableStatRow
          icon={Sparkles}
          value={stats.concentration}
          target={tempTargets.concentration}
          percentage={(stats.boonDuration).toFixed(1) + '%'}
          color="text-purple-400"
          label="Concentration"
          statKey="concentration"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
        <EditableStatRow
          icon={Activity}
          value={stats.healingPower}
          target={tempTargets.healingPower}
          color="text-green-400"
          label="Healing Power"
          statKey="healingPower"
          editing={editingMode}
          onTargetChange={handleTargetChange}
        />
      </div>

      {/* Derived Stats Separator */}
      <div className="border-t border-white/10 pt-3">
        <div className="text-white/50 text-xs mb-3">Derived Stats</div>
        <div className="space-y-3">
          <StatRow
            icon={TrendingUp}
            value={stats.armor}
            color="text-cyan-400"
            label="Armor"
          />
          <StatRow
            icon={Heart}
            value={stats.health}
            percentage={(stats.effectiveHealth / 1000).toFixed(1) + 'K EH'}
            color="text-cyan-400"
            label="Health"
          />
        </div>
      </div>

      {/* Effective Metrics */}
      <div className="border-t border-white/10 pt-3">
        <div className="text-amber-400 text-xs font-semibold mb-3">Effective Metrics</div>
        <div className="space-y-2">
          <EffectiveStat
            label="Effective Power"
            value={(stats.effectivePower / 1000).toFixed(1) + 'K'}
          />
          <EffectiveStat
            label="Effective Health"
            value={(stats.effectiveHealth / 1000).toFixed(1) + 'K'}
          />
          <EffectiveStat
            label="Bruiser Score"
            value={(stats.effectiveHealthPower / 1_000_000).toFixed(2) + 'M'}
          />
        </div>
      </div>

      {editingMode && (
        <div className="border-t border-white/10 pt-3">
          <div className="text-amber-400 text-xs mb-2">
            Set target stats for gear optimization
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual stat row with editable target
 */
function EditableStatRow({
  icon: Icon,
  value,
  target,
  percentage,
  secondary,
  color,
  label,
  statKey,
  editing,
  onTargetChange,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number
  target?: number
  percentage?: string
  secondary?: string
  color: string
  label: string
  statKey: string
  editing: boolean
  onTargetChange: (stat: string, value: string) => void
}) {
  const hasTarget = target !== undefined && target > 0
  const difference = hasTarget ? value - target : 0
  const isAboveTarget = difference > 0
  const isBelowTarget = difference < 0

  return (
    <div className="flex items-center gap-3">
      <Icon className={cn('w-5 h-5', color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-white text-sm">{value.toLocaleString()}</span>
            {hasTarget && !editing && (
              <span
                className={cn(
                  'text-xs font-medium',
                  isAboveTarget && 'text-green-400',
                  isBelowTarget && 'text-red-400'
                )}
              >
                {isAboveTarget && `+${difference}`}
                {isBelowTarget && difference}
              </span>
            )}
          </div>
          {percentage && (
            <span className={cn('text-xs font-medium', color)}>{percentage}</span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-white/50 text-xs">{label}</span>
            {editing && (
              <Input
                type="number"
                value={target || ''}
                onChange={(e) => onTargetChange(statKey, e.target.value)}
                placeholder="Target"
                className="h-6 text-xs w-20 bg-black/30 border-white/20 text-white"
              />
            )}
            {hasTarget && !editing && (
              <span className="text-white/30 text-xs">
                Target: {target.toLocaleString()}
              </span>
            )}
          </div>
          {secondary && (
            <span className="text-white/40 text-xs">{secondary}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Non-editable stat row for derived stats
 */
function StatRow({
  icon: Icon,
  value,
  percentage,
  secondary,
  color,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number
  percentage?: string
  secondary?: string
  color: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn('w-5 h-5', color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-white text-sm">{value.toLocaleString()}</span>
          {percentage && (
            <span className={cn('text-xs font-medium', color)}>{percentage}</span>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-white/50 text-xs">{label}</span>
          {secondary && (
            <span className="text-white/40 text-xs">{secondary}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Effective stat display
 */
function EffectiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/70 text-xs">{label}</span>
      <span className="text-amber-400 text-sm font-semibold">{value}</span>
    </div>
  )
}
