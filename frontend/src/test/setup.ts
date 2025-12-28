import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test case
afterEach(() => {
  cleanup()
})

// Mock AWS Amplify for tests
vi.mock('aws-amplify/data', () => ({
  generateClient: () => ({
    models: {
      Kingdom: {
        create: vi.fn().mockResolvedValue({ data: { id: '1', name: 'Test Kingdom' } }),
        list: vi.fn().mockResolvedValue({ data: [] }),
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  }),
}))

vi.mock('@aws-amplify/ui-react', () => ({
  Authenticator: ({ children }: { children: (props: { signOut: () => void; user: { attributes: { email: string } } }) => React.ReactNode }) => children({ 
    signOut: vi.fn(), 
    user: { attributes: { email: 'test@example.com' } } 
  }),
  useAuthenticator: () => ({ user: { attributes: { email: 'test@example.com' } } }),
}))

vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
  },
}))
