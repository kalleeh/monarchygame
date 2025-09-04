# Amplify Gen 2 Best Practices - Development Rules

## Lambda Function Development

### Data Access Pattern (MANDATORY)
```typescript
// ✅ CORRECT - Use Amplify Data Client
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

const config = await getAmplifyDataClientConfig(process.env);
const client = generateClient({ config });
const result = await client.models.Kingdom.get({ id: kingdomId });

// ❌ WRONG - Direct DynamoDB SDK
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
```

### Function Configuration (MANDATORY)
```typescript
// ✅ CORRECT - Complete function definition
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

### Package.json Requirements (MANDATORY)
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

## Frontend Integration

### Function Invocation Pattern (MANDATORY)
```typescript
// ✅ CORRECT - GraphQL mutations
const client = generateClient<Schema>();
const result = await client.graphql({
  query: `mutation ProcessCombat($input: CombatInput!) {
    processCombat(input: $input) { success }
  }`,
  variables: { input: payload }
});

// ❌ WRONG - Direct Lambda invocation
import { LambdaClient } from '@aws-sdk/client-lambda';
```

## Schema Requirements

### Custom Mutations (REQUIRED)
```typescript
// Add to schema for Lambda function triggers
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

## Environment Variables

### Auto-Injection (AUTOMATIC)
- Table names: Auto-injected by Amplify
- GraphQL endpoint: Available via `getAmplifyDataClientConfig`
- Region: Auto-configured
- Credentials: Auto-managed

## Dependencies

### Frontend
```json
{
  "dependencies": {
    "aws-amplify": "^6.15.5",
    "@aws-amplify/ui-react": "^6.12.0"
  }
}
```

### Lambda Functions
```json
{
  "dependencies": {
    "@aws-amplify/backend-function": "latest",
    "aws-amplify": "latest"
  }
}
```

## Security Patterns

### Server-Side Authority (MANDATORY)
- All resource changes in Lambda functions only
- Use Amplify Data Client for database operations
- Client-side preview calculations only (marked with `preview` prefix)
- Input validation with proper schemas

### Authentication Integration
```typescript
// Lambda functions automatically receive user context
// Access via Amplify Data Client with proper authorization
```

## Error Handling

### Standard Pattern (MANDATORY)
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

## Deployment Requirements

### Backend Registration (MANDATORY)
```typescript
// amplify/backend.ts
export const backend = defineBackend({
  auth,
  data,
  myFunction
});

// Grant data access
backend.data.addDatabaseAccess(backend.myFunction);
```

## Testing Patterns

### Local Development
```bash
npx ampx sandbox  # Start local environment
```

### Function Testing
- Use Amplify Data Client in tests
- Mock `getAmplifyDataClientConfig` for unit tests
- Integration tests through GraphQL mutations
