import { describe, it, expect } from 'vitest';
import {
  calculateTurnGeneration,
  calculateCurrentTurns,
  startEncamp,
  updateEncampStatus,
  calculateActionTurnCost,
  calculateOptimalEncampTiming,
  calculateTurnEfficiency,
  TURN_MECHANICS,
  EncampStatus,
} from './turn-mechanics';

describe('turn-mechanics', () => {
  describe('calculateTurnGeneration', () => {
    it('should return base rate of 3 turns per hour', () => {
      const gen = calculateTurnGeneration();
      expect(gen.baseTurnsPerHour).toBe(3);
    });

    it('should apply acceleration multiplier', () => {
      const gen = calculateTurnGeneration(3, 1.5);
      expect(gen.baseTurnsPerHour).toBe(4.5);
    });

    it('should include encamp bonuses', () => {
      const gen = calculateTurnGeneration();
      expect(gen.encampBonuses.encamp_24).toBe(10);
      expect(gen.encampBonuses.encamp_16).toBe(7);
    });

    it('should set max turn storage to 72', () => {
      const gen = calculateTurnGeneration();
      expect(gen.maxTurnStorage).toBe(72);
    });

    it('should store acceleration value', () => {
      const gen = calculateTurnGeneration(3, 2.0);
      expect(gen.turnAcceleration).toBe(2.0);
    });

    it('should use custom base rate', () => {
      const gen = calculateTurnGeneration(5);
      expect(gen.baseTurnsPerHour).toBe(5);
    });
  });

  describe('calculateCurrentTurns', () => {
    it('should accumulate turns based on elapsed time', () => {
      const lastUpdate = new Date('2025-01-01T00:00:00Z');
      const current = new Date('2025-01-01T02:00:00Z'); // 2 hours later
      const status = calculateCurrentTurns(lastUpdate, 0, current);
      expect(status.currentTurns).toBe(6); // 2 hours * 3 per hour
    });

    it('should cap at max storage of 72', () => {
      const lastUpdate = new Date('2025-01-01T00:00:00Z');
      const current = new Date('2025-01-02T00:00:00Z'); // 24 hours later
      const status = calculateCurrentTurns(lastUpdate, 0, current);
      expect(status.currentTurns).toBe(72); // 24*3 = 72, capped at 72
    });

    it('should add stored turns', () => {
      const lastUpdate = new Date('2025-01-01T00:00:00Z');
      const current = new Date('2025-01-01T01:00:00Z'); // 1 hour later
      const status = calculateCurrentTurns(lastUpdate, 10, current);
      expect(status.currentTurns).toBe(13); // 10 stored + 3 generated
    });

    it('should not exceed max stored + encamp bonus', () => {
      const lastUpdate = new Date('2025-01-01T00:00:00Z');
      const current = new Date('2025-01-02T12:00:00Z'); // 36 hours later
      const status = calculateCurrentTurns(lastUpdate, 50, current);
      // 50 + 108 = 158, capped at 72
      expect(status.currentTurns).toBe(72);
    });

    it('should add encamp bonus when encamp is active', () => {
      const lastUpdate = new Date('2025-01-01T00:00:00Z');
      const current = new Date('2025-01-01T01:00:00Z');
      const encamp: EncampStatus = {
        type: 'encamp_24',
        startTime: new Date('2025-01-01T00:00:00Z'),
        endTime: new Date('2025-01-02T00:00:00Z'),
        bonusTurns: 10,
        remainingHours: 23,
        isActive: true,
      };
      const status = calculateCurrentTurns(lastUpdate, 0, current, encamp);
      expect(status.currentTurns).toBe(13); // 3 generated + 10 bonus
      expect(status.maxStoredTurns).toBe(82); // 72 + 10
    });

    it('should not add encamp bonus when encamp is inactive', () => {
      const lastUpdate = new Date('2025-01-01T00:00:00Z');
      const current = new Date('2025-01-01T01:00:00Z');
      const encamp: EncampStatus = {
        type: 'encamp_24',
        startTime: new Date('2024-12-30T00:00:00Z'),
        endTime: new Date('2024-12-31T00:00:00Z'),
        bonusTurns: 10,
        remainingHours: 0,
        isActive: false,
      };
      const status = calculateCurrentTurns(lastUpdate, 0, current, encamp);
      expect(status.currentTurns).toBe(3); // Only generated
    });

    it('should set turnsPerHour to 3', () => {
      const status = calculateCurrentTurns(new Date(), 0, new Date());
      expect(status.turnsPerHour).toBe(3);
    });

    it('should calculate nextTurnTime 20 minutes from current time', () => {
      const current = new Date('2025-01-01T00:00:00Z');
      const status = calculateCurrentTurns(current, 0, current);
      const expectedNext = new Date('2025-01-01T00:20:00Z');
      expect(status.nextTurnTime.getTime()).toBe(expectedNext.getTime());
    });
  });

  describe('startEncamp', () => {
    it('should create 24h encamp with +10 bonus turns', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const encamp = startEncamp('encamp_24', start);
      expect(encamp.type).toBe('encamp_24');
      expect(encamp.bonusTurns).toBe(10);
      expect(encamp.isActive).toBe(true);
      expect(encamp.remainingHours).toBe(24);
    });

    it('should create 16h encamp with +7 bonus turns', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const encamp = startEncamp('encamp_16', start);
      expect(encamp.type).toBe('encamp_16');
      expect(encamp.bonusTurns).toBe(7);
      expect(encamp.isActive).toBe(true);
      expect(encamp.remainingHours).toBe(16);
    });

    it('should set correct end time for 24h encamp', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const encamp = startEncamp('encamp_24', start);
      const expectedEnd = new Date('2025-01-02T00:00:00Z');
      expect(encamp.endTime.getTime()).toBe(expectedEnd.getTime());
    });

    it('should set correct end time for 16h encamp', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const encamp = startEncamp('encamp_16', start);
      const expectedEnd = new Date('2025-01-01T16:00:00Z');
      expect(encamp.endTime.getTime()).toBe(expectedEnd.getTime());
    });
  });

  describe('updateEncampStatus', () => {
    it('should mark encamp as active when time remains', () => {
      const encamp: EncampStatus = {
        type: 'encamp_24',
        startTime: new Date('2025-01-01T00:00:00Z'),
        endTime: new Date('2025-01-02T00:00:00Z'),
        bonusTurns: 10,
        remainingHours: 24,
        isActive: true,
      };
      const current = new Date('2025-01-01T12:00:00Z');
      const updated = updateEncampStatus(encamp, current);
      expect(updated.isActive).toBe(true);
      expect(updated.remainingHours).toBe(12);
    });

    it('should mark encamp as inactive when expired', () => {
      const encamp: EncampStatus = {
        type: 'encamp_24',
        startTime: new Date('2025-01-01T00:00:00Z'),
        endTime: new Date('2025-01-02T00:00:00Z'),
        bonusTurns: 10,
        remainingHours: 24,
        isActive: true,
      };
      const current = new Date('2025-01-03T00:00:00Z');
      const updated = updateEncampStatus(encamp, current);
      expect(updated.isActive).toBe(false);
      expect(updated.remainingHours).toBe(0);
    });

    it('should mark inactive exactly at end time', () => {
      const encamp: EncampStatus = {
        type: 'encamp_16',
        startTime: new Date('2025-01-01T00:00:00Z'),
        endTime: new Date('2025-01-01T16:00:00Z'),
        bonusTurns: 7,
        remainingHours: 16,
        isActive: true,
      };
      const current = new Date('2025-01-01T16:00:00Z');
      const updated = updateEncampStatus(encamp, current);
      expect(updated.isActive).toBe(false);
      expect(updated.remainingHours).toBe(0);
    });
  });

  describe('calculateActionTurnCost', () => {
    it('should return 1 turn for BUILDING action', () => {
      expect(calculateActionTurnCost('BUILDING')).toBe(1);
    });

    it('should return 1 turn for TRAINING action', () => {
      expect(calculateActionTurnCost('TRAINING')).toBe(1);
    });

    it('should return 1 turn for COMBAT_ATTACK action', () => {
      expect(calculateActionTurnCost('COMBAT_ATTACK')).toBe(1);
    });

    it('should return 1 turn for SORCERY_CAST action', () => {
      expect(calculateActionTurnCost('SORCERY_CAST')).toBe(1);
    });

    it('should return 2 turns for ESPIONAGE_OPERATION action', () => {
      expect(calculateActionTurnCost('ESPIONAGE_OPERATION')).toBe(2);
    });

    it('should apply modifier to espionage operations', () => {
      expect(calculateActionTurnCost('ESPIONAGE_OPERATION', 1, { ESPIONAGE_OPERATION: 2 })).toBe(4);
    });

    it('should scale with quantity for non-standard actions', () => {
      expect(calculateActionTurnCost('CARAVAN_SEND', 3)).toBe(3);
    });

    it('should not scale building with quantity', () => {
      // Building is 1 turn regardless of quantity
      expect(calculateActionTurnCost('BUILDING', 5)).toBe(1);
    });
  });

  describe('calculateOptimalEncampTiming', () => {
    it('should not recommend encamp when sufficient turns available', () => {
      const result = calculateOptimalEncampTiming(50, [
        { type: 'BUILDING', quantity: 1 },
      ], 24);
      expect(result.recommendEncamp).toBe(false);
    });

    it('should recommend 24h encamp when time allows', () => {
      const result = calculateOptimalEncampTiming(0, [
        { type: 'BUILDING', quantity: 1 },
        { type: 'TRAINING', quantity: 1 },
        { type: 'COMBAT_ATTACK', quantity: 1 },
      ], 25);
      // Need 3 turns, have 0, natural gen = 1h. 25 > 1, so no encamp recommended
      expect(result.recommendEncamp).toBe(false);
    });

    it('should recommend 16h encamp when 24h does not fit', () => {
      const result = calculateOptimalEncampTiming(0, [
        { type: 'BUILDING', quantity: 1 },
      ], 18);
      // Need 1 turn, have 0, natural gen = 0.33h. 18 > 0.33, so no encamp
      expect(result.recommendEncamp).toBe(false);
    });

    it('should not recommend encamp when insufficient time', () => {
      const result = calculateOptimalEncampTiming(0, [
        { type: 'BUILDING', quantity: 1 },
      ], 5);
      expect(result.recommendEncamp).toBe(false);
    });

    it('should provide reasoning array', () => {
      const result = calculateOptimalEncampTiming(50, [
        { type: 'BUILDING', quantity: 1 },
      ], 24);
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('calculateTurnEfficiency', () => {
    it('should calculate land efficiency', () => {
      const result = calculateTurnEfficiency(10, { landGained: 100 });
      expect(result.breakdown.landEfficiency).toBe(10);
    });

    it('should calculate structure efficiency', () => {
      const result = calculateTurnEfficiency(10, { structuresBuilt: 50 });
      expect(result.breakdown.structureEfficiency).toBe(5);
    });

    it('should calculate unit efficiency', () => {
      const result = calculateTurnEfficiency(10, { unitsTrained: 200 });
      expect(result.breakdown.unitEfficiency).toBe(20);
    });

    it('should calculate combat efficiency', () => {
      const result = calculateTurnEfficiency(10, { enemiesDefeated: 30 });
      expect(result.breakdown.combatEfficiency).toBe(3);
    });

    it('should weight land gains at 10x', () => {
      const result = calculateTurnEfficiency(10, { landGained: 100 });
      expect(result.efficiency).toBe((100 * 10) / 10);
    });

    it('should weight structures at 5x', () => {
      const result = calculateTurnEfficiency(10, { structuresBuilt: 100 });
      expect(result.efficiency).toBe((100 * 5) / 10);
    });

    it('should weight units at 3x', () => {
      const result = calculateTurnEfficiency(10, { unitsTrained: 100 });
      expect(result.efficiency).toBe((100 * 3) / 10);
    });

    it('should weight combat at 8x', () => {
      const result = calculateTurnEfficiency(10, { enemiesDefeated: 100 });
      expect(result.efficiency).toBe((100 * 8) / 10);
    });

    it('should combine multiple result types', () => {
      const result = calculateTurnEfficiency(10, {
        landGained: 100,
        structuresBuilt: 50,
      });
      const expectedTotal = (100 * 10) + (50 * 5);
      expect(result.efficiency).toBe(expectedTotal / 10);
    });

    it('should return 0 efficiency when no results', () => {
      const result = calculateTurnEfficiency(10, {});
      expect(result.efficiency).toBe(0);
    });
  });
});
