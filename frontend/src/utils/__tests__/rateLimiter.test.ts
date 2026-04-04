import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    rateLimiter.resetAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('tryConsume', () => {
    it('allows actions up to max token capacity', () => {
      // combat-processor has maxTokens: 5
      expect(rateLimiter.tryConsume('combat-processor')).toBe(true);
      expect(rateLimiter.tryConsume('combat-processor')).toBe(true);
    });

    it('blocks actions when tokens are exhausted', () => {
      // combat-processor has maxTokens: 5
      for (let i = 0; i < 5; i++) rateLimiter.tryConsume('combat-processor');
      expect(rateLimiter.tryConsume('combat-processor')).toBe(false);
    });

    it('consuming tokens decreases remaining count', () => {
      // building-constructor has maxTokens: 5
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(5);
      rateLimiter.tryConsume('building-constructor');
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(4);
      rateLimiter.tryConsume('building-constructor');
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(3);
    });

    it('allows unknown action types (no limit configured)', () => {
      expect(rateLimiter.tryConsume('unknown-action')).toBe(true);
      expect(rateLimiter.tryConsume('unknown-action')).toBe(true);
      expect(rateLimiter.tryConsume('unknown-action')).toBe(true);
    });

    it('respects different limits per action type', () => {
      // combat-processor: maxTokens 5
      // building-constructor: maxTokens 5
      for (let i = 0; i < 5; i++) {
        rateLimiter.tryConsume('building-constructor');
      }
      expect(rateLimiter.tryConsume('building-constructor')).toBe(false);

      // combat-processor should still have its own tokens
      expect(rateLimiter.tryConsume('combat-processor')).toBe(true);
    });
  });

  describe('token refill', () => {
    it('refills tokens after the configured interval', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // combat-processor: maxTokens 5, refillInterval 3000ms
      for (let i = 0; i < 5; i++) rateLimiter.tryConsume('combat-processor');
      expect(rateLimiter.tryConsume('combat-processor')).toBe(false);

      // Advance time by 3 seconds
      vi.spyOn(Date, 'now').mockReturnValue(now + 3000);

      expect(rateLimiter.tryConsume('combat-processor')).toBe(true);
    });

    it('does not exceed max tokens when refilling', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // building-constructor: maxTokens 5, refillInterval 2000ms
      rateLimiter.tryConsume('building-constructor');

      // Advance time by a large amount (60 seconds)
      vi.spyOn(Date, 'now').mockReturnValue(now + 60000);

      // After refill, tokens should be capped at maxTokens (5), then 1 consumed = 4
      rateLimiter.tryConsume('building-constructor');
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(4);
    });
  });

  describe('getTimeUntilAvailable', () => {
    it('returns 0 when tokens are available', () => {
      expect(rateLimiter.getTimeUntilAvailable('combat-processor')).toBe(0);
    });

    it('returns remaining time when tokens are exhausted', () => {
      const now = 1000000; // Use a fixed epoch to avoid real-clock drift
      vi.spyOn(Date, 'now').mockReturnValue(now);
      rateLimiter.resetAll(); // Reset with mocked time so lastRefill = now

      for (let i = 0; i < 5; i++) rateLimiter.tryConsume('combat-processor');

      // Advance time by 1 second (combat-processor refillInterval is 3000ms)
      vi.spyOn(Date, 'now').mockReturnValue(now + 1000);

      const timeUntil = rateLimiter.getTimeUntilAvailable('combat-processor');
      expect(timeUntil).toBe(2000); // 3000 - 1000 = 2000ms remaining
    });

    it('returns 0 for unknown action types', () => {
      expect(rateLimiter.getTimeUntilAvailable('unknown-action')).toBe(0);
    });
  });

  describe('getRemainingTokens', () => {
    it('returns 0 for unknown action types', () => {
      expect(rateLimiter.getRemainingTokens('unknown-action')).toBe(0);
    });

    it('returns correct initial tokens per action type', () => {
      expect(rateLimiter.getRemainingTokens('combat-processor')).toBe(5);
      expect(rateLimiter.getRemainingTokens('resource-manager')).toBe(3);
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(5);
      expect(rateLimiter.getRemainingTokens('unit-trainer')).toBe(5);
      expect(rateLimiter.getRemainingTokens('spell-caster')).toBe(3);
      expect(rateLimiter.getRemainingTokens('territory-claimer')).toBe(2);
    });
  });

  describe('reset', () => {
    it('restores tokens to max for a specific action type', () => {
      for (let i = 0; i < 5; i++) rateLimiter.tryConsume('combat-processor');
      expect(rateLimiter.getRemainingTokens('combat-processor')).toBe(0);

      rateLimiter.reset('combat-processor');
      expect(rateLimiter.getRemainingTokens('combat-processor')).toBe(5);
    });

    it('does not affect other action types', () => {
      rateLimiter.tryConsume('combat-processor');
      rateLimiter.tryConsume('building-constructor');

      rateLimiter.reset('combat-processor');

      expect(rateLimiter.getRemainingTokens('combat-processor')).toBe(5);
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(4);
    });

    it('does nothing for unknown action types', () => {
      rateLimiter.reset('unknown-action');
      // Should not throw
      expect(rateLimiter.getRemainingTokens('unknown-action')).toBe(0);
    });
  });

  describe('resetAll', () => {
    it('restores all action types to max tokens', () => {
      rateLimiter.tryConsume('combat-processor');
      rateLimiter.tryConsume('building-constructor');
      rateLimiter.tryConsume('unit-trainer');

      rateLimiter.resetAll();

      expect(rateLimiter.getRemainingTokens('combat-processor')).toBe(5);
      expect(rateLimiter.getRemainingTokens('building-constructor')).toBe(5);
      expect(rateLimiter.getRemainingTokens('unit-trainer')).toBe(5);
    });
  });
});
