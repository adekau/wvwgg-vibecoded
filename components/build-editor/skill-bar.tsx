'use client'

import { useState } from 'react'
import type { Skill, SkillSelection, ProfessionId, SkillSlot } from '@/lib/gw2/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

interface SkillBarProps {
  skills: Skill[]
  profession: ProfessionId
  selection: SkillSelection
  onUpdateSelection: (selection: SkillSelection) => void
}

type SkillSlotType = 'heal' | 'utility1' | 'utility2' | 'utility3' | 'elite'

/**
 * SkillBar - Interactive skill selection interface
 */
export function SkillBar({
  skills,
  profession,
  selection,
  onUpdateSelection,
}: SkillBarProps) {
  const [selectingSlot, setSelectingSlot] = useState<SkillSlotType | null>(null)

  const handleSelectSkill = (slot: SkillSlotType, skillId: number) => {
    onUpdateSelection({
      ...selection,
      [slot]: skillId,
    })
    setSelectingSlot(null)
  }

  const getSkillById = (id: number) => skills.find((s) => s.id === id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>
          Select your heal, utility, and elite skills
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2 max-w-md">
          {/* Heal Skill */}
          <SkillSlot
            skill={getSkillById(selection.heal)}
            type="Heal"
            onClick={() => setSelectingSlot('heal')}
          />

          {/* Utility Skills */}
          <SkillSlot
            skill={getSkillById(selection.utility1)}
            type="Utility"
            label="1"
            onClick={() => setSelectingSlot('utility1')}
          />
          <SkillSlot
            skill={getSkillById(selection.utility2)}
            type="Utility"
            label="2"
            onClick={() => setSelectingSlot('utility2')}
          />
          <SkillSlot
            skill={getSkillById(selection.utility3)}
            type="Utility"
            label="3"
            onClick={() => setSelectingSlot('utility3')}
          />

          {/* Elite Skill */}
          <SkillSlot
            skill={getSkillById(selection.elite)}
            type="Elite"
            onClick={() => setSelectingSlot('elite')}
          />
        </div>

        {/* Skill selector dialog */}
        {selectingSlot && (
          <SkillSelectorDialog
            open={selectingSlot !== null}
            onClose={() => setSelectingSlot(null)}
            skills={skills}
            profession={profession}
            slotType={selectingSlot}
            onSelect={(skillId) => handleSelectSkill(selectingSlot, skillId)}
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Individual skill slot button
 */
function SkillSlot({
  skill,
  type,
  label,
  onClick,
}: {
  skill?: Skill
  type: string
  label?: string
  onClick: () => void
}) {
  if (!skill) {
    return (
      <button
        onClick={onClick}
        className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary transition-all bg-muted/30 flex items-center justify-center group"
      >
        <div className="text-center">
          <div className="text-xl text-muted-foreground group-hover:text-primary transition-colors">
            +
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {type}
            {label && ` ${label}`}
          </div>
        </div>
      </button>
    )
  }

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button
          onClick={onClick}
          className="aspect-square rounded-lg border-2 border-primary/50 hover:border-primary hover:scale-105 transition-all bg-card overflow-hidden group"
        >
          <img
            src={skill.icon}
            alt={skill.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <SkillTooltip skill={skill} />
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Skill tooltip content
 */
function SkillTooltip({ skill }: { skill: Skill }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <img
          src={skill.icon}
          alt={skill.name}
          className="w-10 h-10 rounded border"
        />
        <div className="flex-1">
          <div className="font-semibold">{skill.name}</div>
          <div className="text-xs text-muted-foreground">
            {skill.type} • {skill.slot}
          </div>
        </div>
      </div>
      <p className="text-sm text-foreground">{skill.description}</p>
      {skill.facts && skill.facts.length > 0 && (
        <div className="pt-2 border-t space-y-1">
          {skill.facts.slice(0, 5).map((fact, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {fact.icon && (
                <img src={fact.icon} alt="" className="w-4 h-4" />
              )}
              <span className="text-muted-foreground">{fact.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Skill selector dialog with search and filtering
 */
function SkillSelectorDialog({
  open,
  onClose,
  skills,
  profession,
  slotType,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  skills: Skill[]
  profession: ProfessionId
  slotType: SkillSlotType
  onSelect: (skillId: number) => void
}) {
  const [search, setSearch] = useState('')

  // Map slot type to skill slot filter
  const slotFilter: SkillSlot | undefined =
    slotType === 'heal' ? 'Heal' :
    slotType === 'elite' ? 'Elite' :
    'Utility'

  // Filter skills
  const filteredSkills = skills.filter((skill) => {
    // Must be for this profession
    if (!skill.professions?.includes(profession)) return false

    // Must match slot type
    if (skill.slot !== slotFilter) return false

    // Search filter
    if (search && !skill.name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }

    return true
  })

  // Group by category if available
  const categorizedSkills: Record<string, Skill[]> = {}
  filteredSkills.forEach((skill) => {
    const category = skill.categories?.[0] || 'General'
    if (!categorizedSkills[category]) {
      categorizedSkills[category] = []
    }
    categorizedSkills[category].push(skill)
  })

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Select {slotType === 'heal' ? 'Heal' : slotType === 'elite' ? 'Elite' : 'Utility'} Skill
          </DialogTitle>
          <DialogDescription>
            Choose a skill for {profession}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Skill grid */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(categorizedSkills).map(([category, categorySkills]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                {category}
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {categorySkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => onSelect(skill.id)}
                    className="group relative aspect-square rounded-lg border-2 border-border hover:border-primary hover:scale-105 transition-all overflow-hidden"
                  >
                    <img
                      src={skill.icon}
                      alt={skill.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <div className="text-[10px] text-white font-medium line-clamp-1 text-center">
                        {skill.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredSkills.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No skills found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
