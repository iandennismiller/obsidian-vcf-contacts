// vitest.config.ts
import * as path from "node:path";

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, 'tests/setup/emptyObsidianMock.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: [
      // Skip deprecated test files that tested individual utility modules 
      // (functionality now consolidated into ContactNote)
      'tests/relatedListSync.spec.ts',
      'tests/relatedListSyncDemo.spec.ts', 
      'tests/relatedFieldDemo.spec.ts',
      'tests/genderAwareRelationships.spec.ts',
      'tests/completeGenderDemo.spec.ts',
      'tests/relatedFieldUtils.spec.ts',
      'tests/revDemo.spec.ts',
      'tests/frontmatterToRelatedListSync.spec.ts',
      'tests/revisionUtils.spec.ts',
      'tests/genderUtils.spec.ts', 
      'tests/revFieldManagement.spec.ts',
      'tests/contactNoteLifecycle.spec.ts'
    ],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/context/*.ts', 'src/contacts/vcard/**/*.ts', 'src/util/photoLineFromV3toV4.ts'],
      exclude: ['src/**/*.tsx', 'src/**/*.d.ts']
    },
  },
});
