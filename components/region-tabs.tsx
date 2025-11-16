"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const regions = [
  { id: 'all', label: 'All Regions' },
  { id: 'na', label: 'NA' },
  { id: 'eu', label: 'EU' },
]

export function RegionTabs() {
  const [activeRegion, setActiveRegion] = useState('all')
  
  return (
    <div className="bg-card panel-border rounded-lg p-1 inline-flex gap-1 inset-card">
      {regions.map((region) => (
        <Button
          key={region.id}
          variant={activeRegion === region.id ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveRegion(region.id)}
          className="rounded-md transition-all"
        >
          {region.label}
        </Button>
      ))}
    </div>
  )
}
