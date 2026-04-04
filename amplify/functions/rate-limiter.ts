/**
 * Distributed DynamoDB-backed sliding window rate limiter.
 *
 * Each rate limit record is stored in the RateLimit table with:
 *   id = "userId:action"
 *   count = number of requests in the current window
 *   windowStart = epoch ms when the window opened
 *   ttl = epoch seconds for DynamoDB TTL auto-deletion
 *
 * Fails open: if DynamoDB is unreachable, the request is allowed.
 */
import { dbGet, dbCreate, dbUpdate } from './data-client';

interface RateLimitRecord {
  id: string;
  count: number;
  windowStart: number;
  ttl?: number;
}

const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  combat:    { maxRequests: 10, windowMs: 60_000 },
  building:  { maxRequests: 10, windowMs: 60_000 },
  training:  { maxRequests: 10, windowMs: 60_000 },
  spell:     { maxRequests: 8,  windowMs: 60_000 },
  trade:     { maxRequests: 5,  windowMs: 60_000 },
  thievery:  { maxRequests: 5,  windowMs: 60_000 },
  territory: { maxRequests: 5,  windowMs: 60_000 },
  diplomacy: { maxRequests: 10, windowMs: 60_000 },
  faith:     { maxRequests: 5,  windowMs: 60_000 },
  bounty:    { maxRequests: 5,  windowMs: 60_000 },
  alliance:  { maxRequests: 10, windowMs: 60_000 },
  resource:  { maxRequests: 20, windowMs: 60_000 },
  default:   { maxRequests: 20, windowMs: 60_000 },
};

/** No-op for DynamoDB-based limiter. Retained for test compatibility. */
export function resetRateLimits(): void {
  // DynamoDB records expire via TTL — nothing to clear in-memory.
}

/**
 * Check if a request should be rate-limited.
 * Returns null if allowed, or an error object if rate-limited.
 */
export async function checkRateLimit(
  userId: string,
  action: string
): Promise<{ success: false; error: string; errorCode: string } | null> {
  const config = LIMITS[action] ?? LIMITS.default;
  const id = `${userId}:${action}`;
  const now = Date.now();
  const ttl = Math.floor((now + config.windowMs) / 1000);

  try {
    const record = await dbGet<RateLimitRecord>('RateLimit', id);

    if (record && (now - record.windowStart) < config.windowMs) {
      if (record.count >= config.maxRequests) {
        return {
          success: false,
          error: `Rate limit exceeded: max ${config.maxRequests} ${action} actions per minute`,
          errorCode: 'RATE_LIMITED',
        };
      }
      await dbUpdate('RateLimit', id, { count: record.count + 1, ttl });
    } else if (record) {
      await dbUpdate('RateLimit', id, { count: 1, windowStart: now, ttl });
    } else {
      await dbCreate('RateLimit', { id, count: 1, windowStart: now, ttl });
    }
    return null;
  } catch (err) {
    // Fail open — allow the request if DynamoDB is unreachable
    console.warn('[rate-limiter] DynamoDB check failed, allowing request:', err);
    return null;
  }
}
