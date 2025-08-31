import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App'

// Mock Amplify configuration
vi.mock('../amplify_outputs.json', () => ({
  default: {
    auth: {
      userPoolId: 'test-pool',
      userPoolWebClientId: 'test-client',
      region: 'eu-west-1'
    }
  }
}))

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('🏰 Monarchy Game')).toBeInTheDocument()
  })

  it('shows welcome message for authenticated user', () => {
    render(<App />)
    expect(screen.getByText(/welcome/i)).toBeInTheDocument()
  })

  it('has sign out button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<App />)
    expect(screen.getByText(/loading your kingdoms/i)).toBeInTheDocument()
  })
})
