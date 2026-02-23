/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'resolve-shared-index',
      resolveId(id) {
        if (id.startsWith('@shared/')) {
          const modulePath = id.replace('@shared/', '');
          return path.resolve(__dirname, '../shared', modulePath, 'index.ts');
        }
      }
    }
  ],
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-aws-core': ['aws-amplify'],
          'vendor-aws-ui': ['@aws-amplify/ui-react'],
          'vendor-charts': ['recharts'],
          'vendor-spring': ['@react-spring/web'],
          'vendor-flow': ['@xyflow/react'],
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    alias: {
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
