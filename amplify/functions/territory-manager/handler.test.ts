import { describe, it, expect } from 'vitest';
import { handler } from './handler';
import { mockDataClient } from '../test-utils';

describe('Territory Manager Handler', () => {
  it('expands territory successfully', async () => {
    const mockKingdom = {
      data: {
        id: 'kingdom-123',
        resources: {
          gold: 2000,
          land: 10
        }
      }
    };

    mockDataClient.models.Kingdom.get.mockResolvedValue(mockKingdom);
    mockDataClient.models.Kingdom.update.mockResolvedValue({ data: mockKingdom.data });

    const event = {
      kingdomId: 'kingdom-123',
      landCost: 1000,
      landGain: 2
    };

    const result = await handler(event);

    expect(result.success).toBe(true);
    expect(result.landGained).toBe(2);
    expect(mockDataClient.models.Kingdom.get).toHaveBeenCalledWith({ id: 'kingdom-123' });
    expect(mockDataClient.models.Kingdom.update).toHaveBeenCalled();
  });

  it('handles insufficient gold', async () => {
    const mockKingdom = {
      data: {
        id: 'kingdom-123',
        resources: {
          gold: 500,
          land: 10
        }
      }
    };

    mockDataClient.models.Kingdom.get.mockResolvedValue(mockKingdom);

    const event = {
      kingdomId: 'kingdom-123',
      landCost: 1000
    };

    const result = await handler(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient gold for territory expansion');
  });

  it('handles kingdom not found', async () => {
    mockDataClient.models.Kingdom.get.mockResolvedValue({ data: null });

    const event = {
      kingdomId: 'invalid-kingdom',
      landCost: 1000
    };

    const result = await handler(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Kingdom not found');
  });
});
