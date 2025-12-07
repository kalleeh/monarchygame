# Monarchy Game - Architecture & Design Decisions

**Purpose:** Technical architecture and critical design decisions  
**When to use:** System design, integration questions, understanding technical choices  
**Git-tracked:** Yes - all major architectural decisions documented

---

## Server-Side Authority Architecture

### Critical Security Decision: Server-Side Game Mechanics

**Problem Resolved:** Frontend was making fetch calls to non-existent `/api/` endpoints, creating broken functionality and potential security vulnerabilities with client-side calculations.

**Solution Implemented:** Complete server-side authority through AWS Lambda functions with direct invocation.

### Implementation Details

**AmplifyFunctionService Created:**
- **File:** `/frontend/src/services/amplifyFunctionService.ts`
- **Purpose:** Direct Lambda function invocation using AWS SDK
- **Features:**
  - Proper AWS credentials handling through Amplify auth
  - Direct Lambda invocation with `@aws-sdk/client-lambda`
  - Error handling and response parsing
  - Type-safe interfaces for all game operations

**CombatService Updated:**
- Replaced all `fetch('/api/...)` calls with `AmplifyFunctionService` methods
- Methods: `launchAttack()`, `claimTerritory()`, `constructBuildings()`, `trainUnits()`, `castSpell()`, `generateResources()`

**Dependencies Added:**
- `@aws-sdk/client-lambda@^3.709.0`
- Environment: `VITE_AWS_REGION=us-east-1`

### Lambda Functions Architecture

All 6 Lambda functions properly configured in `amplify/backend.ts`:

1. **combatProcessor** - Combat calculations with DynamoDB transactions
2. **territoryManager** - Territory claiming with resource validation
3. **buildingConstructor** - Building construction with BR limits
4. **unitTrainer** - Unit training with barracks capacity checks
5. **spellCaster** - Spell casting with temple requirements
6. **resourceManager** - Turn generation and resource updates

### Security Architecture Achieved

**Server-Side Authority:**
- ✅ All resource changes happen in Lambda functions only
- ✅ Atomic DynamoDB transactions prevent race conditions
- ✅ Input validation with AWS Powertools schemas
- ✅ Conditional expressions ensure data consistency

**Client-Side Safety:**
- ✅ Frontend only makes preview calculations (clearly marked)
- ✅ All authoritative calculations moved to Lambda
- ✅ No direct database access from frontend
- ✅ Proper error handling and user feedback

---

## AWS Amplify Gen 2 Architecture

### Backend Configuration

**Technology Stack:**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** AWS Amplify Gen 2 + Aurora Serverless v2
- **Real-time:** GraphQL Subscriptions + WebSockets
- **Authentication:** AWS Cognito User Pools
- **Database:** PostgreSQL with GraphQL API
- **Deployment:** AWS Amplify Hosting

### GraphQL Schema Design

**Core Models:**
```graphql
type Kingdom @model @auth(rules: [{allow: owner}]) {
  id: ID!
  name: String!
  race: String!
  resources: Resources!
  buildings: Buildings!
  units: Units!
  stats: Stats!
}

type Alliance @model @auth(rules: [{allow: authenticated}]) {
  id: ID!
  name: String!
  members: [Kingdom!]!
  invitations: [AllianceInvitation!]!
}

type BattleReport @model @auth(rules: [{allow: owner}]) {
  id: ID!
  attackerId: ID!
  defenderId: ID!
  result: BattleResult!
  timestamp: AWSDateTime!
}
```

### Function Naming Convention

Lambda functions follow Amplify naming: `amplify-monarchygame-{functionName}`
- `amplify-monarchygame-combatProcessor`
- `amplify-monarchygame-territoryManager`
- `amplify-monarchygame-buildingConstructor`
- `amplify-monarchygame-unitTrainer`
- `amplify-monarchygame-spellCaster`
- `amplify-monarchygame-resourceManager`

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
├── combat/
│   ├── CombatInterface.tsx
│   ├── AttackPlanner.tsx
│   └── BattleReport.tsx
├── kingdom/
│   ├── KingdomDashboard.tsx
│   ├── KingdomCreation.tsx
│   └── ResourcePanel.tsx
├── alliance/
│   ├── AllianceManagement.tsx
│   ├── AllianceChat.tsx
│   └── AllianceInvitations.tsx
├── magic/
│   ├── MagicSystem.tsx
│   └── SpellCasting.tsx
├── trade/
│   ├── TradeSystem.tsx
│   └── TradeEconomy.tsx
└── ui/
    ├── Tutorial.tsx
    ├── TurnTimer.tsx
    └── Leaderboard.tsx
```

### State Management (Zustand)

**Store Architecture:**
```typescript
// Core stores
- useKingdomStore      // Kingdom state + resources
- useCombatStore       // Combat state + battle history
- useAllianceStore     // Alliance state + real-time chat
- useSpellStore        // Magic state + elan tracking
- useTradeStore        // Trade state + economy
- useTutorialStore     // Tutorial progress + localStorage
```

### Real-Time Features

**GraphQL Subscriptions:**
- Alliance chat messages
- Battle notifications
- Resource updates
- Kingdom status changes

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
Bundle Size:     1.44MB (optimized)
Build Time:      3.35s
Load Time:       <3s on 3G
Lighthouse:      95+ Performance
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

**Current Status:**
- **Tests:** 53/53 passing (100%)
- **Coverage:** Core components tested
- **Framework:** Vitest + React Testing Library

**Test Categories:**
- Component tests (rendering, interactions)
- Service tests (API calls, data transformation)
- Integration tests (component interactions)
- E2E tests (Playwright - user flows)

### Quality Gates

**Zero Tolerance Policy:**
- ✅ TypeScript: 0 compilation errors
- ✅ ESLint: 0 errors, 0 warnings
- ✅ Tests: 100% pass rate
- ✅ Build: Production successful

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
- Demo mode for testing

### Authorization Patterns

**GraphQL Authorization:**
```graphql
@auth(rules: [
  {allow: owner}           # User owns the resource
  {allow: authenticated}   # Any authenticated user
  {allow: groups, groups: ["Admin"]}  # Admin only
])
```

### Data Protection

**Security Measures:**
- Server-side validation for all game actions
- Atomic DynamoDB transactions
- Input sanitization
- Rate limiting on Lambda functions
- Encrypted data at rest and in transit

---

## Monitoring & Observability

### CloudWatch Integration

**Logging:**
- Lambda function logs
- API Gateway logs
- Application logs
- Error tracking

**Metrics:**
- Function invocation counts
- Error rates
- Latency percentiles
- Database performance

### Performance Monitoring

**Key Metrics:**
- Page load times
- API response times
- Database query performance
- Real-time subscription latency

---

## Future Architecture Considerations

### Scalability

**Horizontal Scaling:**
- Lambda auto-scaling
- Aurora Serverless auto-scaling
- CloudFront CDN for static assets

**Vertical Optimization:**
- Database query optimization
- Caching strategies
- Connection pooling

### Feature Expansion

**Planned Enhancements:**
- Advanced combat mechanics (terrain, formations)
- Guild warfare system
- Achievement system
- Player rankings/leaderboards
- Tutorial/onboarding flow

---

**Last Updated:** November 2025  
**Status:** Production-ready architecture  
**Deployment:** AWS Amplify Gen 2
