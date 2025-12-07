import { vi } from 'vitest';

// Mock @game-data/races globally for all tests
vi.mock('@game-data/races', () => ({
  RACES: {
    Human: {
      name: 'Human',
      specialAbility: {
        name: 'Caravan Frequency',
        description: 'Can send caravans twice as often',
        mechanics: { type: 'caravan_frequency' as const }
      },
      stats: { warOffense: 3, warDefense: 3, sorcery: 3, scum: 3, forts: 3, tithe: 5, training: 3, siege: 3, economy: 5, building: 3 }
    },
    Elven: {
      name: 'Elven',
      specialAbility: {
        name: 'Remote Fog',
        description: 'Can cast fog remotely',
        mechanics: { type: 'remote_fog' as const }
      },
      stats: { warOffense: 3, warDefense: 4, sorcery: 4, scum: 3, forts: 3, tithe: 3, training: 3, siege: 3, economy: 3, building: 3 }
    }
  }
}));

// Suppress expected console errors in tests
const originalError = console.error;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = String(args[0]);
    
    // Suppress expected test errors
    if (
      message.includes('Failed to fetch territories') ||
      message.includes('Cannot read properties of undefined (reading \'list\')')
    ) {
      return;
    }
    
    // Keep all other errors
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
