# Monarchy Game - Architecture & Design Decisions

**Purpose:** Technical architecture and critical design decisions  
**When to use:** System design, integration questions, understanding technical choices  
**Git-tracked:** Yes - all major architectural decisions documented

---

## Server-Side Authority Architecture

### Design: All Game Logic Server-Side

All 19 Lambda functions enforce server-side authority. The frontend never performs authoritative calculations — only preview estimates for UI display.

### Data Access Pattern

Lambda functions use direct DynamoDB SDK via a shared `data-client.ts` module (NOT Amplify Data Client):

```typescript
// amplify/functions/data-client.ts — shared across all 19 functions
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const dbGet = async (tableName, key) => { ... };
export const dbPut = async (tableName, item) => { ... };
export const dbUpdate = async (tableName, key, updates) => { ... };
export const dbQuery = async (tableName, indexName, keyCondition) => { ... };
export const dbConditionalUpdate = async (tableName, key, updates, condition) => { ... };
export const parseJsonField = (field) => { ... };
```

Key utilities:
- **`dbQuery` with GSIs** — replaces full-table `dbList` scans for efficient lookups
- **`dbConditionalUpdate`** — atomic conditional operations to prevent race conditions
- **`parseJsonField`** — consistent JSON field parsing across all handlers
- **`verifyOwnership`** (`verify-ownership.ts`) — shared ownership validation
- **`rate-limiter.ts`** — shared server-side rate limiting per kingdom/action

### Lambda Functions (19 total)

All registered in `amplify/backend.ts` with database access granted:

| # | Function | Purpose |
|---|----------|---------|
| 1 | combat-processor | Combat calculations, land acquisition, casualty resolution |
| 2 | resource-manager | Turn-based resource generation |
| 3 | building-constructor | Building construction with BR limits |
| 4 | unit-trainer | Unit training with barracks capacity checks |
| 5 | spell-caster | Spell casting with temple/mana requirements |
| 6 | territory-claimer | Territory claiming with resource validation |
| 7 | season-manager | Season creation and management |
| 8 | war-manager | War declarations and resolution |
| 9 | trade-processor | Trade offer creation and acceptance |
| 10 | diplomacy-processor | Diplomatic relations and treaties |
| 11 | season-lifecycle | Season start/end transitions |
| 12 | thievery-processor | Espionage operations |
| 13 | faith-processor | Faith/religion system |
| 14 | bounty-processor | Bounty placement and collection |
| 15 | alliance-treasury | Alliance shared treasury operations |
| 16 | alliance-manager | Alliance creation, invitations, membership |
| 17 | turn-ticker | Automated turn generation (EventBridge: every 20 min) |
| 18 | kingdom-cleanup | Abandoned kingdom cleanup |

**EventBridge Schedules:**
- **Season check** — runs hourly, triggers `season-lifecycle`
- **Turn ticker** — runs every 20 minutes, triggers `turn-ticker`

### Security Architecture

**Server-Side Authority:**
- ✅ All resource changes happen in Lambda functions only
- ✅ `dbConditionalUpdate` for atomic operations preventing race conditions
- ✅ `verifyOwnership` validates kingdom ownership on every mutation
- ✅ `rate-limiter.ts` prevents abuse per kingdom/action type

**Client-Side Safety:**
- ✅ Frontend only makes preview calculations (clearly marked)
- ✅ All authoritative calculations in Lambda
- ✅ No direct database access from frontend
- ✅ Domain service layer → AmplifyFunctionService → GraphQL mutations

---

## AWS Amplify Gen 2 Architecture

### Backend Configuration

**Technology Stack:**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** AWS Amplify Gen 2 + DynamoDB
- **Real-time:** GraphQL Subscriptions via Amplify `observeQuery`
- **Authentication:** AWS Cognito User Pools
- **Database:** DynamoDB with GraphQL API
- **State Management:** Zustand (17 stores)
- **Deployment:** AWS Amplify Hosting
- **Visualization:** React Flow (interactive maps), Recharts (economic data)
- **Animations:** React Spring (spell effects)

### Database: DynamoDB

Table naming convention: `<ModelName>-<API_ID>-NONE`

DynamoDB permissions scoped to `*-NONE` table ARN pattern (least privilege).

**17 Models with GSIs:**

| Model | GSI Fields |
|-------|-----------|
| Kingdom | seasonId |
| Territory | kingdomId |
| BattleReport | defenderId, attackerId |
| WarDeclaration | attackerId, defenderId |
| RestorationStatus | kingdomId |
| CombatNotification | recipientId |
| TradeOffer | sellerId |
| DiplomaticRelation | kingdomId |
| Treaty | proposerId |
| AllianceInvitation | inviteeId |
| Alliance | — |
| Season | — |
| ChatMessage | — |
| Bounty | — |
| Achievement | — |
| Leaderboard | — |
| FaithStatus | — |

