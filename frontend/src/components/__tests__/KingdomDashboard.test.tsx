import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KingdomDashboard } from '../KingdomDashboard'

// Mock the game data
vi.mock('../../../../game-data/races', () => ({
  RACES: {
    Human: {
      name: 'Human',
      specialAbility: 'Can send caravans twice as often',
      stats: { warOffense: 3, warDefense: 3, sorcery: 3, economy: 5 }
    }
  }
}))

const mockKingdom = {
  id: '1',
  name: 'Test Kingdom',
  race: 'Human',
  resources: { gold: 1000, population: 500, land: 100, turns: 50 },
  stats: { warOffense: 3, warDefense: 3, sorcery: 3, economy: 5 }
}

const mockOnBack = vi.fn()

describe('KingdomDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders kingdom dashboard with basic info', () => {
    render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    
    expect(screen.getByText('Test Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Human')).toBeInTheDocument()
    expect(screen.getByText('Resources')).toBeInTheDocument()
  })

  it('displays resource information correctly', () => {
    render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    
    expect(screen.getByText('1000')).toBeInTheDocument() // Gold
    expect(screen.getByText('500')).toBeInTheDocument()  // Population
    expect(screen.getByText('100')).toBeInTheDocument()  // Land
    expect(screen.getByText('50')).toBeInTheDocument()   // Turns
  })

  it('shows race abilities and special ability', () => {
    render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    
    expect(screen.getByText('Race Abilities')).toBeInTheDocument()
    expect(screen.getByText('Can send caravans twice as often')).toBeInTheDocument()
  })

  it('displays action buttons', () => {
    render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    
    expect(screen.getByText('Manage Territories')).toBeInTheDocument()
    expect(screen.getByText('Train Units')).toBeInTheDocument()
    expect(screen.getByText('Cast Spells')).toBeInTheDocument()
  })

  it('handles back navigation', async () => {
    const user = userEvent.setup()
    render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    
    const backButton = screen.getByText('← Back to Kingdoms')
    await user.click(backButton)
    
    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('shows territories section', () => {
    render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    
    expect(screen.getByText(/Territories \(0\)/)).toBeInTheDocument()
    expect(screen.getByText('No territories claimed yet.')).toBeInTheDocument()
  })
})
