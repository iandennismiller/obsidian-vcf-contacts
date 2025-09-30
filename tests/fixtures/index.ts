/**
 * @fileoverview Central export for all test fixtures and utilities
 * 
 * This module provides a single import point for all test fixtures,
 * mock factories, and utilities. Import from this file to access
 * any test helper.
 * 
 * @module Fixtures
 * 
 * @example
 * // Import everything
 * import * as Fixtures from '../fixtures';
 * 
 * // Import specific utilities
 * import { createMockApp, createMockSettings } from '../fixtures';
 * 
 * // Import from specific modules
 * import { vcfTemplates } from '../fixtures/fsPromisesMocks';
 */

// Re-export from mockFactories
export {
  createMockTFile,
  createMockTFiles,
  createMockApp,
  createMockSettings,
  createMockFrontmatter,
  createMockFileContent,
  createMockTFileClass,
  createMockErrors,
  setupCommonMocks
} from './mockFactories';

// Re-export from fsPromisesMocks
export {
  createFsPromisesMock,
  setupFsPromisesMockBehavior,
  resetFsPromisesMocks,
  vcfTemplates
} from './fsPromisesMocks';

// Re-export from obsidianMocks
export {
  createObsidianMock,
  createPluginUtilsMock,
  createContactManagerUtilsMock,
  createVcardFileMock,
  createContactNoteMock,
  createCuratorServiceMock,
  createInsightServiceMock,
  createSharedSettingsContextMock,
  createCommonModuleMocks
} from './obsidianMocks';

// Re-export from testUtils
export {
  wait,
  waitForCondition,
  createSpy,
  withRetry,
  runTestCases,
  deepClone,
  expectToContain,
  createMockVault,
  testDataGenerators,
  mockConsole,
  createTestTimeout
} from './testUtils';

// Re-export existing fixtures
export * from './fixtures';

// Re-export curator mocks (they already exist)
export * from './curatorMocks';
