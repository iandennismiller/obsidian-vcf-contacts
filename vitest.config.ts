// vitest.config.ts
import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
      obsidian: path.resolve(__dirname, 'tests/setup/emptyObsidianMock.ts')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/context/*.ts', 'src/contacts/**/*.ts', 'src/util/photoLineFromV3toV4.ts'],
      exclude: ['src/**/*.tsx', 'src/**/*.d.ts']
    }
  }
});
 