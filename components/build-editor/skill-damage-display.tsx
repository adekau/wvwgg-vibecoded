'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { calculateSkillDamage, calculateAverageSkillDamage } from '@/lib/gw2/build-calculator'
import { Sword, Plus, X } from 'lucide-react'

interface SkillDamageDisplayProps {
  weaponType: string
  power: number
  critChance: number
  critDamage: number
}

interface CustomSkill {
  id: string
  name: string
  coefficient: number
}

/**
 * SkillDamageDisplay - Shows damage calculations for skills
 * Allows adding custom skill coefficients to see calculated damage
 */
export function SkillDamageDisplay({
  weaponType,
  power,
  critChance,
  critDamage,
}: SkillDamageDisplayProps) {
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>([
    { id: '1', name: 'Auto Attack', coefficient: 0.5 },
    { id: '2', name: 'Skill 2', coefficient: 1.0 },
    { id: '3', name: 'Skill 3', coefficient: 1.5 },
  ])
  const [isAddingSkill, setIsAddingSkill] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCoeff, setNewSkillCoeff] = useState('1.0')

  const handleAddSkill = () => {
    if (newSkillName && !isNaN(parseFloat(newSkillCoeff))) {
      setCustomSkills([
        ...customSkills,
        {
          id: Date.now().toString(),
          name: newSkillName,
          coefficient: parseFloat(newSkillCoeff),
        },
      ])
      setNewSkillName('')
      setNewSkillCoeff('1.0')
      setIsAddingSkill(false)
    }
  }

  const handleRemoveSkill = (id: string) => {
    setCustomSkills(customSkills.filter((s) => s.id !== id))
  }

  const handleUpdateSkill = (id: string, field: 'name' | 'coefficient', value: string) => {
    setCustomSkills(
      customSkills.map((s) => {
        if (s.id === id) {
          if (field === 'name') {
            return { ...s, name: value }
          } else {
            const coeff = parseFloat(value)
            return { ...s, coefficient: isNaN(coeff) ? 0 : coeff }
          }
        }
        return s
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sword className="w-4 h-4" />
          Skill Damage Calculator
        </CardTitle>
        <CardDescription>
          Damage calculations based on {weaponType} with current stats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current stats summary */}
        <div className="grid grid-cols-3 gap-2 text-xs bg-muted/50 p-2 rounded">
          <div>
            <div className="text-muted-foreground">Power</div>
            <div className="font-mono font-semibold">{power}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Crit Chance</div>
            <div className="font-mono font-semibold">{critChance.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Crit Damage</div>
            <div className="font-mono font-semibold">{(critDamage * 100).toFixed(0)}%</div>
          </div>
        </div>

        <Separator />

        {/* Skill damage calculations */}
        <div className="space-y-2">
          {customSkills.map((skill) => {
            const damage = calculateSkillDamage(weaponType, power, skill.coefficient, critDamage)
            const avgDamage = calculateAverageSkillDamage(
              weaponType,
              power,
              skill.coefficient,
              critChance,
              critDamage
            )

            return (
              <div
                key={skill.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    value={skill.name}
                    onChange={(e) => handleUpdateSkill(skill.id, 'name', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Skill name"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Coeff:</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={skill.coefficient}
                      onChange={(e) => handleUpdateSkill(skill.id, 'coefficient', e.target.value)}
                      className="h-7 text-xs font-mono flex-1"
                    />
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[10px] text-muted-foreground">
                    Avg: <span className="font-mono font-semibold text-primary">{avgDamage.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {damage.normal.toLocaleString()} / {damage.critical.toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSkill(skill.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )
          })}
        </div>

        {/* Add new skill */}
        {isAddingSkill ? (
          <div className="space-y-2 p-2 border-2 border-dashed rounded-lg">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Skill Name</Label>
                <Input
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g., Hundred Blades"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Coefficient</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newSkillCoeff}
                  onChange={(e) => setNewSkillCoeff(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddSkill} size="sm" className="flex-1 h-7 text-xs">
                Add
              </Button>
              <Button
                onClick={() => setIsAddingSkill(false)}
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setIsAddingSkill(true)}
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Skill
          </Button>
        )}

        {/* Formula reference */}
        <div className="mt-4 p-2 bg-muted/50 rounded text-[10px] font-mono space-y-1">
          <div className="text-muted-foreground font-semibold mb-1">Formula:</div>
          <div>Damage = (Weapon × Power × Coeff) / 2597</div>
          <div>Avg = Normal × (1 - CC%) + Crit × CC%</div>
        </div>
      </CardContent>
    </Card>
  )
}
