# GW2 Build Editor - Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive Guild Wars 2 build editor with gear optimization and advanced stat calculations, similar to gw2skills.net but integrated into the wvwgg platform.

---

## Core Features

### 1. Build Editor
- **Profession & Specialization Selection** - All 9 professions with elite specializations
- **Trait System** - 5 trait lines, select 3, with major/minor traits
- **Skill System** - Weapon skills, heal, utilities, elite skills
- - **Gear Editor** - 14 equipment slots with stat selectors
- **Rune & Sigil Selection** - All available upgrades
- **Infusion Support** - Stat and AR infusions

### 2. Gear Optimizer
- **Goal-based Optimization** - Maximize effective power, survivability, or custom metrics
- **Constraint System** - Min/max values for specific stats
- **Multiple Strategies** - Berserker/Marauder optimization, balanced builds
- **Budget Optimizer** - Optimize within gear tier constraints (exotic vs ascended)

### 3. Advanced Calculations
- **Effective Power (EP)** - `Power × (1 + Crit Chance × Crit Damage)`
- **Effective Health (EH)** - `Health × Armor / 1000` (WvW-specific with toughness)
- **Breakpoint Analysis** - Crit chance, boon duration, condition duration
- **DPS Estimates** - Weapon-based damage calculations
- **Sustain Metrics** - Healing power effectiveness, barrier generation

---

## Technical Architecture

### Data Layer

#### New Database Tables (DynamoDB)

**1. Builds Table**
```typescript
interface Build {
  id: string                    // Partition key: build-{uuid}
  userId?: string               // Sort key (optional for anonymous builds)
  createdAt: number
  updatedAt: number
  name: string
  description?: string
  profession: ProfessionId
  specialization?: SpecializationId
  traitLines: TraitLineSelection[]
  skills: SkillSelection
  gear: GearSelection
  isPublic: boolean
  tags: string[]                // ['wvw', 'pve', 'roaming', 'zerg']
  viewCount: number
  likeCount: number
}

interface TraitLineSelection {
  lineId: number
  selections: [number, number, number]  // Trait choices per tier
}

interface SkillSelection {
  heal: number
  utility1: number
  utility2: number
  utility3: number
  elite: number
  weaponSet1: { mainHand: number, offHand?: number }
  weaponSet2?: { mainHand: number, offHand?: number }
  aquatic?: { mainHand: number, offHand?: number }
}

interface GearSelection {
  helm: GearPiece
  shoulders: GearPiece
  coat: GearPiece
  gloves: GearPiece
  leggings: GearPiece
  boots: GearPiece
  amulet: GearPiece
  ring1: GearPiece
  ring2: GearPiece
  accessory1: GearPiece
  accessory2: GearPiece
  backItem: GearPiece
  weaponSet1Main: GearPiece
  weaponSet1Off?: GearPiece
  weaponSet2Main?: GearPiece
  weaponSet2Off?: GearPiece
}

interface GearPiece {
  itemId?: number               // For specific items
  statId: number                // Stat combination (Berserker, etc.)
  rarity: 'exotic' | 'ascended' | 'legendary'
  upgradeId?: number            // Rune or sigil
  infusions: number[]           // Infusion IDs
}
```

**2. Game Data Cache Table**
```typescript
interface GameDataCache {
  id: string                    // Partition key: 'profession-{id}' | 'skill-{id}' | 'trait-{id}' | 'item-{id}'
  type: 'profession' | 'skill' | 'trait' | 'item' | 'specialization'
  data: any                     // Raw GW2 API data
  lastUpdated: number
  ttl: number                   // DynamoDB TTL for auto-refresh
}
```

#### GW2 API Integration

**New API Routes:**
- `GET /api/gw2/professions` - All professions with specializations
- `GET /api/gw2/professions/[id]` - Profession details
- `GET /api/gw2/skills` - All skills (cached)
- `GET /api/gw2/skills/[id]` - Skill details
- `GET /api/gw2/traits` - All traits (cached)
- `GET /api/gw2/traits/[id]` - Trait details
- `GET /api/gw2/items/stats` - All stat combinations
- `GET /api/gw2/items/[id]` - Item details (runes, sigils, gear)

**Caching Strategy:**
- Cache all static game data in DynamoDB with 7-day TTL
- On-demand refresh via Lambda (similar to match data fetcher)
- Client-side caching with React Query (staleTime: 24 hours)

