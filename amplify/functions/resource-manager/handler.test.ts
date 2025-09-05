import { describe, it, expect } from 'vitest';
import { handler } from './handler';
import { mockDataClient } from '../test-utils';

describe('Resource Manager Handler', () => {
  it('processes resource update successfully', async () => {
    const mockKingdom = {
      data: {
        id: 'kingdom-123',
        resources: {
          gold: 1000,
          food: 500,
          population: 100
        }
      }
    };

    mockDataClient.models.Kingdom.get.mockResolvedValue(mockKingdom);
    mockDataClient.models.Kingdom.update.mockResolvedValue({ data: mockKingdom.data });

    const event = {
      kingdomId: 'kingdom-123',
      goldChange: 100
    };

    const result = await handler(event);

    expect(result.success).toBe(true);
    expect(result.resources.gold).toBe(1100);
    expect(mockDataClient.models.Kingdom.get).toHaveBeenCalledWith({ id: 'kingdom-123' });
    expect(mockDataClient.models.Kingdom.update).toHaveBeenCalled();
  });

  it('handles multiple resource changes', async () => {
    const mockKingdom = {
      data: {
        id: 'kingdom-123',
        resources: {
          gold: 1000,
          population: 100,
          land: 50
        }
      }
    };

    mockDataClient.models.Kingdom.get.mockResolvedValue(mockKingdom);
    mockDataClient.models.Kingdom.update.mockResolvedValue({ data: mockKingdom.data });

    const event = {
      kingdomId: 'kingdom-123',
      goldChange: -200,
      populationChange: 50,
      landChange: 10
    };

    const result = await handler(event);

    expect(result.success).toBe(true);
    expect(result.resources.gold).toBe(800);
    expect(result.resources.population).toBe(150);
    expect(result.resources.land).toBe(60);
  });

  it('handles kingdom not found', async () => {
    mockDataClient.models.Kingdom.get.mockResolvedValue({ data: null });

    const event = {
      kingdomId: 'invalid-kingdom',
      goldChange: 100
    };

    const result = await handler(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Kingdom not found');
  });

  it('handles database errors', async () => {
    mockDataClient.models.Kingdom.get.mockRejectedValue(new Error('Database connection failed'));

    const event = {
      kingdomId: 'kingdom-123',
      goldChange: 100
    };

    const result = await handler(event);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });
});
