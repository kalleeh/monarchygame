# Project Patterns - Monarchy Game

## Server-Side Security Patterns

### Lambda Function Service Pattern
**Pattern**: Direct Lambda invocation for game mechanics
**Implementation**: `AmplifyFunctionService` class with AWS SDK v3
```typescript
// Pattern: Type-safe Lambda invocation
class AmplifyFunctionService {
  private static async invokeLambda<T>(
    functionName: string, 
    payload: any
  ): Promise<T> {
    const client = new LambdaClient({ region: 'us-east-1' });
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload)
    });
    
    const response = await client.send(command);
    return JSON.parse(new TextDecoder().decode(response.Payload));
  }
}
```

### Resource Validation Pattern
**Pattern**: Server-side resource validation with atomic transactions
**Implementation**: DynamoDB conditional expressions
```typescript
// Pattern: Atomic resource updates
await client.models.Kingdom.update({
  id: kingdomId,
  resources: {
    ...currentResources,
    gold: currentResources.gold - cost
  }
}, {
  condition: {
    'resources.gold': { gte: cost }
  }
});
```

### Game Data Integration Pattern
**Pattern**: Centralized game mechanics with authentic formulas
**Implementation**: Import from `game-data/` modules
```typescript
// Pattern: Authentic game calculations
import { calculateLandAcquisition } from '../../../game-data/mechanics/combat-mechanics';
import { RACIAL_BONUSES } from '../../../game-data/races/';

const landGained = calculateLandAcquisition(
  attackerNetworth, 
  defenderNetworth, 
  attackerRace
);
```

## Error Handling Patterns

### Lambda Error Response Pattern
**Pattern**: Consistent error responses across all Lambda functions
```typescript
// Pattern: Standardized error handling
try {
  // Game logic
  return { success: true, data: result };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return { success: false, error: errorMessage };
}
```

### Client-Side Error Handling Pattern
**Pattern**: User-friendly error messages with fallbacks
```typescript
// Pattern: Graceful error handling
const result = await AmplifyFunctionService.processCombat(payload);
if (!result.success) {
  setError(result.error || 'Combat failed. Please try again.');
  return;
}
```

## TypeScript Safety Patterns

### Environment Variable Pattern
**Pattern**: Type-safe environment variable access
```typescript
// Pattern: Safe environment access
const resources = kingdom.data.resources as { 
  gold: number; 
  [key: string]: number 
};
```

### Ambient Module Declaration Pattern
**Pattern**: Type definitions for Amplify environment imports
```typescript
// Pattern: Ambient module declarations
declare module "$amplify/env/function-name" {
  export const env: {
    readonly [key: string]: string | undefined;
  };
}
```

## Testing Patterns

### Lambda Function Testing Pattern
**Pattern**: Isolated unit tests with mocked dependencies
```typescript
// Pattern: Lambda function testing
describe('Combat Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAmplifyEnv.AMPLIFY_DATA_GRAPHQL_ENDPOINT = 'test-endpoint';
  });

  it('processes combat successfully', async () => {
    const result = await handler(mockCombatEvent);
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing Pattern
**Pattern**: End-to-end testing with real AWS services
```typescript
// Pattern: Integration testing
const integrationTest = async () => {
  const result = await AmplifyFunctionService.processCombat({
    attackerId: 'test-kingdom',
    defenderId: 'target-kingdom'
  });
  
  expect(result.success).toBe(true);
};
```

## Performance Patterns

### Efficient DynamoDB Pattern
**Pattern**: Batch operations and conditional updates
```typescript
// Pattern: Optimized database operations
const transactItems = [
  {
    Update: {
      TableName: 'Kingdom',
      Key: { id: attackerId },
      UpdateExpression: 'SET resources.gold = resources.gold - :cost',
      ConditionExpression: 'resources.gold >= :cost',
      ExpressionAttributeValues: { ':cost': cost }
    }
  }
];
```

### Caching Pattern
**Pattern**: Client-side caching for frequently accessed data
```typescript
// Pattern: Smart caching strategy
const getCachedKingdom = (id: string) => {
  const cached = kingdomCache.get(id);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }
  return null;
};
```