### Function Invocation Pattern

Frontend → Domain Service → `AmplifyFunctionService` → GraphQL custom mutations → Lambda handler

```typescript
// Schema custom mutations (amplify/data/resource.ts)
processCombat: a.mutation()
  .arguments({ input: a.json() })
  .returns(a.json())
  .handler(a.handler.function(combatProcessor))
```

---

## Game Data Architecture

### Authentic Mechanics Preservation

**Source Documentation:**
- NPAC Elite Forum (2010-2014) - Pro player strategies
- Official Monarchy Forums - Game mechanics
- 25+ years of player-discovered optimal strategies

**Implementation Structure:**
```
game-data/
├── mechanics/          # Mathematical formulas
│   ├── combat-mechanics.ts
│   ├── sorcery-mechanics.ts
│   ├── thievery-mechanics.ts
│   ├── building-mechanics.ts
│   ├── bounty-mechanics.ts
│   └── restoration-mechanics.ts
├── races/             # Racial abilities and stats
├── units/             # Combat values
├── buildings/         # Building ratios
├── spells/            # Sorcery system
└── balance/           # Game balance constants
```

### Mathematical Precision

**All formulas implemented with exact values:**
- Land acquisition: 6.79%-7.35% ranges
- Turn generation: 3 per hour (20 minutes each)
- Elan generation: 0.005 (Sidhe/Vampire), 0.003 (others)
- Combat casualties: 5% (with ease), 15% (good fight), 25% (failed)
- Build rate limits: 26-28 maximum sustainable
- Development costs: 310-325 gold per acre

---

## Frontend Architecture

### Component Structure

```
src/components/
├── KingdomDashboard.tsx        # Main kingdom management view
├── KingdomList.tsx             # Kingdom browser/list
├── BattleReportsRoute.tsx      # Battle report viewer
├── ReplayRoute.tsx             # Single replay viewer
├── ReplaysListRoute.tsx        # Replay browser
├── UnitRoster.tsx              # Unit management
├── WorldMapMobile.tsx          # Interactive territory map
├── admin/
│   └── AdminDashboard.tsx      # Admin tools
├── guild/
│   └── DeclareWarModal.tsx     # War declaration UI
└── ui/
    ├── FirstSteps.tsx          # Onboarding tutorial
    ├── HelpModal.tsx           # Help system
    └── loading/
        ├── LoadingButton.tsx
        ├── LoadingSkeleton.tsx
        ├── Skeleton.tsx
        └── Spinner.tsx
```

### State Management — 17 Zustand Stores

```typescript
// Core game stores
useKingdomStore         // Kingdom state, resources, buildings
useCombatStore          // Combat state, battle history
useAllianceStore        // Alliance membership, chat
useSpellStore           // Magic state, elan tracking
useTradeStore           // Trade offers, economy
useTutorialStore        // Tutorial progress (localStorage)
useTerritoryStore       // Territory/land management
useFaithStore           // Faith alignment, focus points
useBountyStore          // Bounty targets and rewards
useAiKingdomStore       // AI kingdom behavior/tick

// System stores
useSeasonStore          // Season lifecycle, age progression
useLeaderboardStore     // Rankings, race tabs
useAchievementStore     // 22 achievements across 6 categories
useThieveryStore        // Espionage operations
useDiplomacyStore       // Diplomatic relations, treaties
useWarStore             // War declarations, guild warfare
useNotificationStore    // Real-time notifications
```

### Dual-Mode Architecture

The app supports two modes:
- **Demo mode** — localStorage-backed, no authentication required
- **Auth mode** — Cognito authentication, DynamoDB-backed via GraphQL

### Code Splitting

All routes use `React.lazy` with `Suspense` for code splitting:

```typescript
const KingdomDashboard = lazy(() => import('./components/KingdomDashboard'));
const BattleReportsRoute = lazy(() => import('./components/BattleReportsRoute'));
// ... all routes lazy-loaded
```

### Domain Service Layer

```
Frontend Component
  → Domain Service (services/domain/*.ts)
    → AmplifyFunctionService (services/amplifyFunctionService.ts)
      → GraphQL custom mutation
        → Lambda handler
```

---

## Design System

### Dark Theme Architecture

**Color Palette:**
```css
/* Primary Colors */
--cyan-primary: #4ecdc4;
--teal-dark: #44a08d;
--white: #ffffff;
--light-gray: #a0a0a0;
--off-white: #e0e0e0;

/* Backgrounds */
--dark-gradient: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
--semi-transparent: rgba(255, 255, 255, 0.1);
--page-background: purple to blue gradient;
```

**Component Patterns:**
- Dark theme with purple gradients
- Card-based layouts
- Smooth animations (0.2s ease)
- Touch-friendly (44px minimum)
- Glassmorphism effects

