import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock react-router-dom before importing the component
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

// Mock @react-spring/web (used by Tutorial and TurnTimer sub-components)
vi.mock('@react-spring/web', () => ({
  useSpring: () => [{ opacity: 1 }, vi.fn()],
  animated: new Proxy({}, {
    get: (_target: object, prop: string) => {
      return ({ children, ...rest }: Record<string, unknown>) => {
        const Tag = prop as keyof React.JSX.IntrinsicElements
        return <Tag {...rest}>{children as React.ReactNode}</Tag>
      }
    }
  }),
  config: { default: {}, gentle: {}, wobbly: {} }
}))

// Mock heavy sub-components to isolate KingdomDashboard logic
vi.mock('../ui/Tutorial', () => ({
  Tutorial: () => null
}))

vi.mock('../ui/TurnTimer', () => ({
  TurnTimer: () => <div data-testid="turn-timer">TurnTimer</div>
}))

vi.mock('../ui/DemoTimeControl', () => ({
  DemoTimeControl: () => null
}))

// Mock subscription manager so it doesn't try to call AppSync in tests
vi.mock('../../services/subscriptionManager', () => ({
  subscriptionManager: {
    startSubscriptions: vi.fn(),
    stopSubscriptions: vi.fn(),
  }
}))

// Mock services
vi.mock('../../services/amplifyFunctionService', () => ({
  AmplifyFunctionService: {
    updateResources: vi.fn().mockResolvedValue({ success: true, resources: '{}' })
  }
}))

vi.mock('../../services/toastService', () => ({
  ToastService: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    promise: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('../../services/aiActionService', () => ({
  AIActionService: {
    decideActions: vi.fn().mockReturnValue([]),
    executeBuild: vi.fn().mockReturnValue({}),
    executeTrain: vi.fn().mockReturnValue({}),
    executeAttack: vi.fn().mockReturnValue({ attacker: {}, defender: {} })
  }
}))

vi.mock('../../utils/achievementTriggers', () => ({
  achievementTriggers: {
    onGoldChanged: vi.fn(),
    onPopulationChanged: vi.fn(),
    onLandChanged: vi.fn(),
    onBattleWon: vi.fn()
  }
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn()
  }
}))

// Import component (default export) and stores after mocks are set up
import KingdomDashboard from '../KingdomDashboard'
import { useKingdomStore } from '../../stores/kingdomStore'
import { useTerritoryStore } from '../../stores/territoryStore'
import { useAIKingdomStore } from '../../stores/aiKingdomStore'

// Mock kingdom matching Schema['Kingdom']['type'] structure
const mockKingdom = {
  id: '1',
  name: 'Test Kingdom',
  race: 'Human',
  resources: {
    gold: 1000,
    population: 500,
    land: 100,
    turns: 50
  },
  stats: {
    warOffense: 100,
    warDefense: 100,
    sorcery: 50,
    scum: 30,
    forts: 10,
    tithe: 5,
    training: 20,
    siege: 15,
    economy: 80,
    building: 60
  },
  buildings: {},
  totalUnits: {
    peasants: 100,
    militia: 50,
    knights: 20,
    cavalry: 10
  },
  updatedAt: new Date().toISOString()
} as const

const mockOnBack = vi.fn()

describe('KingdomDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset zustand stores to clean state
    useKingdomStore.setState({
      kingdomId: null,
      resources: { gold: 0, population: 0, land: 0, turns: 0 },
      units: []
    })

    useTerritoryStore.setState({
      territories: [],
      ownedTerritories: [],
      selectedTerritory: null,
      availableExpansions: [],
      pendingExpansions: [],
      expansionHistory: [],
      showExpansionDialog: false,
      loading: false,
      error: null,
      initialized: true // Prevent initializeTerritories from populating mock data
    })

    useAIKingdomStore.setState({
      aiKingdoms: []
    })

    // Mark tutorial as completed so the Tutorial overlay does not render
    localStorage.setItem('tutorial-kingdom-dashboard', 'completed')

    // Ensure demo mode is off to prevent AI kingdom generation side effects
    localStorage.removeItem('demo-mode')
  })

  it('renders kingdom dashboard with basic info', async () => {
    await act(async () => {
      render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    expect(screen.getByText('Test Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Human')).toBeInTheDocument()
    expect(screen.getByText('Resources')).toBeInTheDocument()
  })

  it('displays resource information correctly', async () => {
    await act(async () => {
      render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument()  // Gold
      expect(screen.getByText('500')).toBeInTheDocument()   // Population
      expect(screen.getByText('100')).toBeInTheDocument()   // Land
      expect(screen.getByText('50')).toBeInTheDocument()    // Turns
    })
  })

  it('shows race abilities and special ability', async () => {
    await act(async () => {
      render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    expect(screen.getByText('Race Abilities')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Special:')).toBeInTheDocument()
    })
  })

  it('displays action buttons', async () => {
    await act(async () => {
      render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    expect(screen.getByText('Manage Territories')).toBeInTheDocument()
    expect(screen.getByText(/Summon Units/)).toBeInTheDocument()
    expect(screen.getByText('Cast Spells')).toBeInTheDocument()
  })

  it('handles back navigation', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    const backButton = screen.getByText('← Back to Kingdoms')
    await user.click(backButton)

    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('shows territories section', async () => {
    await act(async () => {
      render(<KingdomDashboard kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    await waitFor(() => {
      expect(screen.getByText(/Territories \(0\)/)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('No territories claimed yet.')).toBeInTheDocument()
    })
  })
})
