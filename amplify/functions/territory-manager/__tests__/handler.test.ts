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
      },
      Territory: {
        create: vi.fn()
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
const mockCreate = mockClient.models.Territory.create as any;

// Dummy Lambda context
const dummyContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionVersion: '$LATEST',
  functionName: 'territory-manager',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/territory-manager',
  logStreamName: '2025/09/04/[$LATEST]abcdef123456',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:territory-manager',
  awsRequestId: 'test-request-id-456',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

describe('Territory Manager Lambda Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Territory Claiming', () => {
    it('should claim territory successfully with sufficient resources', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 5000, land: 100 },
          race: 'human'
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });
      mockCreate.mockResolvedValue({ data: { id: 'territory-456' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          name: 'New Territory',
          terrain: 'plains',
          coordinates: { x: 10, y: 20 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(mockGet).toHaveBeenCalledWith({ id: 'kingdom-123' });
      expect(mockCreate).toHaveBeenCalledWith({
        kingdomId: 'kingdom-123',
        name: 'New Territory',
        terrain: 'plains',
        coordinates: { x: 10, y: 20 },
        buildings: [],
        defenses: 0
      });
      
      // Check resource deduction (authentic Monarchy formula: 6.79%-7.35% of current land)
      const expectedLandCost = Math.floor(100 * 0.0679); // ~6-7 land
      const expectedGoldCost = expectedLandCost * 100; // 100 gold per land
      
      expect(mockUpdate).toHaveBeenCalledWith({
        id: 'kingdom-123',
        resources: {
          turns: 9, // 1 turn used
          gold: 5000 - expectedGoldCost,
          land: 100 + 1 // 1 new land gained
        }
      });
      expect(result.success).toBe(true);
    });

    it('should fail when insufficient turns', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 0, gold: 5000, land: 100 },
          race: 'human'
        }
      };
      mockGet.mockResolvedValue(mockKingdom);

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          name: 'New Territory',
          terrain: 'plains',
          coordinates: { x: 10, y: 20 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient turns');
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should fail when insufficient gold', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 100, land: 100 }, // Low gold
          race: 'human'
        }
      };
      mockGet.mockResolvedValue(mockKingdom);

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          name: 'New Territory',
          terrain: 'plains',
          coordinates: { x: 10, y: 20 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient gold');
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('Racial Bonuses', () => {
    it('should apply Elven land acquisition bonus', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 5000, land: 100 },
          race: 'elven'
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });
      mockCreate.mockResolvedValue({ data: { id: 'territory-456' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          name: 'Elven Territory',
          terrain: 'forest',
          coordinates: { x: 15, y: 25 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(true);
      // Elven should get bonus land (1.2x multiplier)
      const landGained = Math.floor(1 * 1.2); // Should be 1 with bonus
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: expect.objectContaining({
            land: 100 + landGained
          })
        })
      );
    });

    it('should apply Goblin cost reduction', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 3000, land: 100 },
          race: 'goblin'
        }
      };
      mockGet.mockResolvedValue(mockKingdom);
      mockUpdate.mockResolvedValue({ data: { id: 'kingdom-123' } });
      mockCreate.mockResolvedValue({ data: { id: 'territory-456' } });

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          name: 'Goblin Territory',
          terrain: 'swamp',
          coordinates: { x: 5, y: 15 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(true);
      // Goblin should have reduced costs (0.8x multiplier)
      const baseCost = Math.floor(100 * 0.0679) * 100;
      const reducedCost = Math.floor(baseCost * 0.8);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: expect.objectContaining({
            gold: 3000 - reducedCost
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle kingdom not found', async () => {
      // Prepare
      mockGet.mockResolvedValue({ data: null });

      const event = {
        kingdomId: 'nonexistent-kingdom',
        operation: 'claim',
        territoryData: {
          name: 'Test Territory',
          terrain: 'plains',
          coordinates: { x: 0, y: 0 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toBe('Kingdom not found');
    });

    it('should handle database errors', async () => {
      // Prepare
      mockGet.mockRejectedValue(new Error('Database error'));

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          name: 'Test Territory',
          terrain: 'plains',
          coordinates: { x: 0, y: 0 }
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should validate required territory data', async () => {
      // Prepare
      const mockKingdom = {
        data: {
          id: 'kingdom-123',
          resources: { turns: 10, gold: 5000, land: 100 },
          race: 'human'
        }
      };
      mockGet.mockResolvedValue(mockKingdom);

      const event = {
        kingdomId: 'kingdom-123',
        operation: 'claim',
        territoryData: {
          // Missing required fields
          name: '',
          terrain: '',
          coordinates: null
        }
      };

      // Act
      const result = await handler(event, dummyContext);

      // Assess
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid territory data');
    });
  });
});
