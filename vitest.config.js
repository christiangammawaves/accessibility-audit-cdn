import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.js', 'components/**/*.js'],
      exclude: ['**/node_modules/**']
    }
  }
});
