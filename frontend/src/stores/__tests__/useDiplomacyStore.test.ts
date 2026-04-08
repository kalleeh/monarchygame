import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../utils/authMode', () => ({ isDemoMode: vi.fn(() => true) }));
vi.mock('../../stores/kingdomStore', () => ({
  useKingdomStore: { getState: vi.fn(() => ({ kingdomId: 'kingdom-1' })) }
}));

import { useDiplomacyStore } from '../useDiplomacyStore';

describe('useDiplomacyStore atomic updates', () => {
  beforeEach(() => {
    useDiplomacyStore.setState({
      reputation: 100,
      relationships: [],
      activeProposals: [],
      diplomaticHistory: [],
      availableKingdoms: [],
      loading: false,
      error: null,
    });
  });

  it('declareWar atomically updates relationship and reputation', async () => {
    useDiplomacyStore.setState({
      relationships: [{
        id: 'r1',
        fromKingdom: { id: 'k1', name: 'A' },
        toKingdom: { id: 'target-1', name: 'B' },
        status: 'NEUTRAL',
        treaties: [],
        reputation: 0,
        lastAction: new Date(),
      }] as unknown[],
      reputation: 100,
    });
    await useDiplomacyStore.getState().declareWar('target-1');
    const state = useDiplomacyStore.getState();
    expect(state.relationships[0].status).toBe('WAR');
    expect(state.reputation).toBe(80);
    expect(state.loading).toBe(false);
  });

  it('applyIncomingWarDeclaration updates matching relationship to WAR', () => {
    useDiplomacyStore.setState({
      relationships: [{
        id: 'r1',
        fromKingdom: { id: 'attacker-99', name: 'Enemy' },
        toKingdom: { id: 'me', name: 'Me' },
        status: 'NEUTRAL',
        treaties: [],
        reputation: 0,
        lastAction: new Date(),
      }] as unknown[],
    });
    useDiplomacyStore.getState().applyIncomingWarDeclaration('attacker-99');
    expect(useDiplomacyStore.getState().relationships[0].status).toBe('WAR');
  });
});
