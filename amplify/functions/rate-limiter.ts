/**
 * In-memory sliding window rate limiter for Lambda handlers.
 * Each Lambda instance maintains its own window. At the expected scale
 * (50-200 concurrent players), this prevents individual users from
 * spamming expensive operations within a single instance's lifetime.
 */

interface RateWindow {
  timestamps: number[];
}

const windows = new Map<string, RateWindow>();

const LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  combat:    { maxRequests: 5,  windowMs: 60_000 },   // 5 attacks/min
  building:  { maxRequests: 10, windowMs: 60_000 },   // 10 builds/min
  training:  { maxRequests: 10, windowMs: 60_000 },   // 10 trains/min
  spell:     { maxRequests: 8,  windowMs: 60_000 },   // 8 spells/min
  trade:     { maxRequests: 5,  windowMs: 60_000 },   // 5 trades/min
  thievery:  { maxRequests: 5,  windowMs: 60_000 },   // 5 ops/min
  territory: { maxRequests: 5,  windowMs: 60_000 },   // 5 claims/min
  diplomacy: { maxRequests: 10, windowMs: 60_000 },   // 10 actions/min
  faith:     { maxRequests: 5,  windowMs: 60_000 },   // 5 actions/min
  bounty:    { maxRequests: 5,  windowMs: 60_000 },   // 5 actions/min
  alliance:  { maxRequests: 10, windowMs: 60_000 },   // 10 actions/min
  default:   { maxRequests: 20, windowMs: 60_000 },   // 20 actions/min
};

/** Reset all rate limit windows. Used in tests. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Check if a request should be rate-limited.
 * Returns null if allowed, or an error object if rate-limited.
 */
export function checkRateLimit(
  userId: string,
  action: string
): { success: false; error: string; errorCode: string } | null {
  const config = LIMITS[action] ?? LIMITS.default;
  const key = `${userId}:${action}`;
  const now = Date.now();

  let window = windows.get(key);
  if (!window) {
    window = { timestamps: [] };
    windows.set(key, window);
  }

  // Remove expired timestamps
  window.timestamps = window.timestamps.filter(t => now - t < config.windowMs);

  if (window.timestamps.length >= config.maxRequests) {
    return {
      success: false,
      error: `Rate limit exceeded: max ${config.maxRequests} ${action} actions per minute`,
      errorCode: 'RATE_LIMITED',
    };
  }

  window.timestamps.push(now);
  return null;
}
