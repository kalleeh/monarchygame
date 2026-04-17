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
        manualChunks(id) {
          // Split shared game mechanics into a lazy-loaded chunk
          if (id.includes('/shared/mechanics/') || id.includes('/shared/combat/') || id.includes('/shared/balance')) {
            return 'shared-mechanics';
          }
          // Vendor chunks
          if (id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/react-router-dom')) return 'vendor-router';
          // Split AWS SDK: auth UI is lazy-loaded, keep auth+core in one chunk
          // to avoid circular-dependency TDZ errors in the bundled output.
          if (id.includes('node_modules/@aws-amplify/ui-react')) return 'vendor-aws-ui';
          if (id.includes('node_modules/aws-amplify/') || id.includes('node_modules/@aws-amplify/')) return 'vendor-aws-core';
          if (id.includes('node_modules/@dnd-kit/')) return 'vendor-dnd';
          if (id.includes('node_modules/react-hot-toast') || id.includes('node_modules/goober')) return 'vendor-toast';
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts', './src/test/setup.ts'],
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
