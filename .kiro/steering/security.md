# Security Architecture - Monarchy Game

## Server-Side Authority (MANDATORY)

All game mechanics and resource changes MUST be server-side:

- ✅ Combat calculations in Lambda functions
- ✅ Resource generation server-side
- ✅ Building construction with validation
- ✅ Unit training with capacity checks
- ❌ Never trust client-side calculations
- ❌ Never allow direct database access from frontend

## Data Access Security

### Use Amplify Data Client Only
```typescript
// ✅ CORRECT - Secure data access
const config = await getAmplifyDataClientConfig(process.env);
const client = generateClient({ config });
const result = await client.models.Kingdom.update({
  id: kingdomId,
  resources: newResources
});

// ❌ WRONG - Direct database access
const dynamoClient = new DynamoDBClient({});
```

### Authorization Patterns
User context automatically available in Lambda functions through Amplify Data Client:

```typescript
// Authorization handled automatically
const kingdom = await client.models.Kingdom.get({ id: kingdomId });
// Only returns data if user is authorized
```

## Input Validation

### Schema-Level Validation
Define input types in GraphQL schema for automatic validation:

```typescript
input CombatInput {
  attackerId: ID!
  defenderId: ID!
  attackType: String!
  units: AWSJSON!
}
```

### Resource Validation
Always validate before operations:

```typescript
// Validate ownership
const kingdom = await client.models.Kingdom.get({ id: kingdomId });
if (!kingdom.data) throw new Error('Kingdom not found');

// Validate resources
if (kingdom.data.resources.gold < cost) {
  throw new Error('Insufficient gold');
}

// Atomic update
await client.models.Kingdom.update({
  id: kingdomId,
  resources: {
    ...kingdom.data.resources,
    gold: kingdom.data.resources.gold - cost
  }
});
```

## Client-Side Restrictions

### Preview Calculations Only
Client-side can show previews but never authoritative results:

```typescript
// ✅ CORRECT - Preview only
export const previewCombatResult = (attacker, defender) => {
  // Safe preview calculation for UI
  return estimatedResult;
};

// ❌ WRONG - Authoritative calculation
export const processCombat = (attacker, defender) => {
  // This should be server-side only
};
```

### Frontend Integration
- Only GraphQL mutations allowed
- No direct Lambda invocation
- No direct database access
- All operations through Amplify API

## Error Handling Security

### Safe Error Responses
Never expose sensitive information:

```typescript
// ✅ CORRECT
return {
  statusCode: 400,
  body: JSON.stringify({ error: 'Invalid request' })
};

// ❌ WRONG - Information disclosure
return {
  statusCode: 500,
  body: JSON.stringify({ 
    error: error.message, 
    stack: error.stack,
    env: process.env 
  })
};
```

### Logging Security
- Log operations without sensitive data
- Use structured logging
- Never log credentials or tokens
- Use AWS Powertools for secure logging

## Resource Protection

### Atomic Operations
Use Amplify Data Client's built-in optimistic locking:

```typescript
await client.models.Kingdom.update({
  id: kingdomId,
  resources: {
    gold: currentGold - cost,
    land: currentLand + gained
  }
});
```

### Race Condition Prevention
- Validate resource state before operations
- Use conditional expressions for atomic updates
- Handle concurrent modification gracefully

## Game Mechanics Security

### Server-Side Calculations
All game mechanics use server-side formulas from `game-data/`:

```typescript
import { calculateLandGained } from '../../../game-data/mechanics/combat-mechanics';
import { RACIAL_BONUSES } from '../../../game-data/races/';

// Server-side calculation with exact formulas
const landGained = calculateLandGained(
  attackerOffense,
  defenderDefense,
  targetLand
);
```

### Anti-Cheat Measures
- Rate limiting on expensive operations
- Input validation with schema enforcement
- Audit logging for suspicious patterns
- Server-side randomization for combat
- Cryptographically secure random for game mechanics

## Deployment Security

### Environment Variables
- Never hardcode secrets
- Use Amplify's automatic environment injection
- Secrets managed through AWS Systems Manager
- Environment-specific configurations

### Function Permissions
- Lambda functions get minimal required permissions
- Database access granted through `addDatabaseAccess`
- No manual IAM role configuration needed
- Principle of least privilege

## Authentication & Authorization

### Cognito Integration
- User context automatically available
- Authorization handled by Amplify Data Client
- No manual credential management
- Session tokens auto-refreshed

### Model-Level Authorization
```typescript
Kingdom: a
  .model({
    // ... fields
  })
  .authorization((allow) => [
    allow.owner(), // Only owner can modify
    allow.authenticated().to(['read']) // Others can read
  ])
```

## Data Protection

### Encryption
- All data encrypted at rest and in transit
- Use AWS KMS for sensitive data
- Proper CORS configuration for production

### Rate Limiting
- Prevent spam and abuse
- Implement per-user rate limits
- Monitor for suspicious patterns

## Security Checklist

Before deploying any Lambda function:

- [ ] Uses Amplify Data Client (not DynamoDB SDK)
- [ ] Proper error handling without information disclosure
- [ ] Input validation through GraphQL schema
- [ ] Server-side authority for all calculations
- [ ] No hardcoded secrets or credentials
- [ ] Logging configured without sensitive data
- [ ] Function registered in backend.ts
- [ ] Database access granted properly
- [ ] Authorization rules defined in schema
- [ ] Rate limiting implemented for expensive operations
