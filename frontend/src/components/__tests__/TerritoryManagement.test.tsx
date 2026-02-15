import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Schema } from '../../../../amplify/data/resource'

// Mock the generateClient function before importing the component
vi.mock('aws-amplify/data', () => ({
  generateClient: vi.fn(() => ({
    models: {
      Territory: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    }
  }))
}));

import { TerritoryManagement } from '../TerritoryManagement'

const mockKingdom = {
  id: '1',
  name: 'Test Kingdom',
  race: 'Human'
} as Schema['Kingdom']['type']

const mockOnBack = vi.fn()

describe('TerritoryManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders territory management interface', async () => {
    await act(async () => {
      render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    })
    
    expect(screen.getByText('Territory Management')).toBeInTheDocument()
    expect(screen.getByText('+ Claim Territory')).toBeInTheDocument()
  })

  it('shows no territories message when empty', async () => {
    render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    
    await waitFor(() => {
      expect(screen.getByText('No Territories Claimed')).toBeInTheDocument()
    })
  })

  it('opens create territory form', async () => {
    const user = userEvent.setup()
    
    await act(async () => {
      render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    })
    
    const claimButton = screen.getByText('+ Claim Territory')
    
    await act(async () => {
      await user.click(claimButton)
    })
    
    expect(screen.getByText('Claim New Territory')).toBeInTheDocument()
    expect(screen.getByLabelText(/territory name/i)).toBeInTheDocument()
  })

  it('handles form input correctly', async () => {
    const user = userEvent.setup()
    
    await act(async () => {
      render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    await act(async () => {
      await user.click(screen.getByText('+ Claim Territory'))
    })
    
    const nameInput = screen.getByLabelText(/territory name/i)
    
    await act(async () => {
      await user.type(nameInput, 'New Territory')
    })
    
    expect(nameInput).toHaveValue('New Territory')
  })

  it('handles back navigation', async () => {
    const user = userEvent.setup()
    
    await act(async () => {
      render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    })
    
    const backButton = screen.getByText('← Back to Dashboard')
    
    await act(async () => {
      await user.click(backButton)
    })
    
    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('closes form on cancel', async () => {
    const user = userEvent.setup()
    
    await act(async () => {
      render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    })

    await act(async () => {
      await user.click(screen.getByText('+ Claim Territory'))
    })
    
    expect(screen.getByText('Claim New Territory')).toBeInTheDocument()
    
    await act(async () => {
      await user.click(screen.getByText('Cancel'))
    })
    
    expect(screen.queryByText('Claim New Territory')).not.toBeInTheDocument()
  })
})
