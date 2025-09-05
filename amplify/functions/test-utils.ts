// Test utilities for Amplify Gen 2 Lambda functions
import { vi, beforeEach, afterEach } from 'vitest';

// Mock Amplify environment for all functions
export const mockAmplifyEnv = {
  AMPLIFY_DATA_GRAPHQL_ENDPOINT: 'http://localhost:20002/graphql',
  AMPLIFY_DATA_MODEL_INTROSPECTION: JSON.stringify({
    version: 1,
    models: {},
    enums: {},
    nonModels: {}
  }),
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret',
  AWS_SESSION_TOKEN: 'test-token'
};

// Mock event factory for Lambda handlers
export const createMockEvent = (body: any, headers: Record<string, string> = {}) => ({
  body: JSON.stringify(body),
  headers: {
    'content-type': 'application/json',
    ...headers
  },
  requestContext: {
    requestId: 'test-request-id'
  }
});

// Mock context for Lambda handlers
export const createMockContext = () => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2025/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn()
});

// Mock Amplify data client with proper spy functions
export const mockDataClient = {
  models: {
    Kingdom: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    CombatReport: {
      create: vi.fn(),
      list: vi.fn()
    },
    Alliance: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn()
    },
    Territory: {
      create: vi.fn(),
      list: vi.fn()
    }
  }
};

// Auto-setup mocks for all Amplify imports
vi.mock('$amplify/env/resource-manager', () => ({ env: mockAmplifyEnv }));
vi.mock('$amplify/env/territory-manager', () => ({ env: mockAmplifyEnv }));
vi.mock('$amplify/env/combat-processor', () => ({ env: mockAmplifyEnv }));
vi.mock('$amplify/env/building-constructor', () => ({ env: mockAmplifyEnv }));
vi.mock('$amplify/env/spell-caster', () => ({ env: mockAmplifyEnv }));
vi.mock('$amplify/env/unit-trainer', () => ({ env: mockAmplifyEnv }));

vi.mock('aws-amplify/data', () => ({
  generateClient: () => mockDataClient
}));

vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn()
  }
}));

// Global test setup for proper mock isolation
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
