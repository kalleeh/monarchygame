# Security Architecture Rules - Amplify Gen 2

## Server-Side Authority (MANDATORY)

### Lambda Function Patterns
- All resource changes MUST happen in Lambda functions
- Use `getAmplifyDataClientConfig` and Amplify Data Client for database operations
- Never use direct DynamoDB SDK in Lambda functions
- All game mechanics calculations server-side only

### Client-Side Restrictions
- Frontend can only make preview calculations (prefix with `preview`)
- All authoritative operations through GraphQL mutations
- No direct Lambda invocation from frontend
- No direct database access from frontend

## Data Access Security

### Amplify Data Client (REQUIRED)
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

### Authentication Integration
- User context automatically available in Lambda functions
- Authorization handled by Amplify Data Client
- No manual credential management required

## Input Validation

### Schema Validation (MANDATORY)
```typescript
// Define input types in GraphQL schema
input CombatInput {
  attackerId: ID!
  defenderId: ID!
  attackType: String!
}

// Lambda functions receive validated inputs
```

### Resource Validation
- Validate resource ownership before operations
- Check resource availability before deduction
- Use conditional expressions for atomic updates

## Game Mechanics Security

### Server-Side Calculations
- Combat results calculated in Lambda functions only
- Resource generation server-side with game-data formulas
- Building construction with capacity validation
- Unit training with barracks limits

### Client-Side Previews
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

## Error Handling Security

### Information Disclosure Prevention
```typescript
// ✅ CORRECT - Safe error responses
return {
  statusCode: 400,
  body: JSON.stringify({ error: 'Invalid request' })
};

// ❌ WRONG - Information disclosure
return {
  statusCode: 500,
  body: JSON.stringify({ error: error.message, stack: error.stack })
};
```

### Logging Security
- Log operations without sensitive data
- Use structured logging with AWS Powertools
- Never log user credentials or tokens

## Resource Protection

### Atomic Operations
```typescript
// ✅ CORRECT - Atomic resource updates
await client.models.Kingdom.update({
  id: kingdomId,
  resources: {
    gold: currentGold - cost,
    land: currentLand + gained
  }
});
```

### Race Conditions Prevention
- Use Amplify Data Client's built-in optimistic locking
- Validate resource state before operations
- Handle concurrent modification gracefully

## Deployment Security

### Environment Variables
- Never hardcode secrets in code
- Use Amplify's automatic environment injection
- Secrets managed through AWS Systems Manager

### Function Permissions
- Lambda functions get minimal required permissions
- Database access granted through `addDatabaseAccess`
- No manual IAM role configuration needed
