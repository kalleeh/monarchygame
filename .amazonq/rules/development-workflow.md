# Development Workflow Rules - Amplify Gen 2

## Function Development Checklist

### 1. Create Function Structure
```bash
mkdir amplify/functions/my-function
cd amplify/functions/my-function
```

### 2. Required Files (MANDATORY)
- `handler.ts` - Function implementation with Amplify Data Client
- `resource.ts` - Function definition with proper configuration
- `package.json` - Dependencies with correct versions

### 3. Handler Pattern (MANDATORY)
```typescript
import { getAmplifyDataClientConfig } from '@aws-amplify/backend-function/runtime';
import { generateClient } from 'aws-amplify/data';

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

### 4. Resource Definition (MANDATORY)
```typescript
import { defineFunction } from '@aws-amplify/backend';

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

### 5. Backend Registration (MANDATORY)
```typescript
// amplify/backend.ts
import { myFunction } from './functions/my-function/resource';

export const backend = defineBackend({
  auth,
  data,
  myFunction
});

backend.data.addDatabaseAccess(backend.myFunction);
```

## Frontend Integration Workflow

### 1. GraphQL Mutations (REQUIRED)
```typescript
// Add to schema
const schema = a.schema({
  // ... models ...
}).addToSchema({
  myMutation: a
    .mutation()
    .arguments({ input: a.ref('MyInput') })
    .returns(a.ref('MyResult'))
    .handler(a.handler.function(myFunction))
});
```

### 2. Frontend Service Pattern (MANDATORY)
```typescript
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

export const myService = {
  async performAction(input: MyInput) {
    const result = await client.graphql({
      query: `mutation MyMutation($input: MyInput!) {
        myMutation(input: $input) { success }
      }`,
      variables: { input }
    });
    return result.data?.myMutation;
  }
};
```

## Testing Workflow

### 1. Local Development
```bash
npx ampx sandbox  # Start local environment
```

### 2. Function Testing
- Test through GraphQL mutations
- Mock `getAmplifyDataClientConfig` for unit tests
- Use Amplify Data Client in integration tests

### 3. Deployment Testing
```bash
npx ampx sandbox deploy  # Deploy to sandbox
```

## Code Quality Checklist

### Before Commit (MANDATORY)
- [ ] Function uses Amplify Data Client
- [ ] Proper error handling implemented
- [ ] Logging configuration added
- [ ] Package.json includes correct dependencies
- [ ] GraphQL mutations defined
- [ ] Frontend uses GraphQL (not direct Lambda calls)
- [ ] Security rules followed

### Before Deploy (MANDATORY)
- [ ] All functions registered in backend.ts
- [ ] Database access granted to functions
- [ ] Environment variables configured
- [ ] Input validation implemented
- [ ] Error responses don't leak sensitive data

## Common Patterns

### Resource Updates
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

### Error Handling
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

### Input Validation
```typescript
// Define in GraphQL schema
input MyInput {
  id: ID!
  amount: Int!
}

// Validation happens automatically
```

## Deployment Workflow

### 1. Development
```bash
npx ampx sandbox  # Local development
```

### 2. Testing
```bash
npx ampx sandbox deploy  # Deploy to sandbox
```

### 3. Production
```bash
npx ampx pipeline deploy  # Deploy to production
```

## Troubleshooting

### Common Issues
- Missing `getAmplifyDataClientConfig` import
- Direct DynamoDB SDK usage
- Missing database access grants
- Incorrect GraphQL mutation definitions
- Direct Lambda invocation from frontend

### Debug Steps
1. Check CloudWatch logs
2. Verify function registration in backend.ts
3. Confirm database access grants
4. Test GraphQL mutations in console
5. Validate input schemas
