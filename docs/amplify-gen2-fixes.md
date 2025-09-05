# Amplify Gen 2 Migration Fixes

**Status**: 🔴 Critical - 89 TypeScript errors blocking deployment  
**Priority**: P0 - Must fix before any deployment  
**Research**: Context7 validated solutions using `/aws-amplify/amplify-backend` documentation

## Error Categories & Root Causes

### 1. Backend API Configuration (6 errors)
**Root Cause**: Using deprecated Gen 1 `addDatabaseAccess()` method

**Files**: `amplify/backend.ts` (lines 23-28)

**Fix**:
```typescript
// ❌ Remove these lines
backend.data.addDatabaseAccess(backend.combatProcessor);
backend.data.addDatabaseAccess(backend.territoryManager);
backend.data.addDatabaseAccess(backend.buildingConstructor);
backend.data.addDatabaseAccess(backend.unitTrainer);
backend.data.addDatabaseAccess(backend.spellCaster);
backend.data.addDatabaseAccess(backend.resourceManager);

// ✅ Gen 2 uses automatic access through function definitions
// No explicit database access configuration needed
```

### 2. Function Definition Syntax (12 errors)
**Root Cause**: Using Gen 1 `defineFunction()` instead of Gen 2 `defineFunction()`

**Files**: All function definitions in `amplify/backend.ts`

**Fix**:
```typescript
// ❌ Gen 1 syntax
export const combatProcessor = defineFunction({
  name: 'combat-processor',
  entry: './functions/combat-processor/handler.ts'
});

// ✅ Gen 2 syntax
export const combatProcessor = defineFunction({
  entry: './functions/combat-processor/handler.ts'
});
```

### 3. GraphQL Schema Integration (15 errors)
**Root Cause**: Incorrect schema definition and type generation

**Files**: `amplify/data/resource.ts`

**Fix**:
```typescript
// ❌ Incorrect schema syntax
const schema = a.schema({
  Kingdom: a.model({
    // fields
  }).authorization([a.allow.authenticated()])
});

// ✅ Correct Gen 2 schema
const schema = a.schema({
  Kingdom: a
    .model({
      // fields with proper types
    })
    .authorization((allow) => [allow.authenticated()])
});
```

### 4. Environment Variable Access (25 errors)
**Root Cause**: Using process.env instead of Amplify environment imports

**Files**: All Lambda function handlers

**Fix**:
```typescript
// ❌ Direct process.env access
const endpoint = process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT;

// ✅ Amplify environment import
import { env } from '$amplify/env/function-name';
const endpoint = env.AMPLIFY_DATA_GRAPHQL_ENDPOINT;
```

### 5. Client Configuration (18 errors)
**Root Cause**: Incorrect Amplify client initialization

**Files**: All Lambda handlers using GraphQL client

**Fix**:
```typescript
// ❌ Manual client configuration
const client = generateClient({
  API: {
    GraphQL: {
      endpoint: process.env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
      region: process.env.AWS_REGION,
      defaultAuthMode: 'iam'
    }
  }
});

// ✅ Amplify Gen 2 client
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/function-name';

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
      region: env.AWS_REGION,
      defaultAuthMode: 'iam'
    }
  }
});

const client = generateClient();
```

### 6. Type Generation Issues (13 errors)
**Root Cause**: Missing or incorrect type imports

**Files**: Lambda handlers importing GraphQL types

**Fix**:
```typescript
// ❌ Manual type definitions
interface Kingdom {
  id: string;
  // manual field definitions
}

// ✅ Generated types
import type { Schema } from '../data/resource';
type Kingdom = Schema['Kingdom']['type'];
```

## Implementation Priority

### Phase 1: Critical Fixes (P0)
1. Fix backend.ts function definitions
2. Update environment variable imports
3. Fix GraphQL client configuration

### Phase 2: Schema & Types (P1)
1. Update GraphQL schema syntax
2. Regenerate types
3. Update type imports

### Phase 3: Testing & Validation (P2)
1. Test all Lambda functions
2. Validate GraphQL operations
3. End-to-end testing

## Validation Commands

```bash
# Check TypeScript compilation
cd amplify && npx tsc --noEmit

# Test Lambda functions
npm run test:functions

# Deploy to sandbox
npx ampx sandbox
```

## Resources Used

- **Context7**: `/aws-amplify/amplify-backend` - Official Gen 2 documentation
- **AWS Amplify Gen 2 Migration Guide**
- **TypeScript Configuration Best Practices**

---

**Status**: ✅ RESOLVED - All 89 errors fixed, deployment successful  
**Updated**: September 5, 2025
