import { vi } from 'vitest';

// Mock AWS Amplify client
vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(() => ({
    models: {
      Kingdom: {
        get: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      Territory: {
        get: vi.fn(),
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      Alliance: {
        get: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      ChatMessage: {
        get: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    },
    graphql: vi.fn()
  }))
}));

// Mock @shared/races globally for all tests
vi.mock('@shared/races', () => ({
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

// Mock @shared/mechanics/building-mechanics
vi.mock('@shared/mechanics/building-mechanics', () => ({
  calculateBRT: vi.fn(() => 1),
  getBuildingName: vi.fn((type: string) => type)
}));

// Mock @shared/mechanics/combat-mechanics
vi.mock('@shared/mechanics/combat-mechanics', () => ({
  calculateCombatResult: vi.fn(() => ({
    success: Math.random() > 0.5,
    attackerLosses: { peasants: 10, militia: 5, knights: 2, cavalry: 1 },
    defenderLosses: { peasants: 15, militia: 8, knights: 3, cavalry: 2 }
  })),
  calculateLandGained: vi.fn(() => Math.floor(Math.random() * 50) + 10)
}));

// Mock GameMechanicsAdapter for balance testing
vi.mock('../balance-testing/GameMechanicsAdapter', () => ({
  initializeGameMechanics: vi.fn(async () => ({
    RACES: {
      Human: {
        name: 'Human',
        stats: { warOffense: 3, warDefense: 3, sorcery: 3, scum: 3, forts: 3, tithe: 5, training: 3, siege: 3, economy: 5, building: 3 }
      },
      Elven: {
        name: 'Elven',
        stats: { warOffense: 3, warDefense: 4, sorcery: 4, scum: 3, forts: 3, tithe: 3, training: 3, siege: 3, economy: 3, building: 3 }
      },
      Goblin: {
        name: 'Goblin',
        stats: { warOffense: 4, warDefense: 2, sorcery: 2, scum: 4, forts: 2, tithe: 3, training: 4, siege: 3, economy: 3, building: 3 }
      },
      Droben: {
        name: 'Droben',
        stats: { warOffense: 5, warDefense: 3, sorcery: 2, scum: 3, forts: 4, tithe: 2, training: 4, siege: 4, economy: 2, building: 3 }
      }
    },
    calculateCombatResult: vi.fn(() => ({
      success: Math.random() > 0.5,
      attackerLosses: { peasants: 10, militia: 5, knights: 2, cavalry: 1 },
      defenderLosses: { peasants: 15, militia: 8, knights: 3, cavalry: 2 }
    })),
    calculateLandGained: vi.fn(() => Math.floor(Math.random() * 50) + 10)
  })),
  getGameMechanics: vi.fn(() => ({
    RACES: {
      Human: { name: 'Human', stats: { warOffense: 3, warDefense: 3, sorcery: 3, scum: 3, forts: 3, tithe: 5, training: 3, siege: 3, economy: 5, building: 3 } },
      Elven: { name: 'Elven', stats: { warOffense: 3, warDefense: 4, sorcery: 4, scum: 3, forts: 3, tithe: 3, training: 3, siege: 3, economy: 3, building: 3 } }
    },
    calculateCombatResult: vi.fn(() => ({ success: true, attackerLosses: {}, defenderLosses: {} })),
    calculateLandGained: vi.fn(() => 25)
  }))
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