### Accessibility Standards

**WCAG 2.1 AA Compliance:**
- Contrast ratio: 4.5:1 minimum for normal text
- Contrast ratio: 3:1 minimum for large text
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

---

## Performance Architecture

### Build Metrics

```
Bundle Size:     2.0MB (JS assets)
Build Time:      8.28s
Load Time:       <3s on 3G
Lighthouse:      95+ Performance
Lambda Functions: 19 registered + 2 EventBridge schedules
```

### Optimization Strategies

**Code Splitting:**
- Lazy loading for heavy components
- Route-based splitting
- Dynamic imports for features

**State Optimization:**
- useMemo for expensive calculations
- useCallback for stable function references
- Proper dependency arrays

**Asset Optimization:**
- Image compression
- Font subsetting
- CSS minification

---

## Testing Architecture

### Test Coverage

**Current Status (April 2026):**
- **Total:** 778/778 passing (100%)
  - Backend Lambda tests: 220 tests across 18 files
  - Shared mechanics tests: 433 tests across 10 files
  - Frontend store/service tests: 125 tests across 23 files
- **E2E:** 21 Playwright specs
- **Framework:** Vitest + React Testing Library
- **Property-Based Testing:** fast-check for game balance invariants

**Test Categories:**
- Unit tests (Lambda handlers, shared mechanics, stores)
- Property-based tests (race balance, combat mechanics, economic systems)
- Component tests (rendering, interactions)
- E2E tests (Playwright — user flows)

### Quality Gates

**Zero Tolerance Policy:**
- ✅ TypeScript: 0 compilation errors (strict mode)
- ✅ ESLint: 0 errors, 0 warnings
- ✅ Tests: 778/778 passing (100%)
- ✅ Build: Production successful (2.0MB, 8.28s)

---

## Deployment Architecture

### AWS Amplify Hosting

**Deployment Command:**
```bash
npx ampx sandbox deploy --branch main
```

**Environment Configuration:**
- Production: `main` branch auto-deploy
- Staging: `develop` branch auto-deploy
- Preview: PR-based deployments

### CI/CD Pipeline

**Automated Checks:**
1. TypeScript compilation
2. ESLint validation
3. Test suite execution
4. Build verification
5. Deployment to Amplify

---

## Security Architecture

### Authentication Flow

**AWS Cognito Integration:**
- User registration with email verification
- Secure password requirements
- Session management
- Token refresh handling
- Demo mode for testing (localStorage-backed, no auth required)

### Authorization Patterns

**Lambda-Level Authorization:**
```typescript
// Every handler validates ownership via shared utility
import { verifyOwnership } from '../verify-ownership';
const denied = verifyOwnership(identity, kingdom.owner);
if (denied) return denied;
```

### Data Protection

**Security Measures:**
- `verifyOwnership` on every mutation handler
- `rate-limiter.ts` per kingdom/action type (in-memory sliding window)
- `dbConditionalUpdate` for atomic operations
- DynamoDB permissions scoped to `*-NONE` table ARN pattern
- Input validation in all Lambda handlers
- Encrypted data at rest and in transit

---

## Monitoring & Observability

### CloudWatch Dashboard

**Dashboard:** `MonarchyGame` — 4 widgets:
1. Lambda invocation counts
2. Lambda error counts
3. Lambda duration (p50/p99)
4. DynamoDB throttle events

### CloudWatch Alarms (3)

| Alarm | Threshold | Period |
|-------|-----------|--------|
| Lambda Errors | ≥ 5 errors | 5 minutes |
| Lambda p99 Duration | > 10 seconds | 5 minutes |
| DynamoDB Throttles | ≥ 10 events | 5 minutes |

### SNS Alerts

SNS topic configured for alarm notifications. Subscribe to receive email/SMS alerts for production issues.

### Logging

- Structured logging via shared `logger.ts` utility
- Lambda function logs in CloudWatch Logs
- No sensitive data in logs (PII, tokens, credentials)

---

## Future Architecture Considerations

### Remaining Backlog

- Territory system unification (3 disconnected implementations → unified two-tier model)
- Server-side rate limiting with DynamoDB (current is in-memory per Lambda instance)
- Additional GSIs for reverse-relationship queries (buyerId on TradeOffer, recipientId on Treaty, etc.)
- Bundle size optimization (2.0MB → target <1.5MB)

### Scalability

**Current Design:**
- Lambda auto-scaling for compute
- DynamoDB on-demand billing with auto-scaling
- CloudFront CDN for static assets
- GSI queries ensure O(1) lookups instead of O(n) scans

---

**Last Updated:** April 2026  
**Status:** Feature complete, production deployment pending  
**Deployment:** AWS Amplify Gen 2