### Calculation Engine

**Location:** `lib/build-calculator.ts` (new)

```typescript
interface CalculatedStats {
  // Base Stats
  power: number
  precision: number
  toughness: number
  vitality: number
  ferocity: number
  conditionDamage: number
  expertise: number
  concentration: number
  healingPower: number
  agonyResistance: number

  // Derived Stats
  critChance: number              // (Precision - 895) / 21
  critDamage: number              // 1.5 + Ferocity / 1500
  health: number                  // Base + (Vitality * 10)
  armor: number                   // Base + Toughness

  // Advanced Metrics
  effectivePower: number          // Power × (1 + CritChance × (CritDamage - 1))
  effectiveHealth: number         // Health × (Armor / 1000)
  effectiveHealthPower: number    // EP × EH (overall tankiness)

  // Boon Stats
  boonDuration: number            // Concentration / 1500
  conditionDuration: number       // Expertise / 1500

  // DPS Estimates
  weaponDPS: number               // Skill coefficients × EP
  conditionDPS: number            // Condition damage × duration

  // Sustain
  healingPerSecond: number        // Based on healing power + skills
  barrierGeneration: number       // Based on healing power + traits
}

class BuildCalculator {
  calculateStats(build: Build): CalculatedStats
  calculateEffectivePower(stats: BaseStats): number
  calculateEffectiveHealth(stats: BaseStats): number
  calculateCritChance(precision: number): number
  calculateCritDamage(ferocity: number): number
  calculateWeaponDPS(weaponSkills: Skill[], stats: CalculatedStats): number

  // Breakpoint analysis
  getNextCritBreakpoint(currentPrecision: number): { precision: number, critChance: number }
  getBoonDurationBreakpoints(currentConcentration: number, target: number): number
}
```

**Advanced Calculations:**

1. **Effective Power (EP)**
   ```typescript
   EP = Power × (1 + CritChance × (CritDamage - 1))
   ```
   - Accounts for critical hit damage
   - Used for comparing different gear setups
   - Key metric for DPS builds

2. **Effective Health (EH)**
   ```typescript
   EH = Health × (Armor / 1000)
   ```
   - WvW-specific calculation (armor matters)
   - Combines vitality and toughness
   - Used for tankiness optimization

3. **Effective Health Power (EHP)**
   ```typescript
   EHP = EP × EH
   ```
   - Combined metric for bruiser builds
   - Balances damage and survivability
   - Useful for WvW roaming builds

4. **DPS Estimation**
   ```typescript
   Weapon DPS = Σ(Skill Coefficient × EP × Skill Frequency)
   ```
   - Uses skill damage coefficients from API
   - Accounts for weapon skill rotation
   - Includes trait modifiers

### Optimization Engine

**Location:** `lib/gear-optimizer.ts` (new)

Leverage existing MILP optimizer patterns from `lib/wvw-optimizer.ts`:

```typescript
interface OptimizationGoal {
  type: 'maximize-ep' | 'maximize-eh' | 'maximize-ehp' | 'custom'
  customFormula?: string         // e.g., "EP * 0.7 + EH * 0.3"
  constraints: OptimizationConstraint[]
}

interface OptimizationConstraint {
  stat: StatType
  min?: number
  max?: number
  target?: number                // Exact value (for breakpoints)
}

interface OptimizationOptions {
  allowedRarities: ('exotic' | 'ascended' | 'legendary')[]
  allowedStatCombos?: number[]   // Restrict to specific stat sets
  useInfusions: boolean
  includeFood: boolean
  includeUtilities: boolean
}

class GearOptimizer {
  async optimize(
    build: Build,
    goal: OptimizationGoal,
    options: OptimizationOptions
  ): Promise<OptimizedGear>

  // Use MILP (glpk.js) for exact solutions
  // Or heuristic search for faster results
}
```

**Optimization Strategies:**

1. **Pure DPS (Max EP)**
   - Maximize Effective Power
   - Constraint: Min health for survivability

2. **Balanced Bruiser (Max EHP)**
   - Maximize EP × EH
   - Common for WvW roaming

3. **Tank (Max EH)**
   - Maximize Effective Health
   - Still maintain minimum damage output

4. **Breakpoint Optimization**
   - Hit exact boon duration targets (e.g., 100% quickness uptime)
   - Then maximize remaining stats for EP

