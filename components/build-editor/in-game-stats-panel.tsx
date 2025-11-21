'use client'

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
  TrendingUp
} from 'lucide-react'

interface InGameStatsPanelProps {
  stats: CalculatedStats | null
}

/**
 * In-game styled stats panel matching GW2's attribute display
 */
export function InGameStatsPanel({ stats }: InGameStatsPanelProps) {
  if (!stats) {
    return (
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 h-full flex items-center justify-center">
        <div className="text-white/30 text-sm">No stats calculated</div>
      </div>
    )
  }

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 space-y-6">
      {/* Header */}
      <div>
        <div className="text-white font-semibold text-lg mb-1">Attributes</div>
        <div className="text-white/50 text-xs">Character Stats</div>
      </div>

      {/* Primary Stats */}
      <div className="space-y-3">
        <StatRow
          icon={Sword}
          value={stats.power}
          color="text-red-400"
          label="Power"
        />
        <StatRow
          icon={Target}
          value={stats.precision}
          percentage={(stats.critChance).toFixed(1) + '%'}
          color="text-red-400"
          label="Precision"
        />
        <StatRow
          icon={Zap}
          value={stats.ferocity}
          percentage={(stats.critDamage * 100).toFixed(0) + '%'}
          color="text-red-400"
          label="Ferocity"
        />
      </div>

      {/* Defense Stats */}
      <div className="space-y-3">
        <StatRow
          icon={Shield}
          value={stats.toughness}
          color="text-blue-400"
          label="Toughness"
        />
        <StatRow
          icon={Heart}
          value={stats.vitality}
          secondary={stats.health.toLocaleString()}
          color="text-blue-400"
          label="Vitality"
        />
      </div>

      {/* Condition Stats */}
      <div className="space-y-3">
        <StatRow
          icon={Flame}
          value={stats.conditionDamage}
          color="text-purple-400"
          label="Condition Damage"
        />
        <StatRow
          icon={Clock}
          value={stats.expertise}
          percentage={(stats.conditionDuration).toFixed(1) + '%'}
          color="text-purple-400"
          label="Expertise"
        />
        <StatRow
          icon={Sparkles}
          value={stats.concentration}
          percentage={(stats.boonDuration).toFixed(1) + '%'}
          color="text-purple-400"
          label="Concentration"
        />
        <StatRow
          icon={Activity}
          value={stats.healingPower}
          color="text-green-400"
          label="Healing Power"
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
    </div>
  )
}

/**
 * Individual stat row with icon
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
