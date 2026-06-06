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
import { dbGet, dbCreate, dbConditionalUpdate } from './data-client';
import { isConditionalCheckFailed } from './conditional-helpers';

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
  thievery:  { maxRequests: 20, windowMs: 60_000 },
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

  // Retry a few times on lost optimistic-concurrency races (two concurrent
  // requests reading the same count). Each retry re-reads fresh state.
  const MAX_ATTEMPTS = 4;
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const record = await dbGet<RateLimitRecord>('RateLimit', id);

      if (record && (now - record.windowStart) < config.windowMs) {
        if (record.count >= config.maxRequests) {
          return {
            success: false,
            error: `Rate limit exceeded: max ${config.maxRequests} ${action} actions per minute`,
            errorCode: 'RATE_LIMITED',
          };
        }
        // Atomic increment: only succeeds if count is still what we just read.
        // A concurrent request that incremented first will fail this condition,
        // and we loop to re-read (closing the read-modify-write race window).
        try {
          await dbConditionalUpdate('RateLimit', id,
            { count: record.count + 1, ttl },
            '#count = :expectedCount',
            { ':expectedCount': record.count },
            { '#count': 'count' }
          );
          return null;
        } catch (err) {
          if (isConditionalCheckFailed(err)) continue; // lost the race — retry
          throw err;
        }
      } else if (record) {
        // Window expired — reset. Condition on the stale windowStart so a
        // concurrent reset doesn't double-open the window.
        try {
          await dbConditionalUpdate('RateLimit', id,
            { count: 1, windowStart: now, ttl },
            '#windowStart = :expectedStart',
            { ':expectedStart': record.windowStart },
            { '#windowStart': 'windowStart' }
          );
          return null;
        } catch (err) {
          if (isConditionalCheckFailed(err)) continue; // another request reset first — retry
          throw err;
        }
      } else {
        // No record yet — create one. Two concurrent "first" requests can both
        // create count:1 (PutItem overwrites), a tolerable one-off over-count on
        // window open; the atomic increment path guards every subsequent request.
        await dbCreate('RateLimit', { id, count: 1, windowStart: now, ttl });
        return null;
      }
    }
    // Exhausted retries under heavy contention — fail open rather than block a
    // legitimate user. Worst case is a small over-count, not a bypass of the cap.
    return null;
  } catch (err) {
    // Fail open — allow the request if DynamoDB is unreachable
    console.warn('[rate-limiter] DynamoDB check failed, allowing request:', err);
    return null;
  }
}
