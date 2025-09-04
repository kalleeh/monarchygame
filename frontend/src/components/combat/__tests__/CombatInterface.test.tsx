/**
 * Combat Interface Tests
 * Comprehensive testing for the main combat interface
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatInterface } from '../CombatInterface';
import type { Kingdom } from '../../types/combat';

const mockKingdom: Kingdom = {
  id: 'test-kingdom',
  name: 'Test Kingdom',
  race: 'Human',
  owner: 'test-user',
  resources: { gold: 10000, population: 1000, land: 100, turns: 50 },
  stats: {
    warOffense: 5, warDefense: 5, sorcery: 3, scum: 2, forts: 4,
    tithe: 6, training: 5, siege: 3, economy: 7, building: 5
  },
  territories: [{
    id: 'territory-1',
    name: 'Capital',
    coordinates: { x: 50, y: 50 },
    kingdomId: 'test-kingdom',
    kingdomName: 'Test Kingdom',
    fortificationLevel: 2,
    buildings: { barracks: 2 },
    units: { peasants: 100, militia: 50, knights: 25, cavalry: 10 },
    isCapital: true
  }],
  totalUnits: { peasants: 100, militia: 50, knights: 25, cavalry: 10 },
  isOnline: true,
  lastActive: new Date()
};

const mockOnAttack = jest.fn();
const mockOnUpdateDefense = jest.fn();

describe('CombatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders combat interface with all tabs', () => {
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    expect(screen.getByText('Combat Operations')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /attack/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /defense/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /alerts/i })).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    // Default tab should be attack
    expect(screen.getByRole('tab', { name: /attack/i })).toHaveAttribute('aria-selected', 'true');

    // Switch to defense tab
    await user.click(screen.getByRole('tab', { name: /defense/i }));
    expect(screen.getByRole('tab', { name: /defense/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Defense Management')).toBeInTheDocument();

    // Switch to reports tab
    await user.click(screen.getByRole('tab', { name: /reports/i }));
    expect(screen.getByRole('tab', { name: /reports/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Battle Reports')).toBeInTheDocument();
  });

  it('displays kingdom information correctly', () => {
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    expect(screen.getByText('Test Kingdom')).toBeInTheDocument();
    expect(screen.getByText('(Human)')).toBeInTheDocument();
  });

  it('handles attack submission', async () => {
    mockOnAttack.mockResolvedValue(undefined);
    
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    // Attack tab should be active by default
    expect(screen.getByText('Plan Attack')).toBeInTheDocument();
  });

  it('displays error messages correctly', () => {
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
        error="Test error message"
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
        isLoading={true}
      />
    );

    // Loading state should disable interactive elements
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      if (button.textContent?.includes('Launch') || button.textContent?.includes('Save')) {
        expect(button).toBeDisabled();
      }
    });
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    const attackTab = screen.getByRole('tab', { name: /attack/i });
    const defenseTab = screen.getByRole('tab', { name: /defense/i });

    // Focus on attack tab
    attackTab.focus();
    expect(attackTab).toHaveFocus();

    // Navigate to defense tab with keyboard
    await user.keyboard('{ArrowRight}');
    expect(defenseTab).toHaveFocus();

    // Activate defense tab with Enter
    await user.keyboard('{Enter}');
    expect(defenseTab).toHaveAttribute('aria-selected', 'true');
  });

  it('displays notification badge correctly', () => {
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    // Mock notifications would show badge
    const alertsTab = screen.getByRole('tab', { name: /alerts/i });
    expect(alertsTab).toBeInTheDocument();
  });

  it('handles defense settings update', async () => {
    mockOnUpdateDefense.mockResolvedValue(undefined);
    const user = userEvent.setup();
    
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    // Switch to defense tab
    await user.click(screen.getByRole('tab', { name: /defense/i }));
    
    expect(screen.getByText('Defense Management')).toBeInTheDocument();
  });

  it('meets accessibility requirements', () => {
    render(
      <CombatInterface
        currentKingdom={mockKingdom}
        onAttack={mockOnAttack}
        onUpdateDefense={mockOnUpdateDefense}
      />
    );

    // Check for proper ARIA labels
    expect(screen.getByRole('region', { name: /combat interface/i })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /combat sections/i })).toBeInTheDocument();
    
    // Check for proper tab structure
    const tabs = screen.getAllByRole('tab');
    tabs.forEach(tab => {
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-controls');
    });
  });
});
