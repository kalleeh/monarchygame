# Project Structure - Monarchy Game Modernization

## Directory Architecture

### Root Level Organization
```
monarchygame/
├── .amazonq/                    # Amazon Q steering documents
│   └── rules/                   # Development guidelines
├── amplify/                     # AWS Amplify Gen 2 backend
├── src/                         # React frontend application
├── public/                      # Static assets
├── docs/                        # Project documentation
├── scripts/                     # Build and deployment scripts
├── .github/                     # GitHub workflows and templates
└── game-data/                   # Game configuration and balance data
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

## Frontend Structure (src/)

### Component Organization
```
src/
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
│   ├── chat/                   # Real-time chat components
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   └── index.ts
│   └── layout/                 # Layout components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── GameLayout.tsx
│       └── index.ts
├── pages/                      # Route-level components
│   ├── HomePage.tsx
│   ├── GamePage.tsx
│   ├── KingdomPage.tsx
│   ├── AlliancePage.tsx
│   └── index.ts
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts              # Authentication state
│   ├── useKingdom.ts           # Kingdom management
│   ├── useRealtime.ts          # GraphQL subscriptions
│   ├── useGameState.ts         # Global game state
│   └── index.ts
├── types/                      # TypeScript definitions
│   ├── game.ts                 # Core game types
│   ├── api.ts                  # API response types
│   ├── ui.ts                   # UI component types
│   └── index.ts
├── utils/                      # Pure utility functions
│   ├── game-logic.ts           # Game calculations
│   ├── formatters.ts           # Data formatting
│   ├── validators.ts           # Input validation
│   ├── constants.ts            # Game constants
│   └── index.ts
├── styles/                     # Global styles and themes
│   ├── globals.css             # Global CSS
│   ├── components.css          # Component-specific styles
│   └── tailwind.css            # Tailwind imports
├── assets/                     # Static assets
│   ├── images/
│   ├── icons/
│   └── sounds/
├── lib/                        # Third-party integrations
│   ├── amplify.ts              # Amplify configuration
│   ├── auth.ts                 # Auth utilities
│   └── api.ts                  # API client setup
├── App.tsx                     # Root application component
├── main.tsx                    # Application entry point
└── vite-env.d.ts              # Vite type definitions
```

## Game Data Structure (game-data/)

### Configuration Files
```
game-data/
├── races/                      # Race definitions and bonuses
│   ├── human.json
│   ├── elf.json
│   ├── dwarf.json
│   ├── orc.json
│   └── index.ts               # Type-safe race loader
├── units/                      # Unit types and stats
│   ├── infantry.json
│   ├── cavalry.json
│   ├── archers.json
│   ├── siege.json
│   └── index.ts
├── buildings/                  # Building types and effects
│   ├── castle.json
│   ├── farm.json
│   ├── barracks.json
│   ├── temple.json
│   └── index.ts
├── technologies/               # Research tree
│   ├── military.json
│   ├── economic.json
│   ├── magical.json
│   └── index.ts
├── maps/                       # World map configurations
│   ├── default-world.json
│   ├── small-world.json
│   └── index.ts
└── balance/                    # Game balance parameters
    ├── combat.json             # Combat formulas
    ├── economy.json            # Resource generation
    ├── costs.json              # Building/unit costs
    └── index.ts
```

## Naming Conventions

### File Naming
- **React Components**: PascalCase (`KingdomOverview.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useKingdom.ts`)
- **Utilities**: kebab-case (`game-logic.ts`)
- **Types**: kebab-case (`game-types.ts`)
- **Constants**: kebab-case (`game-constants.ts`)
- **Pages**: PascalCase with 'Page' suffix (`GamePage.tsx`)

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

// Hook return types are descriptive
interface UseKingdomReturn {
  kingdom: Kingdom | null
  updateKingdom: (updates: Partial<Kingdom>) => Promise<void>
  loading: boolean
  error: Error | null
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

// Usage in other files
import { Button, Card, Modal } from '@/components/ui'
```

### Import Organization
```typescript
// 1. External libraries (React, third-party)
import React, { useState, useEffect } from 'react'
import { generateClient } from 'aws-amplify/data'
import { clsx } from 'clsx'

// 2. Internal imports by distance (closest to farthest)
import { Button, Card } from '../ui'
import { useKingdom } from '../../hooks/useKingdom'
import { Kingdom } from '../../types/game'
import { RACE_BONUSES } from '../../utils/constants'

// 3. Type-only imports at the end
import type { KingdomOverviewProps } from './types'
```

### Path Aliases
```typescript
// vite.config.ts path aliases
{
  '@': path.resolve(__dirname, './src'),
  '@/components': path.resolve(__dirname, './src/components'),
  '@/hooks': path.resolve(__dirname, './src/hooks'),
  '@/types': path.resolve(__dirname, './src/types'),
  '@/utils': path.resolve(__dirname, './src/utils'),
  '@/game-data': path.resolve(__dirname, './game-data')
}

// Usage
import { KingdomCard } from '@/components/game'
import { useAuth } from '@/hooks'
import { HUMAN_RACE } from '@/game-data/races'
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
Pages → Components → Hooks → Utils → Types
  ↓         ↓         ↓       ↓       ↓
Game Data ← Game Data ← Game Data ← Game Data
```

### Feature-Based Grouping
```typescript
// Group related functionality together
src/features/
├── kingdom/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── utils/
├── combat/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── utils/
└── diplomacy/
    ├── components/
    ├── hooks/
    ├── types/
    └── utils/
```

## Documentation Standards

### Component Documentation
```typescript
/**
 * Displays kingdom overview with resources, territories, and actions.
 * 
 * @param kingdom - The kingdom data to display
 * @param onUpdate - Callback when kingdom is updated
 * @param readonly - Whether the kingdom can be modified
 */
export const KingdomOverview: React.FC<KingdomOverviewProps> = ({
  kingdom,
  onUpdate,
  readonly = false
}) => {
  // Component implementation
}
```

### Function Documentation
```typescript
/**
 * Calculates combat outcome between attacking and defending forces.
 * 
 * @param attacker - Attacking force composition
 * @param defender - Defending force composition
 * @param terrain - Battlefield terrain modifiers
 * @returns Combat result with casualties and victor
 */
export const calculateCombat = (
  attacker: Army,
  defender: Army,
  terrain: TerrainType
): CombatResult => {
  // Combat calculation logic
}
```

This project structure ensures maintainable, scalable code organization while following AWS Amplify Gen 2 best practices and modern React development patterns.
