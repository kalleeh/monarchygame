import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Provide a working localStorage implementation for all tests
const localStorageData: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = String(value); },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
  key: (index: number) => Object.keys(localStorageData)[index] ?? null,
  get length() { return Object.keys(localStorageData).length; }
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Cleanup after each test case
afterEach(() => {
  cleanup();
  localStorageMock.clear();
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
