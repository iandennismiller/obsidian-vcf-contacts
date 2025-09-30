/**
 * @fileoverview Reusable mock factories for test fixtures
 * 
 * This module provides factory functions for creating common mock objects
 * used across multiple tests. These factories help reduce code duplication
 * and ensure consistency in test setup.
 * 
 * @module MockFactories
 */

import { vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import type { ContactsPluginSettings } from '../../src/plugin/settings';

/**
 * Factory for creating mock TFile objects
 * 
 * @example
 * const file = createMockTFile('john-doe');
 * const fileWithPath = createMockTFile('john-doe', 'Custom/path/john-doe.md');
 */
export function createMockTFile(
  basename: string = 'Contact',
  path?: string,
  options: Partial<TFile> = {}
): TFile {
  const fileName = basename.endsWith('.md') ? basename : `${basename}.md`;
  const filePath = path || `Contacts/${fileName}`;
  
  return {
    basename: basename.replace('.md', ''),
    name: fileName,
    path: filePath,
    extension: 'md',
    stat: { 
      ctime: Date.now(), 
      mtime: Date.now(), 
      size: 1000 
    },
    vault: {} as any,
    parent: {} as any,
    ...options
  } as TFile;
}

/**
 * Factory for creating multiple mock TFile objects at once
 * 
 * @example
 * const files = createMockTFiles(['john-doe', 'jane-doe', 'bob-smith']);
 */
export function createMockTFiles(basenames: string[], folder = 'Contacts'): TFile[] {
  return basenames.map(basename => 
    createMockTFile(basename, `${folder}/${basename}.md`)
  );
}

/**
 * Factory for creating a mock Obsidian App object with common methods
 * 
 * @example
 * const app = createMockApp();
 * const appWithCustomVault = createMockApp({
 *   vault: { read: vi.fn().mockResolvedValue('custom content') }
 * });
 */
export function createMockApp(overrides: Partial<App> = {}): Partial<App> {
  const defaultApp: Partial<App> = {
    vault: {
      read: vi.fn().mockResolvedValue('---\nUID: test-uid\nFN: Test Contact\n---\n\n#Contact'),
      modify: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({} as TFile),
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      adapter: {
        exists: vi.fn().mockResolvedValue(true),
        read: vi.fn().mockResolvedValue(''),
        write: vi.fn().mockResolvedValue(undefined)
      }
    } as any,
    metadataCache: {
      getFileCache: vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-uid',
          FN: 'Test Contact',
          EMAIL: 'test@example.com'
        }
      }),
      on: vi.fn(),
      offref: vi.fn()
    } as any,
    workspace: {
      openFile: vi.fn(),
      getLeaf: vi.fn().mockReturnValue({
        openFile: vi.fn()
      }),
      on: vi.fn(),
      offref: vi.fn()
    } as any
  };

  // Deep merge overrides
  if (overrides.vault) {
    defaultApp.vault = { ...defaultApp.vault, ...overrides.vault };
  }
  if (overrides.metadataCache) {
    defaultApp.metadataCache = { ...defaultApp.metadataCache, ...overrides.metadataCache };
  }
  if (overrides.workspace) {
    defaultApp.workspace = { ...defaultApp.workspace, ...overrides.workspace };
  }

  return { ...defaultApp, ...overrides };
}

/**
 * Factory for creating mock ContactsPluginSettings
 * 
 * @example
 * const settings = createMockSettings();
 * const customSettings = createMockSettings({ contactsFolder: 'MyContacts' });
 */
export function createMockSettings(
  overrides: Partial<ContactsPluginSettings> = {}
): ContactsPluginSettings {
  const defaultSettings: ContactsPluginSettings = {
    contactsFolder: 'Contacts',
    defaultHashtag: '#Contact',
    vcfStorageMethod: 'single-vcf',
    vcfFilename: 'contacts.vcf',
    vcfWatchFolder: '/test/vcf',
    vcfWatchEnabled: false,
    vcfWatchPollingInterval: 30,
    vcfWriteBackEnabled: false,
    vcfCustomizeIgnoreList: false,
    vcfIgnoreFilenames: [],
    vcfIgnoreUIDs: [],
    enableSync: true,
    logLevel: 'INFO',
  };

  return { ...defaultSettings, ...overrides } as ContactsPluginSettings;
}