5. **Budget Optimization**
   - Exotic-only gear
   - Minimize gold cost while hitting stat targets

---

## UI Component Architecture

### Page Structure

**Route:** `/builds` (new section)

```
/builds
  /new              → Build editor
  /[buildId]        → View/edit specific build
  /my-builds        → User's saved builds (auth required)
  /browse           → Public build browser
  /optimize         → Gear optimizer tool
```

### Component Breakdown

#### 1. Build Editor Page (`app/builds/new/page.tsx`)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Header: [Save] [Share] [Optimize Gear]        │
├─────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌──────────────────────────┐  │
│ │  Profession │ │   Calculated Stats       │  │
│ │  Selector   │ │   • Power: 3500          │  │
│ │             │ │   • Precision: 2500      │  │
│ │  [ Elite ]  │ │   • Crit Chance: 76.4%   │  │
│ └─────────────┘ │   • Effective Power: 5.2K│  │
│                 │   • Effective Health: 23K│  │
│ ┌─────────────┐ └──────────────────────────┘  │
│ │ Trait Lines │                               │
│ │  [Line 1  ]│                               │
│ │  [Line 2  ]│                               │
│ │  [Line 3  ]│                               │
│ └─────────────┘                               │
│                                               │
│ ┌──────────────────────────────────────────┐  │
│ │ Skills                                   │  │
│ │  [Heal] [Util1] [Util2] [Util3] [Elite] │  │
│ │                                          │  │
│ │  Weapon Set 1: [Main] [Off]             │  │
│ │  Weapon Set 2: [Main] [Off]             │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ ┌──────────────────────────────────────────┐  │
│ │ Equipment                                │  │
│ │  [Helm] [Shoulders] [Coat]   ...        │  │
│ │  [Amulet] [Ring] [Ring]      ...        │  │
│ │  [Weapon 1] [Weapon 2]                  │  │
│ └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Components to Build:**

1. **`<ProfessionSelector />`** (`components/build-editor/profession-selector.tsx`)
   - Grid of profession icons
   - Elite specialization dropdown
   - Visual profession display

2. **`<TraitLineSelector />`** (`components/build-editor/trait-line-selector.tsx`)
   - 5 available lines → select 3
   - Interactive trait picker per line
   - 3 tiers with 3 options each
   - Tooltip with trait descriptions

3. **`<SkillBar />`** (`components/build-editor/skill-bar.tsx`)
   - Visual skill icons
   - Skill selector dialog
   - Filter by profession/weapon
   - Tooltips with skill data

4. **`<GearPanel />`** (`components/build-editor/gear-panel.tsx`)
   - 14 equipment slots
   - Stat combination selector
   - Rune/sigil selector
   - Infusion slots
   - Visual gear display

5. **`<StatsSummary />`** (`components/build-editor/stats-summary.tsx`)
   - Real-time stat calculation
   - Base stats
   - Derived stats (crit chance, etc.)
   - **Effective Power** (highlighted)
   - **Effective Health** (highlighted)
   - DPS estimates
   - Breakpoint warnings (e.g., "5 precision to next 1% crit")

6. **`<GearOptimizer />`** (`components/build-editor/gear-optimizer.tsx`)
   - **Modal dialog** from gear panel
   - Goal selection (max EP, max EH, max EHP, custom)
   - Constraint inputs (min health, max toughness, etc.)
   - Rarity selector (exotic vs ascended)
   - "Optimize" button
   - Results display with before/after comparison
   - "Apply to Build" button

7. **`<BuildShare />`** (`components/build-editor/build-share.tsx`)
   - Generate shareable URL
   - QR code for mobile
   - Copy to clipboard
   - Save to account (if logged in)
   - Export to template chat code (GW2 format)

#### 2. Build Browser (`app/builds/browse/page.tsx`)

- Card grid of public builds
- Filter by profession, tags, author
- Sort by newest, most liked, most viewed
- Search by name/description
- "Fork Build" to edit

#### 3. Optimizer Standalone (`app/builds/optimize/page.tsx`)

- Gear optimizer without full build editor
- Quick tool for optimizing existing builds
- Import from template code
- Export optimized result

---

## Implementation Phases

### Phase 1: Data Foundation (Week 1)
**Goal:** Set up GW2 API integration and caching

