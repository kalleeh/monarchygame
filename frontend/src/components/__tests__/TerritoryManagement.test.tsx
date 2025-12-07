import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TerritoryManagement } from '../TerritoryManagement'
import type { Schema } from '../../../../amplify/data/resource'

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

  it('renders territory management interface', () => {
    render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    
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
    render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    
    const claimButton = screen.getByText('+ Claim Territory')
    await user.click(claimButton)
    
    expect(screen.getByText('Claim New Territory')).toBeInTheDocument()
    expect(screen.getByLabelText(/territory name/i)).toBeInTheDocument()
  })

  it('handles form input correctly', async () => {
    const user = userEvent.setup()
    render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    
    await user.click(screen.getByText('+ Claim Territory'))
    
    const nameInput = screen.getByLabelText(/territory name/i)
    await user.type(nameInput, 'New Territory')
    
    expect(nameInput).toHaveValue('New Territory')
  })

  it('handles back navigation', async () => {
    const user = userEvent.setup()
    render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    
    const backButton = screen.getByText('← Back to Dashboard')
    await user.click(backButton)
    
    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('closes form on cancel', async () => {
    const user = userEvent.setup()
    render(<TerritoryManagement kingdom={mockKingdom} onBack={mockOnBack} />)
    
    await user.click(screen.getByText('+ Claim Territory'))
    expect(screen.getByText('Claim New Territory')).toBeInTheDocument()
    
    await user.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Claim New Territory')).not.toBeInTheDocument()
  })
})
