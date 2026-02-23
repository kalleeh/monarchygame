# Technology Stack - Monarchy Game Modernization

## Architecture Philosophy
**TypeScript-First, Serverless-Native**: Leverage AWS Amplify Gen 2's TypeScript-centric approach for end-to-end type safety and modern development experience. Prioritize simplicity and maintainability over premature optimization.

## Core Technology Stack

### Frontend Framework
- **React 18+** with TypeScript
  - **Rationale**: Component-based architecture perfect for complex game UI, excellent TypeScript support
  - **State Management**: Built-in useState/useReducer + custom hooks for game state
  - **Styling**: Tailwind CSS for rapid, responsive design
  - **Build Tool**: Vite for fast development and optimized production builds

### Backend Platform  
- **AWS Amplify Gen 2**
  - **Backend Definition**: TypeScript-based configuration in `amplify/` directory
  - **API**: GraphQL with real-time subscriptions for live updates
  - **Database**: Aurora Serverless v2 PostgreSQL for complex game queries
  - **Authentication**: Cognito User Pools with email/username login
  - **Deployment**: Git-based with automatic CI/CD

### Real-Time Features
- **GraphQL Subscriptions**: Built-in real-time updates for chat and notifications
- **Push Notifications**: AWS SNS for attack alerts and important events
- **WebSocket Fallback**: Automatic fallback for older browsers

### Development Tools
- **Package Manager**: npm (Amplify Gen 2 standard)
- **Code Quality**: ESLint + Prettier with TypeScript rules
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Version Control**: Git with conventional commits
- **IDE**: VS Code with Amplify extensions

## Data Architecture

### Database Design
```typescript
// Core Game Models (PostgreSQL via GraphQL)
Kingdom: {
  id: string
  name: string
  race: RaceType
  resources: ResourceState
  territories: Territory[]
  owner: string // Cognito user ID
}

Territory: {
  id: string
  name: string
  coordinates: { x: number, y: number }
  buildings: Building[]
  units: Unit[]
  kingdomId: string
}

Alliance: {
  id: string
  name: string
  members: string[]
  leader: string
  treaties: Treaty[]
}

ChatMessage: {
  id: string
  content: string
  author: string
  room: string // 'global', 'alliance-123'
  timestamp: AWSDateTime
}
```

### Type Safety Strategy
- **Schema-First**: Define GraphQL schema, generate TypeScript types
- **End-to-End Types**: From database to frontend components
- **Runtime Validation**: Zod schemas for user inputs and API responses
- **Strict TypeScript**: Enable all strict mode flags

## Authentication & Authorization

### User Management
- **Cognito User Pools**: Email/username registration
- **User Attributes**: preferredUsername (kingdom name)
- **Session Management**: Automatic token refresh
- **Password Policy**: Minimum 8 characters, mixed case, numbers

### Authorization Patterns
```typescript
// GraphQL Authorization Rules
Kingdom: a.model({
  // ... fields
}).authorization(allow => [
  allow.owner(), // Only kingdom owner can modify
  allow.authenticated().to(['read']) // Others can read for diplomacy
])

ChatMessage: a.model({
  // ... fields  
}).authorization(allow => [
  allow.authenticated() // All logged-in users can chat
])
```

## Performance Considerations

### Frontend Optimization
- **Code Splitting**: Route-based lazy loading
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large lists (territories, units)
- **Image Optimization**: WebP format, lazy loading
- **Bundle Analysis**: Regular bundle size monitoring

### Backend Optimization  
- **GraphQL Best Practices**: Efficient queries, avoid N+1 problems
- **DynamoDB Design**: Single-table design with GSIs for complex queries
- **Caching**: CloudFront for static assets, DynamoDB DAX if needed
- **Lambda Optimization**: Minimize cold starts with proper bundling

## Security Requirements

### Data Protection
- **Encryption**: All data encrypted at rest and in transit
- **Input Validation**: Server-side validation for all user inputs
- **Rate Limiting**: Prevent spam and abuse
- **CORS**: Properly configured for production domains

### Game Security
- **Server Authority**: All game logic validated server-side
- **Anti-Cheat**: Rate limiting, input validation, suspicious pattern detection
- **Audit Logging**: Track all significant game actions
- **Secure Randomization**: Cryptographically secure random for combat

## Development Workflow

### Local Development
```bash
# Start local development
npm run dev              # Frontend dev server
npx ampx sandbox        # Local Amplify backend

# Code quality
npm run lint            # ESLint + TypeScript check
npm run format          # Prettier formatting
npm test               # Unit tests with Vitest
```

### Deployment Pipeline
- **Git-Based**: Push to main branch triggers deployment
- **Environment Separation**: Separate AWS accounts for dev/prod
- **Automated Testing**: Run tests before deployment
- **Rollback Strategy**: Git revert triggers automatic rollback

## Monitoring & Observability

### Application Monitoring
- **CloudWatch**: Lambda metrics, API Gateway logs
- **X-Ray**: Distributed tracing for performance debugging
- **Real User Monitoring**: Core Web Vitals tracking
- **Error Tracking**: CloudWatch Insights for error analysis

### Game Analytics
- **Player Metrics**: Session length, retention, feature usage
- **Performance Metrics**: API response times, error rates
- **Business Metrics**: Player acquisition, engagement patterns

## Scalability Strategy

### Current Scale (MVP)
- **Target**: 50-200 concurrent players
- **DynamoDB**: On-demand billing, auto-scaling
- **Lambda**: Automatic scaling to handle traffic spikes
- **CloudFront**: Global CDN for static assets

### Growth Path
- **Phase 1**: Single region, basic monitoring
- **Phase 2**: Multi-region deployment, advanced analytics  
- **Phase 3**: Custom optimizations, dedicated infrastructure

## Technology Constraints

### Must Use
- **AWS Amplify Gen 2**: Core platform requirement
- **TypeScript**: End-to-end type safety
- **React**: Frontend framework choice
- **GraphQL**: API layer for real-time features

### Avoid
- **Complex State Management**: Redux, Zustand (use React built-ins)
- **Multiple Databases**: Stick to DynamoDB for simplicity
- **Custom Infrastructure**: Leverage Amplify abstractions
- **Premature Optimization**: Focus on functionality first

### Migration Path
If Amplify becomes limiting:
1. **Custom Resolvers**: Add Lambda functions for complex logic
2. **Aurora Serverless**: Replace DynamoDB for complex queries
3. **Manual AWS**: Migrate to CDK/CloudFormation if needed

## Code Standards

### File Organization
```
src/
├── components/          # Reusable UI components
├── pages/              # Route components  
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Pure utility functions
└── constants/          # Game configuration

amplify/
├── backend.ts          # Backend definition
├── auth/               # Authentication config
├── data/               # GraphQL schema
└── functions/          # Custom Lambda functions
```

### Naming Conventions
- **Components**: PascalCase (`KingdomOverview.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useKingdomState.ts`)
- **Types**: PascalCase (`KingdomState`, `RaceType`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_TERRITORIES`)
- **Files**: kebab-case for non-components (`game-utils.ts`)

### Import Patterns
```typescript
// External libraries first
import React from 'react'
import { generateClient } from 'aws-amplify/data'

// Internal imports by distance
import { KingdomCard } from '../components/KingdomCard'
import { useKingdomState } from '../hooks/useKingdomState'
import type { Kingdom } from '../types/game'
```
