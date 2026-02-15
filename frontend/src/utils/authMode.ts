/**
 * Auth Mode Utilities — Single source of truth for demo vs. authenticated mode.
 * Every store and service should import from here instead of checking localStorage directly.
 */

const DEMO_MODE_KEY = 'demo-mode';

/** Returns true when the app is running in demo mode (localStorage-based, no Lambda calls). */
export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

/** Returns true when the app is running in authenticated mode (server-authoritative). */
export function isAuthMode(): boolean {
  return !isDemoMode();
}

/** Enable demo mode. */
export function enableDemoMode(): void {
  localStorage.setItem(DEMO_MODE_KEY, 'true');
}

/** Disable demo mode (switch to auth mode). */
export function disableDemoMode(): void {
  localStorage.removeItem(DEMO_MODE_KEY);
}
