/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@game-data': path.resolve(__dirname, '../game-data'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // Add alias configuration for test environment
    alias: {
      '@game-data': path.resolve(__dirname, '../game-data'),
      '@': path.resolve(__dirname, './src'),
    },
    // Clean output for local development
    reporters: process.env.CI ? 'verbose' : 'basic',
    // Suppress React warnings in tests
    onConsoleLog: (log: string) => {
      if (log.includes('act(')) return false;
      return true;
    }
  }
})