**Tasks:**
- [ ] Create DynamoDB schemas for builds and game data cache
- [ ] Build GW2 API wrapper service (`lib/gw2-api.ts`)
- [ ] Create API routes for professions, skills, traits, items
- [ ] Set up Lambda function for periodic game data sync
- [ ] Create TypeScript interfaces for all game data types
- [ ] Build caching layer with React Query

**Deliverables:**
- Functional API endpoints returning cached GW2 data
- Type-safe interfaces for builds, skills, traits, gear
- Database tables ready for build storage

---

### Phase 2: Calculation Engine (Week 2)
**Goal:** Build stat calculation and formula system

**Tasks:**
- [ ] Implement `BuildCalculator` class (`lib/build-calculator.ts`)
- [ ] Write stat aggregation logic (gear → base stats)
- [ ] Implement derived stat formulas (crit chance, crit damage)
- [ ] Build Effective Power calculator
- [ ] Build Effective Health calculator
- [ ] Create DPS estimation system using skill coefficients
- [ ] Add breakpoint analysis utilities
- [ ] Write comprehensive unit tests (Vitest)

**Deliverables:**
- Working calculation engine
- Unit tests with 90%+ coverage
- Performance: <10ms for full build calculation

---

### Phase 3: Basic UI Components (Week 3)
**Goal:** Build core editor UI without optimization

**Tasks:**
- [ ] Create `<ProfessionSelector />` component
- [ ] Build `<TraitLineSelector />` with interactive picker
- [ ] Implement `<SkillBar />` with skill selection
- [ ] Create `<GearPanel />` with stat/rune/sigil selectors
- [ ] Build `<StatsSummary />` with real-time updates
- [ ] Add tooltips for all skills/traits/items
- [ ] Implement build serialization (URL encoding)
- [ ] Create build save/load functionality

**Deliverables:**
- Functional build editor at `/builds/new`
- Real-time stat calculation display
- Build sharing via URL
- Responsive mobile design

---

### Phase 4: Gear Optimizer (Week 4)
**Goal:** Implement optimization algorithms

**Tasks:**
- [ ] Create `GearOptimizer` class (`lib/gear-optimizer.ts`)
- [ ] Integrate MILP solver (glpk.js) for exact optimization
- [ ] Implement heuristic search for fast approximations
- [ ] Build constraint validation system
- [ ] Create optimization goal presets (max EP, EH, EHP)
- [ ] Add custom formula parser for advanced users
- [ ] Implement budget optimizer (exotic-only, cost constraints)
- [ ] Build `<GearOptimizer />` UI component
- [ ] Add before/after comparison view

**Deliverables:**
- Working gear optimizer (modal in build editor)
- Optimization completes in <5 seconds
- Multiple optimization strategies
- Visual before/after stat comparison

---

### Phase 5: Build Management (Week 5)
**Goal:** Build storage, browsing, and sharing

**Tasks:**
- [ ] Implement build CRUD operations (create, read, update, delete)
- [ ] Build "My Builds" page with grid/list view
- [ ] Create build browser with filters and search
- [ ] Add build tagging system (wvw, pve, roaming, zerg)
- [ ] Implement like/favorite system
- [ ] Build template code import/export (GW2 chat code format)
- [ ] Add build forking (clone and edit)
- [ ] Create build comparison tool (side-by-side)

**Deliverables:**
- `/builds/my-builds` page for authenticated users
- `/builds/browse` public build browser
- Build import from GW2 template codes
- Social features (likes, views, tags)

---

### Phase 6: Polish & Advanced Features (Week 6)
**Goal:** UI/UX polish and power user features

**Tasks:**
- [ ] Add profession-specific visuals and theming
- [ ] Implement trait synergy highlighting
- [ ] Build breakpoint visualizer (charts for stat thresholds)
- [ ] Add gear set presets (Berserker, Marauder, Minstrel, etc.)
- [ ] Create stat priority builder (ordered stat goals)
- [ ] Implement rotation DPS calculator (advanced)
- [ ] Add food and utility item support
- [ ] Build mobile-optimized touch interface
- [ ] Add keyboard shortcuts for power users
- [ ] Create onboarding tutorial

**Deliverables:**
- Polished, production-ready UI
- Advanced features for theory crafters
- Mobile app-like experience
- User documentation

---

## Technical Considerations

### Performance Optimization

1. **Lazy Loading**
   - Load skill/trait icons on-demand
   - Virtualize large lists (e.g., skill selector with 100+ skills)
   - Code-split build editor page

