import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AWS Amplify client - must be defined before imports
vi.mock('@aws-amplify/backend-function/runtime', () => ({
  getAmplifyDataClientConfig: vi.fn().mockResolvedValue({})
}));

vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(() => ({
    models: {
      Kingdom: {
        get: vi.fn(),
        update: vi.fn()
      }
    }
  }))
}));

import { handler } from '../handler';
import { generateClient } from 'aws-amplify/data';

// Get the mocked client
const mockClient = generateClient({} as any);
const mockGet = mockClient.models.Kingdom.get as any;
const mockUpdate = mockClient.models.Kingdom.update as any;

// Dummy Lambda context following Context7 patterns
const dummyContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionVersion: '$LATEST',
  functionName: 'resource-manager',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/resource-manager',
  logStreamName: '2025/09/04/[$LATEST]abcdef123456',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:resource-manager',
  awsRequestId: 'test-request-id-123',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

describe('Resource Manager Lambda Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Turn Generation', () => {
    it('should generate 3 turns successfully', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 1000 }
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'generate',
        resourceType: 'generate_turns'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(mockGet).toHaveBeenCalledWith({ id: 'kingdom-123' });
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'kingdom-123',
        resources: { turns: 13, gold: 1000 }
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Resources updated successfully');
    });

    it('should handle zero turns correctly', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 0, gold: 500 }
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'generate',
        resourceType: 'generate_turns'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'kingdom-123',
        resources: { turns: 3, gold: 500 }
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Income Generation', () => {
    it('should generate income successfully', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 5, gold: 2000 }
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'generate',
        resourceType: 'generate_income'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'kingdom-123',
        resources: { turns: 5, gold: 3000 }
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle kingdom not found', async () => {
      // Prepare
      mockGet.mockResolvedValue({ data: null });

      const event = {
        kingdomId: 'nonexistent-kingdom',
        operation: 'generate',
        resourceType: 'generate_turns'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toBe('Kingdom not found');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Prepare
      mockGet.mockRejectedValue(new Error('Database connection failed'));

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'generate',
        resourceType: 'generate_turns'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle invalid operation types', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 1000 }
        }
      };
      mockGet.mockResolvedValue(mockKingdom);

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'invalid_operation',
        resourceType: 'generate_turns'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'kingdom-123',
        resources: { turns: 10, gold: 1000 } // No changes
      });
    });
  });

  describe('Resource Validation', () => {
    it('should handle missing resources object', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: null
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'generate',
        resourceType: 'generate_turns'
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'kingdom-123',
        resources: { turns: 3 }
      });
      expect(result.success).toBe(true);
    });
  });
});