/**
 * Creates mock frontmatter data for various test scenarios
 */
export const createMockFrontmatter = {
  /**
   * Basic contact with all required fields
   */
  basic: (overrides: Record<string, any> = {}) => ({
    UID: 'test-uid-123',
    FN: 'John Doe',
    EMAIL: 'john@example.com',
    REV: '20240315T120000Z',
    ...overrides
  }),

  /**
   * Contact with relationships
   */
  withRelationships: (overrides: Record<string, any> = {}) => ({
    UID: 'test-uid-123',
    FN: 'John Doe',
    EMAIL: 'john@example.com',
    'RELATED[spouse]': 'name:Jane Doe',
    'RELATED[child]': 'name:Tommy Doe',
    REV: '20240315T120000Z',
    ...overrides
  }),

  /**
   * Contact with gender
   */
  withGender: (gender: string, overrides: Record<string, any> = {}) => ({
    UID: 'test-uid-123',
    FN: 'John Doe',
    EMAIL: 'john@example.com',
    GENDER: gender,
    REV: '20240315T120000Z',
    ...overrides
  }),

  /**
   * Contact without UID (needs processing)
   */
  withoutUID: (overrides: Record<string, any> = {}) => ({
    FN: 'John Doe',
    EMAIL: 'john@example.com',
    ...overrides
  }),

  /**
   * Contact with phone numbers
   */
  withPhones: (overrides: Record<string, any> = {}) => ({
    UID: 'test-uid-123',
    FN: 'John Doe',
    'TEL[CELL]': '+1234567890',
    'TEL[HOME]': '+0987654321',
    ...overrides
  }),

  /**
   * Contact with address
   */
  withAddress: (overrides: Record<string, any> = {}) => ({
    UID: 'test-uid-123',
    FN: 'John Doe',
    'ADR[HOME].STREET': '123 Main St',
    'ADR[HOME].LOCALITY': 'Springfield',
    'ADR[HOME].POSTAL': '12345',
    'ADR[HOME].COUNTRY': 'USA',
    ...overrides
  })
};

/**
 * Creates mock file content with frontmatter and optional body
 * 
 * @example
 * const content = createMockFileContent({ UID: 'test', FN: 'John' }, '## Notes\nSome notes here');
 */
export function createMockFileContent(
  frontmatter: Record<string, any>,
  body: string = ''
): string {
  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: ${value}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join('\n');
  
  return `---\n${frontmatterYaml}\n---\n\n${body}`;
}

/**
 * Creates a minimal MockTFile class for use in tests that need a class instance
 * 
 * @example
 * const TFileClass = createMockTFileClass();
 * const file = new TFileClass('john-doe', 'Contacts/john-doe.md');
 */
export function createMockTFileClass() {
  return class MockTFile {
    path: string;
    name: string;
    basename: string;
    extension: string = 'md';
    
    constructor(basename: string, path?: string) {
      this.basename = basename.replace(/\.md$/i, '');
      this.name = `${this.basename}.md`;
      this.path = path || `Contacts/${this.name}`;
    }
  };
}

/**
 * Common error objects for testing error scenarios
 */
export const createMockErrors = {
  vaultRead: new Error('Failed to read file'),
  vaultWrite: new Error('Failed to write file'),
  vaultPermission: new Error('Permission denied'),
  fileNotFound: new Error('File not found'),
  metadataParse: new Error('Failed to parse frontmatter'),
  contactResolve: new Error('Failed to resolve contact'),
  syncError: new Error('Failed to sync relationships')
};

/**
 * Setup function that returns commonly used mocks together
 * 
 * @example
 * const { mockApp, mockSettings, mockFile } = setupCommonMocks();
 */
export function setupCommonMocks(options: {
  basename?: string;
  settings?: Partial<ContactsPluginSettings>;
  app?: Partial<App>;
} = {}) {
  const mockApp = createMockApp(options.app);
  const mockSettings = createMockSettings(options.settings);
  const mockFile = createMockTFile(options.basename || 'john-doe');

  return {
    mockApp,
    mockSettings,
    mockFile
  };
}
