# AWS Amplify Gen 2 - Development Guide

## Lambda Function Development (MANDATORY)

### Data Access Pattern
Always use Amplify Data Client, never direct DynamoDB SDK:

```typescript
// ✅ CORRECT
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

const config = await getAmplifyDataClientConfig(process.env);
const client = generateClient({ config });
const result = await client.models.Kingdom.get({ id: kingdomId });

// ❌ WRONG - Never use direct DynamoDB SDK
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
```

### Function Handler Pattern
```typescript
export const handler = async (event: any) => {
  try {
    const config = await getAmplifyDataClientConfig(process.env);
    const client = generateClient({ config });
    
    // Business logic here
    
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Function failed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Function failed' }) };
  }
};
```

### Function Configuration
```typescript
export const myFunction = defineFunction({
  name: 'my-function',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  memoryMB: 512,
  logging: {
    format: 'json',
    level: 'info',
    retention: 'ONE_WEEK'
  },
  bundling: {
    minify: true
  }
});
```

### Package.json Requirements
```json
{
  "name": "function-name",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-amplify/backend-function": "latest",
    "aws-amplify": "latest"
  }
}
```

## Frontend Integration (REQUIRED)

### GraphQL Mutations Only
Never invoke Lambda functions directly from frontend:

```typescript
// ✅ CORRECT - Use GraphQL mutations
const client = generateClient<Schema>();
const result = await client.graphql({
  query: `mutation ProcessCombat($input: CombatInput!) {
    processCombat(input: $input) { success }
  }`,
  variables: { input: payload }
});

// ❌ WRONG - Never use direct Lambda invocation
import { LambdaClient } from '@aws-sdk/client-lambda';
```

### Schema Custom Mutations
```typescript
const schema = a.schema({
  // ... models ...
}).addToSchema({
  processCombat: a
    .mutation()
    .arguments({ input: a.ref('CombatInput') })
    .returns(a.ref('CombatResult'))
    .handler(a.handler.function(combatProcessor))
});
```

## Development Workflow

### 1. Create Function Structure
```bash
mkdir amplify/functions/my-function
cd amplify/functions/my-function
```

### 2. Required Files (MANDATORY)
- `handler.ts` - Function implementation with Amplify Data Client
- `resource.ts` - Function definition with proper configuration
- `package.json` - Dependencies with correct versions

### 3. Backend Registration (MANDATORY)
```typescript
// amplify/backend.ts
import { myFunction } from './functions/my-function/resource';

export const backend = defineBackend({
  auth,
  data,
  myFunction
});

// Grant database access
backend.data.addDatabaseAccess(backend.myFunction);
```

## Environment Variables

### Auto-Injection (AUTOMATIC)
- Table names: Auto-injected by Amplify
- GraphQL endpoint: Available via `getAmplifyDataClientConfig`
- Region: Auto-configured
- Credentials: Auto-managed
- Never hardcode secrets in code

## Error Handling

### Standard Pattern (MANDATORY)
```typescript
try {
  // Operation
} catch (error) {
  console.error('Operation failed:', error);
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Operation failed' })
  };
}
```

### Never Expose Sensitive Information
```typescript
// ✅ CORRECT
return {
  statusCode: 400,
  body: JSON.stringify({ error: 'Invalid request' })
};

// ❌ WRONG
return {
  statusCode: 500,
  body: JSON.stringify({ error: error.message, stack: error.stack })
};
```

## Testing

### Local Development
```bash
npx ampx sandbox  # Start local Amplify environment
```

### Function Testing
- Test through GraphQL mutations
- Mock `getAmplifyDataClientConfig` for unit tests
- Use Amplify Data Client in integration tests

### Deployment
```bash
npx ampx sandbox deploy  # Deploy to sandbox
npx ampx pipeline deploy  # Deploy to production
```

## Common Patterns

### Resource Updates (Atomic)
```typescript
// Always validate before update
const kingdom = await client.models.Kingdom.get({ id: kingdomId });
if (!kingdom.data) throw new Error('Kingdom not found');

// Atomic update
await client.models.Kingdom.update({
  id: kingdomId,
  resources: {
    ...kingdom.data.resources,
    gold: kingdom.data.resources.gold - cost
  }
});
```

### Input Validation
```typescript
// Define in GraphQL schema for automatic validation
input CombatInput {
  attackerId: ID!
  defenderId: ID!
  attackType: String!
}
```

## Common Mistakes to Avoid

1. ❌ Using direct DynamoDB SDK instead of Amplify Data Client
2. ❌ Direct Lambda invocation from frontend
3. ❌ Missing database access grants in backend.ts
4. ❌ Exposing error details in responses
5. ❌ Client-side authoritative calculations
6. ❌ Hardcoding environment variables
7. ❌ Missing function registration in backend.ts

## Code Quality Checklist

### Before Commit (MANDATORY)
- [ ] Function uses Amplify Data Client
- [ ] Proper error handling implemented
- [ ] Logging configuration added
- [ ] Package.json includes correct dependencies
- [ ] GraphQL mutations defined
- [ ] Frontend uses GraphQL (not direct Lambda calls)

### Before Deploy (MANDATORY)
- [ ] All functions registered in backend.ts
- [ ] Database access granted to functions
- [ ] Environment variables configured
- [ ] Input validation implemented
- [ ] Error responses don't leak sensitive data
