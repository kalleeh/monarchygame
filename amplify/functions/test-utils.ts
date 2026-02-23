/**
 * Global test setup for Lambda handler tests.
 * Referenced by vitest.config.ts setupFiles.
 */

// Suppress console.error noise in test output
import { vi } from 'vitest';

vi.spyOn(console, 'error').mockImplementation(() => {});
