# Project Structure - Monarchy Game Modernization

## Directory Architecture

### Root Level Organization
```
monarchygame/
├── .kiro/                       # Kiro steering documents
│   └── steering/                # Development guidelines
├── amplify/                     # AWS Amplify Gen 2 backend
├── frontend/                    # React frontend application
│   └── src/                     # Source code
├── public/                      # Static assets
├── docs/                        # Project documentation
├── game-data/                   # Game configuration and balance data
└── tests/                       # E2E tests
```

## Backend Structure (amplify/)

### Amplify Gen 2 File Conventions
```
amplify/
├── backend.ts                   # Main backend definition
├── auth/
│   └── resource.ts             # Cognito authentication config
├── data/
│   ├── resource.ts             # GraphQL schema definition
│   └── types.ts                # Generated TypeScript types
├── functions/                   # Custom Lambda functions
│   ├── combat-processor/
│   │   ├── resource.ts         # Function definition
│   │   ├── handler.ts          # Lambda handler code
│   │   └── package.json        # Function dependencies
│   └── turn-processor/
│       ├── resource.ts
│       ├── handler.ts
│       └── package.json
└── storage/
    └── resource.ts             # S3 bucket for game assets
```

### Backend Naming Conventions
- **Resources**: kebab-case (`combat-processor`, `turn-processor`)
- **Functions**: camelCase exports (`combatProcessor`, `turnProcessor`)
- **Schema Types**: PascalCase (`Kingdom`, `Territory`, `Alliance`)
- **GraphQL Fields**: camelCase (`kingdomName`, `lastUpdated`)

## Frontend Structure (frontend/src/)

### Component Organization
```
frontend/src/
├── components/                  # Reusable UI components
│   ├── ui/                     # Basic UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── index.ts            # Barrel exports
│   ├── game/                   # Game-specific components
│   │   ├── KingdomOverview.tsx
│   │   ├── TerritoryMap.tsx
│   │   ├── UnitList.tsx
│   │   └── index.ts
│   ├── combat/                 # Combat components
│   │   ├── AttackPlanner.tsx
│   │   ├── CombatInterface.tsx
│   │   └── index.ts
│   └── layout/                 # Layout components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── GameLayout.tsx
│       └── index.ts
├── pages/                      # Route-level components (deprecated)
├── services/                   # API services
│   ├── amplifyFunctionService.ts
│   ├── combatService.ts
│   ├── AllianceService.ts
│   └── index.ts
├── stores/                     # State management
│   ├── kingdomStore.ts
│   ├── allianceStore.ts
│   └── index.ts
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts
│   ├── useKingdom.ts
│   ├── useTurnGeneration.ts
│   └── index.ts
├── types/                      # TypeScript definitions
│   ├── game.ts
│   ├── api.ts
│   └── index.ts
├── utils/                      # Pure utility functions
│   ├── game-logic.ts
│   ├── formatters.ts
│   └── index.ts
├── data/                       # Static data
│   └── tutorialSteps.ts
├── App.tsx                     # Root component
└── main.tsx                    # Entry point
```

## Game Data Structure (game-data/)

### Configuration Files
```
game-data/
├── races/                      # Race definitions and bonuses
│   ├── human.ts
│   ├── elf.ts
│   └── index.ts
├── units/                      # Unit types and stats
│   ├── infantry.ts
│   └── index.ts
├── buildings/                  # Building types and effects
│   ├── castle.ts
│   └── index.ts
├── mechanics/                  # Game mechanics
│   ├── combat-mechanics.ts
│   ├── sorcery-mechanics.ts
│   ├── mana-mechanics.ts
│   └── index.ts
├── spells/                     # Spell definitions
│   └── index.ts
└── balance/                    # Game balance parameters
    └── index.ts
```

## Naming Conventions

### File Naming
- **React Components**: PascalCase (`KingdomOverview.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useKingdom.ts`)
- **Services**: camelCase with 'Service' suffix (`combatService.ts`)
- **Stores**: camelCase with 'Store' suffix (`kingdomStore.ts`)
- **Utilities**: kebab-case (`game-logic.ts`)
- **Types**: kebab-case (`game-types.ts`)

### Component Naming
```typescript
// Component files use PascalCase
export const KingdomOverview: React.FC<KingdomOverviewProps> = ({ kingdom }) => {
  return <div className="kingdom-overview">...</div>
}

// Props interfaces match component name + Props
interface KingdomOverviewProps {
  kingdom: Kingdom
  onUpdate?: (kingdom: Kingdom) => void
}
```

### Hook Naming
```typescript
// Custom hooks start with 'use' and are camelCase
export const useKingdom = (kingdomId: string) => {
  const [kingdom, setKingdom] = useState<Kingdom | null>(null)
  // ... hook logic
  return { kingdom, updateKingdom, loading, error }
}
```

## Import/Export Patterns

### Barrel Exports
```typescript
// components/ui/index.ts
export { Button } from './Button'
export { Card } from './Card'
export { Modal } from './Modal'
export type { ButtonProps, CardProps, ModalProps } from './types'
```

### Import Organization
```typescript
// 1. External libraries (React, third-party)
import React, { useState, useEffect } from 'react'
import { generateClient } from 'aws-amplify/data'

// 2. Internal imports by distance (closest to farthest)
import { Button, Card } from '../ui'
import { useKingdom } from '../../hooks/useKingdom'
import { Kingdom } from '../../types/game'

// 3. Type-only imports at the end
import type { KingdomOverviewProps } from './types'
```

## Code Organization Principles

### Single Responsibility
- Each file has one primary purpose
- Components focus on rendering and user interaction
- Hooks manage state and side effects
- Utils contain pure functions
- Types define data structures

### Dependency Direction
```
Components → Services → Hooks → Utils → Types
     ↓           ↓        ↓       ↓       ↓
Game Data ← Game Data ← Game Data ← Game Data
```
