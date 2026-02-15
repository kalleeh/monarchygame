/**
 * localStorage key constants used throughout the application.
 *
 * Centralising these prevents typo-driven bugs and makes it trivial to
 * rename or namespace keys in the future.
 */

/** Set to 'true' when the player is using demo (unauthenticated) mode */
export const STORAGE_KEY_DEMO_MODE = 'demo-mode';

/** JSON array of demo-mode kingdom objects */
export const STORAGE_KEY_DEMO_KINGDOMS = 'demo-kingdoms';

/** Persisted tutorial / onboarding progress (used by tutorialStore) */
export const STORAGE_KEY_TUTORIAL_PROGRESS = 'tutorial-progress';