2. **Calculation Caching**
   - Memoize stat calculations with `useMemo`
   - Debounce optimization runs
   - Cache MILP solver results

3. **Data Transfer**
   - Compress game data with gzip
   - Use DynamoDB batch operations
   - Minimize API calls with aggressive caching

### Accessibility

- Full keyboard navigation
- ARIA labels for all interactive elements
- Screen reader support for tooltips
- High contrast mode support

### Mobile Considerations

- Touch-optimized gear/skill selectors
- Responsive grid layouts
- Bottom sheet modals for mobile
- Swipe gestures for trait selection

---

## Integration with Existing Features

### Cross-Feature Synergies

1. **WvW Meta Integration**
   - Tag builds with WvW roles (roamer, zerg, scout)
   - Link builds to guild pages
   - Show "most popular WvW builds" on match pages

2. **Guild Builds**
   - Guilds can publish recommended builds
   - Alliance build library
   - Build templates for organized play

3. **Match Analytics Integration**
   - "Builds used by top servers" analysis
   - Meta build tracking over time
   - Build effectiveness metrics (if combat logs available)

---

## Data Requirements

### GW2 API Endpoints Needed

```
/v2/professions
/v2/professions/:id
/v2/specializations
/v2/specializations/:id
/v2/traits
/v2/traits/:id
/v2/skills
/v2/skills/:id
/v2/items (for gear, runes, sigils)
/v2/itemstats (stat combinations)
```

### Data Storage Estimates

**Per Build:**
- ~2 KB JSON per build
- 10,000 builds = 20 MB

**Game Data Cache:**
- ~500 professions/specs
- ~1,500 skills
- ~1,000 traits
- ~500 items (runes/sigils/stat combos)
- Total: ~50 MB compressed

**DynamoDB Costs:**
- Minimal (builds are small, reads are cached)
- Estimated: <$5/month for 10K builds

---

## Success Metrics

### User Engagement
- **Target:** 500 builds created in first month
- **Target:** 30% of builds are public/shared
- **Target:** 20% of users run gear optimizer

### Performance
- **Page load:** <2 seconds (build editor)
- **Stat calculation:** <50ms
- **Gear optimization:** <5 seconds
- **Build save:** <1 second

### Quality
- **Unit test coverage:** >90%
- **Zero critical bugs** in first week
- **Mobile usability score:** >90/100

---

## Risks & Mitigations

### Risk 1: GW2 API Rate Limits
**Mitigation:**
- Aggressive caching (7-day TTL)
- Batch requests where possible
- Use API key for higher limits

### Risk 2: Complex UI Performance
**Mitigation:**
- Virtualized lists for large datasets
- Memoized calculations
- Lazy loading of heavy components

### Risk 3: Optimization Complexity
**Mitigation:**
- Start with heuristic solver (fast, good enough)
- Add MILP for exact solutions later
- Provide progress indicators for long optimizations

### Risk 4: Mobile UX Challenges
**Mitigation:**
- Mobile-first design approach
- Touch-optimized controls
- Progressive disclosure (hide advanced features initially)

---

## Future Enhancements (Post-Launch)

1. **Build Templates & Loadouts**
   - Multi-build profiles per character
   - Quick swap between builds
   - Import/export loadout templates

2. **Rotation Simulator**
   - Visual skill rotation builder
   - DPS simulation with real rotations
   - Compare rotation efficiency

3. **Community Features**
   - Build comments and ratings
   - Build guides with explanations
   - User build collections

4. **AI Build Advisor**
   - AI-suggested builds based on playstyle
   - Auto-optimize for specific content
   - Meta build recommendations

5. **Integration with Combat Logs**
   - Import builds from ArcDPS logs
   - Analyze actual performance
   - Suggest improvements based on real data

---

## Conclusion

This build editor will be a **comprehensive tool for WvW players** to:
- **Optimize their gear** for effective power and survivability
- **Share builds** with guildmates and the community
- **Experiment** with different stat combinations
- **Calculate** real combat effectiveness metrics

The phased approach allows for **iterative delivery**, with core functionality in 3-4 weeks and advanced features following based on user feedback.

**Estimated Total Development Time:** 6 weeks (1 developer, full-time)
**Estimated Cost:** Infrastructure ~$10/month, minimal additional hosting costs
