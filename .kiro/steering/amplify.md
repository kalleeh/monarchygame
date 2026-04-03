# AWS Amplify Gen 2 - Development Guide

## Lambda Function Development (MANDATORY)

### Data Access Pattern
All Lambda functions use direct DynamoDB SDK via the shared `data-client.ts` module:

```typescript
// ✅ CORRECT — Direct DynamoDB SDK via shared client
import { dbGet, dbCreate, dbUpdate, dbDelete, dbQuery, dbConditionalUpdate, parseJsonField } from '../data-client';

const kingdom = await dbGet<KingdomType>('Kingdom', kingdomId);
const resources = parseJsonField(kingdom.resources, {} as KingdomResources);
await dbUpdate('Kingdom', kingdomId, { resources: updatedResources });

// ✅ Use GSI queries instead of full-table scans
const territories = await dbQuery('Territory', 'kingdomId', { field: 'kingdomId', value: kingdomId });

// ✅ Atomic conditional updates for race-condition prevention
await dbConditionalUpdate('TradeOffer', offerId, { status: 'accepted' }, '#s = :open', { ':open': 'open' }, { '#s': 'status' });

// ❌ WRONG — Amplify Data Client does NOT work in Lambda (no model_introspection)
import { generateClient } from 'aws-amplify/data';
```

### Shared Utilities

```typescript
// Ownership verification — use in every handler
import { verifyOwnership } from '../verify-ownership';
const denied = verifyOwnership(identity, kingdom.owner);
if (denied) return denied;

// Rate limiting — use in expensive handlers
import { checkRateLimit } from '../rate-limiter';
const rateLimited = checkRateLimit(identity.sub, 'combat');
if (rateLimited) return rateLimited;

// JSON field parsing — always use instead of inline JSON.parse
import { parseJsonField } from '../data-client';
const stats = parseJsonField(kingdom.stats, {});
```

### Function Handler Pattern
```typescript
import { verifyOwnership } from '../verify-ownership';
import { checkRateLimit } from '../rate-limiter';
import { dbGet, dbUpdate, dbQuery, parseJsonField } from '../data-client';
import { ErrorCode } from '../../../shared/types/kingdom';
import { log } from '../logger';

export const handler = async (event: any) => {
  try {
    const identity = event.identity as { sub?: string; username?: string } | null;
    if (!identity?.sub) {
      return { success: false, error: 'Authentication required', errorCode: ErrorCode.UNAUTHORIZED };
    }

    const kingdom = await dbGet('Kingdom', kingdomId);
    const denied = verifyOwnership(identity, kingdom?.owner);
    if (denied) return denied;

    const rateLimited = checkRateLimit(identity.sub, 'action-name');
    if (rateLimited) return rateLimited;

    // Business logic here
    return { success: true, result: JSON.stringify(data) };
  } catch (error) {
    log.error('handler-name', error);
    return { success: false, error: 'Operation failed', errorCode: ErrorCode.INTERNAL_ERROR };
  }
};
```

### Function Configuration
```typescript
import { defineFunction } from '@aws-amplify/backend';

export const myFunction = defineFunction({
  name: 'my-function',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 256,
  runtime: 20,
});
```

## Frontend Integration

### GraphQL Custom Mutations via AmplifyFunctionService
```typescript
// ✅ CORRECT — Frontend calls Lambda via GraphQL custom mutations
import { callFunction } from '../services/amplifyFunctionService';
const result = await callFunction('processCombat', { attackerId, defenderId, attackType });

// Domain services wrap AmplifyFunctionService:
import { processCombat } from '../services/domain/CombatService';
const result = await processCombat(attackerId, defenderId, 'standard');
```

## Backend Registration (MANDATORY)
```typescript
// amplify/backend.ts
import { myFunction } from './functions/my-function/resource';

export const backend = defineBackend({ auth, data, myFunction });

// DynamoDB permissions are granted via IAM policy (scoped to *-NONE tables)
// AppSync ListGraphqlApis permission for table name discovery
```

## Common Mistakes to Avoid

1. ❌ Using Amplify Data Client (`generateClient`) in Lambda — use `data-client.ts` instead
2. ❌ Using `dbList` (full table scan) when a GSI exists — use `dbQuery` instead
3. ❌ Inline JSON.parse for DynamoDB JSON fields — use `parseJsonField` instead
4. ❌ Duplicating ownership checks — use `verifyOwnership` utility
5. ❌ Missing rate limiting on expensive operations
6. ❌ Wildcard DynamoDB permissions — scoped to `*-NONE` ARN pattern
7. ❌ Missing function registration in backend.ts

---

**Last Updated:** April 2026
