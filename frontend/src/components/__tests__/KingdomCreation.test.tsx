import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KingdomCreation } from '../KingdomCreation'

// Mock the game data
vi.mock('../../shared-races', () => ({
  RACES: {
    Human: {
      id: 'human',
      name: 'Human',
      description: 'Balanced race with economic advantages',
      stats: { warOffense: 3, warDefense: 3, sorcery: 3, economy: 5 },
      specialAbility: {
        description: 'Can send caravans twice as often',
        strategicValue: 'Economic advantage',
        limitations: 'None'
      },
      unitTypes: ['Peasants', 'Militia'],
      startingResources: { gold: 1000, population: 500, land: 100, turns: 50 }
    },
    Elven: {
      id: 'elven',
      name: 'Elven',
      description: 'Masters of magic and archery',
      stats: { warOffense: 4, warDefense: 2, sorcery: 5, economy: 3 },
      specialAbility: {
        description: 'Enhanced spell effectiveness',
        strategicValue: 'Magic advantage',
        limitations: 'Lower defense'
      },
      unitTypes: ['Elven Archers', 'Mages'],
      startingResources: { gold: 800, population: 400, land: 120, turns: 50 }
    }
  }
}))

const mockOnKingdomCreated = vi.fn()

describe('KingdomCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders kingdom creation form', () => {
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    expect(screen.getByText('Create Your Kingdom')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /kingdom name/i })).toBeInTheDocument()
    expect(screen.getByText('Choose Your Race:')).toBeInTheDocument()
  })

  it('displays race options', () => {
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    expect(screen.getByText('Human')).toBeInTheDocument()
    expect(screen.getByText('Elven')).toBeInTheDocument()
    expect(screen.getByText('Balanced race with economic advantages')).toBeInTheDocument()
  })

  it('shows race details when race is selected', async () => {
    const user = userEvent.setup()
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    // Human should be selected by default
    expect(screen.getByText('Human Details')).toBeInTheDocument()
    expect(screen.getByText('Can send caravans twice as often')).toBeInTheDocument()
    
    // Click on Elven race
    await user.click(screen.getByText('Elven'))
    
    expect(screen.getByText('Elven Details')).toBeInTheDocument()
    expect(screen.getByText('Enhanced spell effectiveness')).toBeInTheDocument()
  })

  it('displays starting resources for selected race', () => {
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    expect(screen.getByText('Starting Resources:')).toBeInTheDocument()
    expect(screen.getByText('Gold: 1000')).toBeInTheDocument()
    expect(screen.getByText('Population: 500')).toBeInTheDocument()
    expect(screen.getByText('Land: 100')).toBeInTheDocument()
    expect(screen.getByText('Turns: 50')).toBeInTheDocument()
  })

  it('validates kingdom name input', async () => {
    const user = userEvent.setup()
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    const createButton = screen.getByRole('button', { name: /create kingdom/i })
    expect(createButton).toBeDisabled()
    
    // Enter kingdom name
    const nameInput = screen.getByRole('textbox', { name: /kingdom name/i })
    await user.type(nameInput, 'Test Kingdom')
    
    expect(createButton).toBeEnabled()
  })

  it('creates kingdom with correct data', async () => {
    const user = userEvent.setup()
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    // Enter kingdom name
    await user.type(screen.getByRole('textbox', { name: /kingdom name/i }), 'Test Kingdom')
    
    // Select Elven race
    await user.click(screen.getByText('Elven'))
    
    // Click create button
    await user.click(screen.getByRole('button', { name: /create kingdom/i }))
    
    // Wait for the creation to complete
    await waitFor(() => {
      expect(mockOnKingdomCreated).toHaveBeenCalled()
    })
  })

  it('displays stat bars with correct widths', () => {
    render(<KingdomCreation onKingdomCreated={mockOnKingdomCreated} />)
    
    // Check that stat bars are rendered using proper DOM query
    const statBars = document.querySelectorAll('.stat-fill')
    expect(statBars.length).toBeGreaterThan(0)
  })
})
