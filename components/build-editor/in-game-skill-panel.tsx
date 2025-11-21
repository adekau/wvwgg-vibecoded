'use client'

import { useState } from 'react'
import type {
  Skill,
  Trait,
  SkillSelection,
  SpecializationSelection,
  Specialization,
  ProfessionId,
  SkillSlot,
  Profession,
  WeaponPiece,
} from '@/lib/gw2/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { Search, X, Repeat } from 'lucide-react'

interface InGameSkillPanelProps {
  skills: Skill[]
  traits: Trait[]
  profession: ProfessionId
  professionData?: Profession
  skillSelection: SkillSelection
  specializations: Specialization[]
  selectedLines: SpecializationSelection[]
  weaponSet1Main?: WeaponPiece
  weaponSet1Off?: WeaponPiece
  weaponSet2Main?: WeaponPiece
  weaponSet2Off?: WeaponPiece
  onUpdateSkills: (selection: SkillSelection) => void
  onUpdateTraitLines: (lines: SpecializationSelection[]) => void
}

type SkillSlotType = 'heal' | 'utility1' | 'utility2' | 'utility3' | 'elite'

/**
 * In-game styled skills and traits panel
 */
export function InGameSkillPanel({
  skills,
  traits,
  profession,
  professionData,
  skillSelection,
  specializations,
  selectedLines,
  weaponSet1Main,
  weaponSet1Off,
  weaponSet2Main,
  weaponSet2Off,
  onUpdateSkills,
  onUpdateTraitLines,
}: InGameSkillPanelProps) {
  const [selectingSkill, setSelectingSkill] = useState<SkillSlotType | null>(null)
  const [selectingLine, setSelectingLine] = useState<number | null>(null)
  const [activeWeaponSet, setActiveWeaponSet] = useState<1 | 2>(1)

  const handleSelectSkill = (slot: SkillSlotType, skillId: number) => {
    onUpdateSkills({
      ...skillSelection,
      [slot]: skillId,
    })
    setSelectingSkill(null)
  }

  const handleSelectSpecialization = (specId: number) => {
    if (selectingLine === null) return
    const newLines = [...selectedLines]
    newLines[selectingLine] = {
      id: specId,
      traits: [0, 0, 0],
    }
    onUpdateTraitLines(newLines)
    setSelectingLine(null)
  }

  const handleSelectTrait = (lineIndex: number, tierIndex: number, traitId: number) => {
    const newLines = [...selectedLines]
    const line = newLines[lineIndex]
    if (line) {
      const newTraits = [...line.traits] as [number, number, number]
      newTraits[tierIndex] = traitId
      line.traits = newTraits
      onUpdateTraitLines(newLines)
    }
  }

  const handleRemoveLine = (lineIndex: number) => {
    const newLines = selectedLines.filter((_, i) => i !== lineIndex)
    onUpdateTraitLines(newLines)
  }

  const getSkillById = (id: number) => skills.find((s) => s.id === id)

  // Get weapon skills for the active weapon set
  const getWeaponSkills = (): Skill[] => {
    if (!professionData) return []

    const activeMain = activeWeaponSet === 1 ? weaponSet1Main : weaponSet2Main
    const activeOff = activeWeaponSet === 1 ? weaponSet1Off : weaponSet2Off

    if (!activeMain) return []

    const mainWeaponType = activeMain.weaponType
    const offWeaponType = activeOff?.weaponType

    // Get weapon skills from profession data
    const mainWeapon = professionData.weapons[mainWeaponType]
    if (!mainWeapon) return []

    const weaponSkillIds: number[] = []

    // Add main hand skills (usually slots 1-3 for one-handed, 1-5 for two-handed)
    for (const weaponSkill of mainWeapon.skills) {
      // If offhand specified, only include skills that match
      if (weaponSkill.offhand && offWeaponType) {
        if (weaponSkill.offhand === offWeaponType) {
          weaponSkillIds.push(weaponSkill.id)
        }
      } else if (!weaponSkill.offhand) {
        weaponSkillIds.push(weaponSkill.id)
      }
    }

    // Add offhand skills (usually slots 4-5)
    if (offWeaponType && professionData.weapons[offWeaponType]) {
      const offWeapon = professionData.weapons[offWeaponType]
      for (const weaponSkill of offWeapon.skills) {
        weaponSkillIds.push(weaponSkill.id)
      }
    }

    // Get the actual skill objects
    return weaponSkillIds.map(id => getSkillById(id)).filter((s): s is Skill => s !== undefined)
  }

  const weaponSkills = getWeaponSkills()

  // Check if weapon set 2 is equipped
  const hasWeaponSet2 = !!(weaponSet2Main)

  return (
    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-lg p-4 space-y-6">
      {/* Skills Bar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-white/80">Skills</div>
          {hasWeaponSet2 && (
            <Button
              onClick={() => setActiveWeaponSet(activeWeaponSet === 1 ? 2 : 1)}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10"
            >
              <Repeat className="w-3 h-3 mr-1" />
              Swap Weapons
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {/* Weapon Skills (1-5) */}
          <div className="flex gap-1 flex-1">
            {[0, 1, 2, 3, 4].map((index) => {
              const skill = weaponSkills[index]
              return (
                <WeaponSkillSlot
                  key={index}
                  skill={skill}
                  slotNumber={index + 1}
                />
              )
            })}
          </div>

          {/* Utility Skills (Heal + 3 Utility + Elite) */}
          <div className="flex gap-2">
            <SkillSlot
              skill={getSkillById(skillSelection.heal)}
              onClick={() => setSelectingSkill('heal')}
            />
            <SkillSlot
              skill={getSkillById(skillSelection.utility1)}
              onClick={() => setSelectingSkill('utility1')}
            />
            <SkillSlot
              skill={getSkillById(skillSelection.utility2)}
              onClick={() => setSelectingSkill('utility2')}
            />
            <SkillSlot
              skill={getSkillById(skillSelection.utility3)}
              onClick={() => setSelectingSkill('utility3')}
            />
            <SkillSlot
              skill={getSkillById(skillSelection.elite)}
              onClick={() => setSelectingSkill('elite')}
            />
          </div>
        </div>
        <div className="text-xs text-white/40 mt-2">
          Weapon skills (1-5) are determined by equipped weapons
          {hasWeaponSet2 && ` • Active: Weapon Set ${activeWeaponSet}`}
        </div>
      </div>

      {/* Trait Lines */}
      <div>
        <div className="text-sm font-semibold text-white/80 mb-3">Specializations</div>
        <div className="space-y-3">
          {selectedLines.map((line, lineIndex) => {
            const spec = specializations.find((s) => s.id === line.id)
            if (!spec) return null

            return (
              <TraitLineDisplay
                key={lineIndex}
                specialization={spec}
                selection={line}
                allTraits={traits}
                onSelectTrait={(tierIndex, traitId) =>
                  handleSelectTrait(lineIndex, tierIndex, traitId)
                }
                onRemove={() => handleRemoveLine(lineIndex)}
              />
            )
          })}

          {/* Add Specialization */}
          {selectedLines.length < 3 && (
            <>
              {selectingLine === null ? (
                <Button
                  onClick={() => setSelectingLine(selectedLines.length)}
                  variant="outline"
                  className="w-full bg-black/30 border-white/20 hover:bg-black/50"
                >
                  + Add Specialization
                </Button>
              ) : (
                <div className="bg-black/50 border border-white/20 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-white">Select Specialization</span>
                    <Button
                      onClick={() => setSelectingLine(null)}
                      variant="ghost"
                      size="sm"
                      className="text-white/50 hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {specializations
                      .filter((spec) => !spec.elite && !selectedLines.some((l) => l.id === spec.id))
                      .map((spec) => (
                        <button
                          key={spec.id}
                          onClick={() => handleSelectSpecialization(spec.id)}
                          className="w-12 h-12 bg-black/40 border border-white/10 rounded hover:border-amber-500/50 transition-all overflow-hidden group flex items-center justify-center"
                        >
                          <div
                            className="w-full h-full bg-cover bg-center flex items-center justify-center"
                            style={{ backgroundImage: `url(${spec.background})` }}
                          >
                            {spec.icon && (
                              <img
                                src={spec.icon}
                                alt={spec.name}
                                className="max-w-full max-h-full object-contain drop-shadow-lg"
                              />
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Skill Selector Dialog */}
      {selectingSkill && (
        <InGameSkillSelector
          open={selectingSkill !== null}
          onClose={() => setSelectingSkill(null)}
          skills={skills}
          profession={profession}
          slotType={selectingSkill}
          onSelect={(skillId) => handleSelectSkill(selectingSkill, skillId)}
        />
      )}
    </div>
  )
}

/**
 * Weapon skill slot (non-clickable, determined by equipped weapons)
 */
function WeaponSkillSlot({
  skill,
  slotNumber,
}: {
  skill?: Skill
  slotNumber: number
}) {
  if (!skill) {
    return (
      <div className="flex-1 aspect-square bg-black/50 border border-white/10 rounded flex items-center justify-center">
        <span className="text-white/30 text-xs">{slotNumber}</span>
      </div>
    )
  }

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <div className="flex-1 aspect-square bg-black/50 border-2 border-amber-500/30 rounded overflow-hidden flex items-center justify-center relative">
          <img
            src={skill.icon}
            alt={skill.name}
            className="max-w-full max-h-full object-contain"
          />
          <span className="absolute bottom-0 right-0 text-[8px] text-white/60 bg-black/70 px-1 rounded-tl">
            {slotNumber}
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 bg-slate-900 border-white/20">
        <SkillTooltip skill={skill} />
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Skill slot button
 */
function SkillSlot({
  skill,
  onClick,
}: {
  skill?: Skill
  onClick: () => void
}) {
  if (!skill) {
    return (
      <button
        onClick={onClick}
        className="w-10 h-10 bg-black/50 border-2 border-dashed border-white/20 rounded hover:border-amber-500/50 transition-all flex items-center justify-center"
      >
        <span className="text-white/30 text-xl">+</span>
      </button>
    )
  }

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button
          onClick={onClick}
          className="w-10 h-10 bg-black/50 border-2 border-amber-500/30 rounded hover:border-amber-500 hover:scale-105 transition-all overflow-hidden flex items-center justify-center"
        >
          <img
            src={skill.icon}
            alt={skill.name}
            className="max-w-full max-h-full object-contain"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 bg-slate-900 border-white/20">
        <SkillTooltip skill={skill} />
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Skill tooltip
 */
function SkillTooltip({ skill }: { skill: Skill }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <img src={skill.icon} alt={skill.name} className="w-10 h-10 rounded" />
        <div className="flex-1">
          <div className="font-semibold text-white">{skill.name}</div>
          <div className="text-xs text-white/50">{skill.slot}</div>
        </div>
      </div>
      <p className="text-sm text-white/80">{skill.description}</p>
    </div>
  )
}

/**
 * Trait line display
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
  const specTraits = allTraits.filter((t) => t.specialization === specialization.id)

  // Group traits by tier and slot type
  const traitsByTier = {
    adept: {
      major: specTraits.filter((t) => t.tier === 1 && t.slot === 'Major'),
      minor: specTraits.filter((t) => t.tier === 1 && t.slot === 'Minor'),
    },
    master: {
      major: specTraits.filter((t) => t.tier === 2 && t.slot === 'Major'),
      minor: specTraits.filter((t) => t.tier === 2 && t.slot === 'Minor'),
    },
    grandmaster: {
      major: specTraits.filter((t) => t.tier === 3 && t.slot === 'Major'),
      minor: specTraits.filter((t) => t.tier === 3 && t.slot === 'Minor'),
    },
  }

  return (
    <div className="bg-black/50 border border-white/10 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-10 h-10 rounded bg-cover bg-center flex items-center justify-center"
          style={{ backgroundImage: `url(${specialization.background})` }}
        >
          {specialization.icon && (
            <img src={specialization.icon} alt={specialization.name} className="max-w-full max-h-full object-contain" />
          )}
        </div>
        <div className="flex-1 text-sm font-medium text-white">{specialization.name}</div>
        <Button
          onClick={onRemove}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-white/50 hover:text-red-400"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Trait Tiers - Vertical Layout with centered minor traits */}
      <div className="flex gap-1 items-center">
        {/* Adept Tier */}
        <TraitTierVerticalMajorOnly
          label="Adept"
          traits={traitsByTier.adept.major}
          selectedId={selection.traits[0]}
          onSelect={(id) => onSelectTrait(0, id)}
        />

        {/* Adept Minor Trait (centered) */}
        {traitsByTier.adept.minor[0] && (
          <div className="flex items-center justify-center px-1">
            <TraitButton trait={traitsByTier.adept.minor[0]} isSelected={false} onSelect={() => {}} isMinor />
          </div>
        )}

        {/* Master Tier */}
        <TraitTierVerticalMajorOnly
          label="Master"
          traits={traitsByTier.master.major}
          selectedId={selection.traits[1]}
          onSelect={(id) => onSelectTrait(1, id)}
        />

        {/* Master Minor Trait (centered) */}
        {traitsByTier.master.minor[0] && (
          <div className="flex items-center justify-center px-1">
            <TraitButton trait={traitsByTier.master.minor[0]} isSelected={false} onSelect={() => {}} isMinor />
          </div>
        )}

        {/* Grandmaster Tier */}
        <TraitTierVerticalMajorOnly
          label="Grandmaster"
          traits={traitsByTier.grandmaster.major}
          selectedId={selection.traits[2]}
          onSelect={(id) => onSelectTrait(2, id)}
        />

        {/* Grandmaster Minor Trait (centered) */}
        {traitsByTier.grandmaster.minor[0] && (
          <div className="flex items-center justify-center px-1">
            <TraitButton trait={traitsByTier.grandmaster.minor[0]} isSelected={false} onSelect={() => {}} isMinor />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Vertical trait tier with only major traits (no minor)
 */
function TraitTierVerticalMajorOnly({
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
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      {/* Tier label */}
      <div className="text-[9px] text-white/50 font-medium mb-1">{label}</div>

      {/* Major traits stacked vertically */}
      <div className="flex flex-col gap-1">
        {traits.map((trait) => (
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
  isMinor = false,
}: {
  trait: Trait
  isSelected: boolean
  onSelect: () => void
  isMinor?: boolean
}) {
  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <button
          onClick={onSelect}
          disabled={isMinor}
          className={cn(
            'w-10 h-10 rounded border-2 transition-all flex items-center justify-center',
            isMinor
              ? 'border-white/20 bg-black/60 cursor-default opacity-70'
              : isSelected
              ? 'border-amber-500 bg-amber-500/10 scale-105'
              : 'border-white/10 hover:border-white/30 bg-black/40 hover:scale-105'
          )}
        >
          {trait.icon && (
            <img src={trait.icon} alt={trait.name} className="max-w-full max-h-full object-contain" />
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 bg-slate-900 border-white/20">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            {trait.icon && <img src={trait.icon} alt={trait.name} className="w-8 h-8 rounded" />}
            <div>
              <div className="text-sm font-semibold text-white">{trait.name}</div>
              <div className="text-xs text-white/50">
                {trait.tier === 1 ? 'Adept' : trait.tier === 2 ? 'Master' : 'Grandmaster'}{' '}
                {trait.slot === 'Minor' && '(Minor)'}
              </div>
            </div>
          </div>
          <p className="text-xs text-white/70">{trait.description}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * In-game skill selector dialog
 */
function InGameSkillSelector({
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

  const slotFilter: SkillSlot | undefined =
    slotType === 'heal' ? 'Heal' :
    slotType === 'elite' ? 'Elite' :
    'Utility'

  const filteredSkills = skills.filter((skill) => {
    if (!skill.professions?.includes(profession)) return false
    if (skill.slot !== slotFilter) return false
    if (search && !skill.name.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    return true
  })

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
      <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-900 border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">
            Select {slotType === 'heal' ? 'Heal' : slotType === 'elite' ? 'Elite' : 'Utility'} Skill
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-black/40 border-white/20 text-white"
          />
        </div>

        {/* Skill Grid */}
        <div className="flex-1 overflow-y-auto max-h-[500px]">
          {Object.entries(categorizedSkills).map(([category, categorySkills]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-white/70">{category}</h3>
              <div className="grid grid-cols-8 gap-2">
                {categorySkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => onSelect(skill.id)}
                    className="group relative aspect-square rounded border-2 border-white/10 hover:border-amber-500/50 transition-all overflow-hidden"
                  >
                    <img
                      src={skill.icon}
                      alt={skill.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                      <div className="text-[9px] text-white font-medium line-clamp-1 text-center">
                        {skill.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredSkills.length === 0 && (
            <div className="text-center py-12 text-white/40">No skills found</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
