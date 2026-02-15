/**
 * Client-side rate limiter to prevent spam-calling Lambda functions.
 * Uses a token bucket algorithm with per-action-type limits.
 */

import { RATE_LIMITS, type RateLimitConfig } from '../constants/gameConfig';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    Object.entries(RATE_LIMITS).forEach(([key, config]) => {
      this.configs.set(key, config);
      this.buckets.set(key, { tokens: config.maxTokens, lastRefill: Date.now() });
    });
  }

  /**
   * Check if an action is allowed and consume a token if so.
   * Returns true if the action can proceed, false if rate limited.
   */
  tryConsume(actionType: string): boolean {
    const config = this.configs.get(actionType);
    if (!config) return true; // No limit configured, allow

    let bucket = this.buckets.get(actionType);
    if (!bucket) {
      bucket = { tokens: config.maxTokens, lastRefill: Date.now() };
      this.buckets.set(actionType, bucket);
    }

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / config.refillInterval) * config.refillRate;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Try to consume a token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get remaining tokens for an action type.
   */
  getRemainingTokens(actionType: string): number {
    const bucket = this.buckets.get(actionType);
    return bucket?.tokens ?? 0;
  }

  /**
   * Get time in ms until next token is available.
   */
  getTimeUntilAvailable(actionType: string): number {
    const config = this.configs.get(actionType);
    const bucket = this.buckets.get(actionType);
    if (!config || !bucket) return 0;

    if (bucket.tokens >= 1) return 0;

    const elapsed = Date.now() - bucket.lastRefill;
    const remaining = config.refillInterval - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Reset rate limiter for an action type.
   */
  reset(actionType: string): void {
    const config = this.configs.get(actionType);
    if (config) {
      this.buckets.set(actionType, { tokens: config.maxTokens, lastRefill: Date.now() });
    }
  }

  /**
   * Reset all rate limiters.
   */
  resetAll(): void {
    this.configs.forEach((config, key) => {
      this.buckets.set(key, { tokens: config.maxTokens, lastRefill: Date.now() });
    });
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

export type { RateLimitConfig };
