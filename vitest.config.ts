import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths()
  ],
  test: {
    projects: [
      {
        test: {
          name: 'Node.js',
          environment: 'node',
          setupFiles: [
            './config/vitest.node.setup.ts',
            './config/vitest.setup.ts'
          ],
          include: [
            '**/*.test.{js,ts}',     // Universal tests run here
            '**/*.node.test.{js,ts}' // Node-specific tests
          ],
          exclude: [
            '**/node_modules/**',
            '**/build/**',
            '**/*.jsdom.test.{js,ts}'  // Exclude jsdom-specific tests
          ],
          // Disable timeout when debugging
          testTimeout: process.env.NODE_ENV === 'debug' ? 0 : 5000,
        }
      },
      {
        test: {
          name: 'Browser',
          environment: 'jsdom',
          setupFiles: [
            './config/vitest.jsdom.setup.ts',
            './config/vitest.setup.ts'
          ],
          include: [
            '**/*.test.{js,ts}',     // Universal tests run here
            '**/*.jsdom.test.{js,ts}' // Node-specific tests
          ],
          exclude: [
            '**/node_modules/**',
            '**/build/**',
            '**/*.node.test.{js,ts}'  // Exclude web-specific tests
          ],
          // Disable timeout when debugging
          testTimeout: process.env.NODE_ENV === 'debug' ? 0 : 5000,
          // Coverage configuration
        }
      }
    ],
    coverage: {
      provider: 'v8', // Example global coverage setting
    }
  }
})