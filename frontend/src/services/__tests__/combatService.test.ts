/**
 * Combat Service Integration Tests
 * Tests for API integration and data flow
 */

import { CombatService } from '../combatService';
import type { AttackRequest, DefenseSettings } from '../../types/combat';

// Mock the Amplify client
jest.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      BattleReport: {
        create: jest.fn(),
        update: jest.fn(),
        list: jest.fn()
      },
      CombatNotification: {
        create: jest.fn(),
        list: jest.fn(),
        update: jest.fn(),
        observeQuery: jest.fn()
      },
      DefenseSettings: {
        create: jest.fn(),
        update: jest.fn(),
        list: jest.fn()
      }
    }
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('CombatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('launchAttack', () => {
    const mockAttackRequest: AttackRequest = {
      targetKingdomId: 'target-kingdom',
      attackType: 'raid',
      army: {
        peasants: 100,
        militia: 50,
        knights: 25,
        cavalry: 10
      }
    };

    it('successfully launches an attack', async () => {
      const mockCombatResult = {
        success: true,
        attackType: 'raid',
        attacker: {
          kingdomId: 'attacker-kingdom',
          casualties: { peasants: 10, militia: 5 }
        },
        defender: {
          kingdomId: 'target-kingdom',
          casualties: { peasants: 20, militia: 10 },
          fortificationLevel: 2
        },
        spoils: { gold: 1500, population: 25, land: 5 },
        timestamp: new Date().toISOString()
      };

      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCombatResult)
      });

      const result = await CombatService.launchAttack(mockAttackRequest);

      expect(result).toEqual(mockCombatResult);
      expect(fetch).toHaveBeenCalledWith('/api/combat/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockAttackRequest)
      });
    });

    it('handles attack failure', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(CombatService.launchAttack(mockAttackRequest))
        .rejects.toThrow('Failed to launch attack');
    });

    it('handles network errors', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(CombatService.launchAttack(mockAttackRequest))
        .rejects.toThrow('Failed to launch attack');
    });
  });

  describe('updateDefenseSettings', () => {
    const mockDefenseSettings: DefenseSettings = {
      stance: 'defensive',
      unitDistribution: {
        frontline: 50,
        reserves: 30,
        fortifications: 20
      },
      autoRetaliate: false,
      alertAlliance: true
    };

    it('creates new defense settings when none exist', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      mockClient.models.DefenseSettings.list.mockResolvedValue({
        data: []
      });
      mockClient.models.DefenseSettings.create.mockResolvedValue({
        data: { id: 'new-settings-id' }
      });

      await CombatService.updateDefenseSettings(mockDefenseSettings);

      expect(mockClient.models.DefenseSettings.create).toHaveBeenCalledWith({
        stance: 'defensive',
        unitDistribution: mockDefenseSettings.unitDistribution,
        autoRetaliate: false,
        alertAlliance: true,
        kingdomId: 'current-user-kingdom-id'
      });
    });

    it('updates existing defense settings', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      mockClient.models.DefenseSettings.list.mockResolvedValue({
        data: [{ id: 'existing-settings-id' }]
      });
      mockClient.models.DefenseSettings.update.mockResolvedValue({
        data: { id: 'existing-settings-id' }
      });

      await CombatService.updateDefenseSettings(mockDefenseSettings);

      expect(mockClient.models.DefenseSettings.update).toHaveBeenCalledWith({
        id: 'existing-settings-id',
        stance: 'defensive',
        unitDistribution: mockDefenseSettings.unitDistribution,
        autoRetaliate: false,
        alertAlliance: true
      });
    });

    it('handles defense settings update failure', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      mockClient.models.DefenseSettings.list.mockRejectedValue(new Error('Database error'));

      await expect(CombatService.updateDefenseSettings(mockDefenseSettings))
        .rejects.toThrow('Failed to update defense settings');
    });
  });

  describe('getBattleHistory', () => {
    it('retrieves and combines battle history', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      const mockAttacksLaunched = {
        data: [
          { id: '1', attackerId: 'test-kingdom', timestamp: '2023-01-01T00:00:00Z' }
        ]
      };
      const mockAttacksReceived = {
        data: [
          { id: '2', defenderId: 'test-kingdom', timestamp: '2023-01-02T00:00:00Z' }
        ]
      };

      mockClient.models.BattleReport.list
        .mockResolvedValueOnce(mockAttacksLaunched)
        .mockResolvedValueOnce(mockAttacksReceived);

      const result = await CombatService.getBattleHistory('test-kingdom');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('isAttacker', false); // More recent
      expect(result[1]).toHaveProperty('isAttacker', true);
    });

    it('handles battle history retrieval failure', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      mockClient.models.BattleReport.list.mockRejectedValue(new Error('Database error'));

      await expect(CombatService.getBattleHistory('test-kingdom'))
        .rejects.toThrow('Failed to get battle history');
    });
  });

  describe('getNotifications', () => {
    it('retrieves notifications sorted by timestamp', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      const mockNotifications = {
        data: [
          { id: '1', timestamp: '2023-01-01T00:00:00Z' },
          { id: '2', timestamp: '2023-01-02T00:00:00Z' }
        ]
      };

      mockClient.models.CombatNotification.list.mockResolvedValue(mockNotifications);

      const result = await CombatService.getNotifications('test-kingdom');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2'); // More recent first
      expect(result[1].id).toBe('1');
    });
  });

  describe('markNotificationAsRead', () => {
    it('marks notification as read', async () => {
      const mockClient = require('aws-amplify/data').generateClient();
      mockClient.models.CombatNotification.update.mockResolvedValue({
        data: { id: 'notification-id', isRead: true }
      });

      await CombatService.markNotificationAsRead('notification-id');

      expect(mockClient.models.CombatNotification.update).toHaveBeenCalledWith({
        id: 'notification-id',
        isRead: true
      });
    });
  });

  describe('subscribeToNotifications', () => {
    it('sets up real-time subscription', () => {
      const mockClient = require('aws-amplify/data').generateClient();
      const mockSubscription = {
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
      };
      mockClient.models.CombatNotification.observeQuery.mockReturnValue(mockSubscription);

      const mockCallback = jest.fn();
      const subscription = CombatService.subscribeToNotifications('test-kingdom', mockCallback);

      expect(mockClient.models.CombatNotification.observeQuery).toHaveBeenCalledWith({
        filter: { kingdomId: { eq: 'test-kingdom' } }
      });
      expect(mockSubscription.subscribe).toHaveBeenCalled();
    });

    it('calls callback with unread notifications', () => {
      const mockClient = require('aws-amplify/data').generateClient();
      const mockCallback = jest.fn();
      
      let subscribeCallback: any;
      const mockSubscription = {
        subscribe: jest.fn().mockImplementation((callbacks) => {
          subscribeCallback = callbacks.next;
          return { unsubscribe: jest.fn() };
        })
      };
      mockClient.models.CombatNotification.observeQuery.mockReturnValue(mockSubscription);

      CombatService.subscribeToNotifications('test-kingdom', mockCallback);

      // Simulate receiving notifications
      const mockNotifications = [
        { id: '1', isRead: false, message: 'New attack!' },
        { id: '2', isRead: true, message: 'Old notification' }
      ];

      subscribeCallback({ items: mockNotifications });

      expect(mockCallback).toHaveBeenCalledWith(mockNotifications[0]);
    });
  });
});
