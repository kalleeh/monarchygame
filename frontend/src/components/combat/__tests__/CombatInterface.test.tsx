/**
 * Combat Interface Tests
 * Comprehensive testing for the main combat interface
 */

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CombatInterface } from '../../CombatInterface';
import type { Kingdom } from '../../../types/combat';

const mockKingdom: Kingdom = {
  id: 'test-kingdom',
  name: 'Test Kingdom',
  race: 'Human' as const,
  owner: 'test-user',
  resources: { gold: 10000, population: 1000, land: 100, turns: 50 },
  stats: {
    warOffense: 5, warDefense: 5, sorcery: 3, scum: 2, forts: 4,
    tithe: 6, training: 5, siege: 3, economy: 7, building: 5
  },
  territories: [],
  totalUnits: { peasants: 100, militia: 50, knights: 25, cavalry: 10 },
  isOnline: true,
  lastActive: new Date()
};

describe('CombatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders combat interface', () => {
    render(<CombatInterface currentKingdom={mockKingdom} />);
    expect(screen.getByText('Test Kingdom')).toBeInTheDocument();
  });
});
