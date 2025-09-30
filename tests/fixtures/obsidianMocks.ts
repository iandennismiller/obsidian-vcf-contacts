/**
 * @fileoverview Standardized Obsidian API mocks for vi.mock()
 * 
 * This module provides consistent mock configurations for the Obsidian API
 * that can be used at the module level with vi.mock().
 * 
 * @module ObsidianMocks
 */

import { vi } from 'vitest';

/**
 * Standard mock configuration for the 'obsidian' module
 * Use this with vi.mock() at the module level
 * 
 * @example
 * vi.mock('obsidian', createObsidianMock);
 * 
 * Or with customization:
 * vi.mock('obsidian', () => createObsidianMock({ 
 *   Notice: vi.fn().mockImplementation((msg) => console.log(msg))
 * }));
 */
export function createObsidianMock(overrides: Record<string, any> = {}) {
  return {
    Notice: vi.fn(),
    Modal: vi.fn().mockImplementation(function(this: any, app: any) {
      this.app = app;
      this.open = vi.fn();
      this.close = vi.fn();
    }),
    TFile: vi.fn(),
    TFolder: vi.fn(),
    normalizePath: vi.fn((path: string) => path),
    Platform: { 
      isMobileApp: false, 
      isAndroidApp: false,
      isDesktopApp: true 
    },
    stringifyYaml: vi.fn((obj: any) => 
      Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n')
    ),
    parseYaml: vi.fn((str: string) => {
      const lines = str.split('\n');
      const result: Record<string, any> = {};
      lines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          result[key.trim()] = valueParts.join(':').trim();
        }
      });
      return result;
    }),
    ...overrides
  };
}

/**
 * Mock configuration for common plugin utilities
 */
export function createPluginUtilsMock() {
  return {
    FileExistsModal: vi.fn().mockImplementation((app, filePath, callback) => ({
      open: vi.fn().mockImplementation(() => {
        // Auto-resolve with "skip" action for testing
        setTimeout(() => callback("skip"), 0);
      })
    }))
  };
}

/**
 * Mock configuration for ContactManagerUtils
 * This is commonly mocked across many tests
 * 
 * @example
 * vi.mock('path/to/contactManagerUtils', createContactManagerUtilsMock);
 */
export function createContactManagerUtilsMock(overrides: Record<string, any> = {}) {
  return {
    ContactManagerUtils: {
      ensureHasName: vi.fn().mockResolvedValue({
        FN: 'New Contact',
        UID: 'new-contact-uid',
        VERSION: '4.0'
      }),
      createContactFile: vi.fn(),
      openCreatedFile: vi.fn(),
      getFrontmatterFromFiles: vi.fn(),
      ...overrides
    }
  };
}

/**
 * Mock configuration for VcardFile module
 */
export function createVcardFileMock(overrides: Record<string, any> = {}) {
  return {
    VcardFile: vi.fn().mockImplementation(() => ({
      async *parse() {
        yield { UID: 'test-123', FN: 'Test Contact' };
      },
      ...overrides
    }))
  };
}

/**
 * Mock configuration for ContactNote module
 */
export function createContactNoteMock(overrides: Record<string, any> = {}) {
  return {
    ContactNote: vi.fn().mockImplementation(() => ({
      getFrontmatter: vi.fn().mockResolvedValue({
        UID: 'test-uid',
        FN: 'Test Contact'
      }),
      syncFrontmatterToRelatedList: vi.fn().mockResolvedValue({
        success: true,
        errors: []
      }),
      syncRelatedListToFrontmatter: vi.fn().mockResolvedValue({
        success: true,
        errors: []
      }),
      updateFrontmatterValue: vi.fn().mockResolvedValue(undefined),
      parseRelatedSection: vi.fn().mockResolvedValue([]),
      parseFrontmatterRelationships: vi.fn().mockResolvedValue([]),
      ...overrides
    }))
  };
}

/**
 * Mock configuration for curator services
 */
export function createCuratorServiceMock() {
  return {
    curatorService: {
      process: vi.fn().mockResolvedValue([])
    }
  };
}

/**
 * Mock configuration for insight services
 */
export function createInsightServiceMock() {
  return {
    insightService: {
      process: vi.fn().mockResolvedValue(undefined)
    }
  };
}

/**
 * Mock configuration for shared settings context
 */
export function createSharedSettingsContextMock(settings: Record<string, any> = {}) {
  return {
    getSettings: vi.fn(() => ({
      vcardSyncPostProcessor: true,
      contactsFolder: 'Contacts',
      ...settings
    })),
    updateSettings: vi.fn(),
    setSettings: vi.fn()
  };
}

/**
 * Creates a complete set of commonly used module mocks
 * Returns an object with mock factory functions
 * 
 * @example
 * const mocks = createCommonModuleMocks();
 * vi.mock('obsidian', mocks.obsidian);
 * vi.mock('path/to/contactManagerUtils', mocks.contactManagerUtils);
 */
export function createCommonModuleMocks() {
  return {
    obsidian: () => createObsidianMock(),
    contactManagerUtils: () => createContactManagerUtilsMock(),
    vcardFile: () => createVcardFileMock(),
    contactNote: () => createContactNoteMock(),
    curatorService: () => createCuratorServiceMock(),
    insightService: () => createInsightServiceMock(),
    pluginUtils: () => createPluginUtilsMock(),
    sharedSettingsContext: (settings?: Record<string, any>) => 
      createSharedSettingsContextMock(settings)
  };
}
