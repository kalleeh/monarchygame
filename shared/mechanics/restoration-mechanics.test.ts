import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  assessDamageForRestoration,
  calculateRestorationStatus,
  calculateStrategicRestorationValue,
  calculateSorceryKillVsRestorationEfficiency,
  RESTORATION_MECHANICS,
} from './restoration-mechanics';

describe('restoration-mechanics', () => {
  describe('assessDamageForRestoration', () => {
    it('should trigger damage-based restoration on 70%+ structure loss', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace'] },
        { structures: 300, population: 10000, criticalBuildings: ['palace'] }
      );
      expect(result.qualifiesForRestoration).toBe(true);
      expect(result.restorationType).toBe('damage_based');
      expect(result.structureLossPercentage).toBe(0.7);
    });

    it('should trigger damage-based restoration on 80%+ population loss', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace'] },
        { structures: 1000, population: 2000, criticalBuildings: ['palace'] }
      );
      expect(result.qualifiesForRestoration).toBe(true);
      expect(result.restorationType).toBe('damage_based');
      expect(result.populationLossPercentage).toBe(0.8);
    });

    it('should trigger death-based restoration on complete structure elimination', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace'] },
        { structures: 0, population: 10000, criticalBuildings: [] }
      );
      expect(result.qualifiesForRestoration).toBe(true);
      expect(result.restorationType).toBe('death_based');
    });

    it('should trigger death-based restoration on complete population elimination', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace'] },
        { structures: 1000, population: 0, criticalBuildings: ['palace'] }
      );
      expect(result.qualifiesForRestoration).toBe(true);
      expect(result.restorationType).toBe('death_based');
    });

    it('should trigger damage-based restoration on critical infrastructure loss', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace', 'fortress'] },
        { structures: 900, population: 9000, criticalBuildings: ['fortress'] }
      );
      expect(result.qualifiesForRestoration).toBe(true);
      expect(result.restorationType).toBe('damage_based');
      expect(result.criticalInfrastructureDestroyed).toBe(true);
    });

    it('should not qualify with moderate damage (below thresholds)', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace'] },
        { structures: 500, population: 8000, criticalBuildings: ['palace'] }
      );
      expect(result.qualifiesForRestoration).toBe(false);
      expect(result.restorationType).toBe('none');
    });

    it('should calculate correct structure loss percentage', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: [] },
        { structures: 400, population: 10000, criticalBuildings: [] }
      );
      expect(result.structureLossPercentage).toBeCloseTo(0.6);
    });

    it('should calculate correct population loss percentage', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: [] },
        { structures: 1000, population: 5000, criticalBuildings: [] }
      );
      expect(result.populationLossPercentage).toBeCloseTo(0.5);
    });

    it('should not flag critical infrastructure if all remain', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: ['palace', 'fortress'] },
        { structures: 500, population: 5000, criticalBuildings: ['palace', 'fortress'] }
      );
      expect(result.criticalInfrastructureDestroyed).toBe(false);
    });

    it('should trigger on exactly 70% structure loss', () => {
      const result = assessDamageForRestoration(
        { structures: 1000, population: 10000, criticalBuildings: [] },
        { structures: 300, population: 10000, criticalBuildings: [] }
      );
      expect(result.structureLossPercentage).toBeCloseTo(0.7);
      expect(result.qualifiesForRestoration).toBe(true);
    });
  });

  describe('calculateRestorationStatus', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should set 48 hours for damage-based restoration', () => {
      const damageTime = new Date('2025-01-01T00:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      const status = calculateRestorationStatus(damageTime, 'damage_based');
      expect(status.type).toBe('damage_based');
      const expectedEnd = new Date('2025-01-03T00:00:00Z');
      expect(status.endTime.getTime()).toBe(expectedEnd.getTime());
      expect(status.remainingHours).toBe(48);
      vi.useRealTimers();
    });

    it('should set 72 hours for death-based restoration', () => {
      const damageTime = new Date('2025-01-01T00:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      const status = calculateRestorationStatus(damageTime, 'death_based');
      expect(status.type).toBe('death_based');
      const expectedEnd = new Date('2025-01-04T00:00:00Z');
      expect(status.endTime.getTime()).toBe(expectedEnd.getTime());
      expect(status.remainingHours).toBe(72);
      vi.useRealTimers();
    });

    it('should include allowed actions list', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      const status = calculateRestorationStatus(new Date('2025-01-01T00:00:00Z'), 'damage_based');
      expect(status.allowedActions).toContain('building_construction');
      expect(status.allowedActions).toContain('encamp_usage');
      vi.useRealTimers();
    });

    it('should include prohibited actions list', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
      const status = calculateRestorationStatus(new Date('2025-01-01T00:00:00Z'), 'damage_based');
      expect(status.prohibitedActions).toContain('combat_attacks');
      expect(status.prohibitedActions).toContain('sorcery_casting');
      expect(status.prohibitedActions).toContain('espionage_operations');
      vi.useRealTimers();
    });

    it('should show 0 remaining hours when restoration has expired', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-05T00:00:00Z'));
      const damageTime = new Date('2025-01-01T00:00:00Z');
      const status = calculateRestorationStatus(damageTime, 'damage_based');
      expect(status.remainingHours).toBe(0);
      vi.useRealTimers();
    });
  });

  describe('calculateStrategicRestorationValue', () => {
    it('should return 72 hour protection for death-based', () => {
      const value = calculateStrategicRestorationValue('death_based', 'active', 'high');
      expect(value.protectionDuration).toBe(72);
    });

    it('should return 48 hour protection for damage-based', () => {
      const value = calculateStrategicRestorationValue('damage_based', 'active', 'high');
      expect(value.protectionDuration).toBe(48);
    });

    it('should set rebuilding capability to 0.8 for damage-based', () => {
      const value = calculateStrategicRestorationValue('damage_based', 'recovery', 'low');
      expect(value.rebuildingCapability).toBe(0.8);
    });

    it('should set rebuilding capability to 0.6 for death-based', () => {
      const value = calculateStrategicRestorationValue('death_based', 'recovery', 'low');
      expect(value.rebuildingCapability).toBe(0.6);
    });

    it('should have high guild coordination value during active war', () => {
      const active = calculateStrategicRestorationValue('damage_based', 'active', 'low');
      const recovery = calculateStrategicRestorationValue('damage_based', 'recovery', 'low');
      expect(active.guildCoordinationValue).toBeGreaterThan(recovery.guildCoordinationValue);
    });

    it('should have high enemy denial value against high threat', () => {
      const high = calculateStrategicRestorationValue('damage_based', 'recovery', 'high');
      const low = calculateStrategicRestorationValue('damage_based', 'recovery', 'low');
      expect(high.enemyDenialValue).toBeGreaterThan(low.enemyDenialValue);
    });

    it('should calculate total strategic worth as weighted sum', () => {
      const value = calculateStrategicRestorationValue('damage_based', 'active', 'high');
      const expected = (
        value.protectionDuration * 0.3 +
        value.rebuildingCapability * 100 +
        value.guildCoordinationValue * 50 +
        value.enemyDenialValue * 75
      );
      expect(value.totalStrategicWorth).toBeCloseTo(expected);
    });

    it('should have medium guild coordination value during planning', () => {
      const value = calculateStrategicRestorationValue('damage_based', 'planning', 'low');
      expect(value.guildCoordinationValue).toBe(0.7);
    });

    it('should have medium enemy denial value for medium threat', () => {
      const value = calculateStrategicRestorationValue('damage_based', 'recovery', 'medium');
      expect(value.enemyDenialValue).toBe(0.6);
    });
  });

  describe('calculateSorceryKillVsRestorationEfficiency', () => {
    it('should recommend sorcery kill when efficiency exceeds alternative', () => {
      // 72 hours removal / 20 turns = 3.6 efficiency
      // 50 alternative value / 20 turns = 2.5 efficiency
      const result = calculateSorceryKillVsRestorationEfficiency(20, 72, 50);
      expect(result.recommendation).toBe('sorcery_kill');
      expect(result.efficiency).toBe(72 / 20);
    });

    it('should recommend alternative when it exceeds sorcery kill', () => {
      // 48 hours removal / 50 turns = 0.96 efficiency
      // 200 alternative value / 50 turns = 4.0 efficiency
      const result = calculateSorceryKillVsRestorationEfficiency(50, 48, 200);
      expect(result.recommendation).toBe('alternative_target');
    });

    it('should include reasoning for sorcery kill recommendation', () => {
      const result = calculateSorceryKillVsRestorationEfficiency(20, 72, 50);
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.includes('72 hours'))).toBe(true);
    });

    it('should note maximum strategic denial for 72h removal', () => {
      const result = calculateSorceryKillVsRestorationEfficiency(20, 72, 50);
      expect(result.reasoning.some(r => r.includes('maximum strategic denial'))).toBe(true);
    });

    it('should include reasoning for alternative recommendation', () => {
      const result = calculateSorceryKillVsRestorationEfficiency(50, 48, 500);
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some(r => r.includes('immediate value'))).toBe(true);
    });

    it('should calculate efficiency as removal hours / turns invested', () => {
      const result = calculateSorceryKillVsRestorationEfficiency(30, 48, 100);
      expect(result.efficiency).toBe(48 / 30);
    });
  });
});
