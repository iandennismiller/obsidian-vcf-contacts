/**
 * @fileoverview Comprehensive mocking utilities for curator tests
 * 
 * This module provides reusable mock objects and utilities for testing curator processors.
 * It includes mocks for ContactNote, Contact, Obsidian API objects, and common test scenarios.
 * 
 * @module CuratorMocks
 */

import { vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import type { Contact, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from '../../src/models/contactNote/types';
import type { ContactsPluginSettings } from '../../src/settings/settings.d';

/**
 * Creates a mock Contact object for testing
 */
export function createMockContact(overrides: Partial<Contact> = {}): Contact {
  const defaultContact: Contact = {
    data: {
      FN: 'John Doe',
      UID: 'john-doe-123',
      EMAIL: 'john@example.com',
      TEL: '+1234567890'
    },
    file: createMockTFile('John Doe.md')
  };

  return { ...defaultContact, ...overrides };
}

/**
 * Creates a mock TFile object for testing
 */
export function createMockTFile(basename: string = 'Contact.md', path?: string): TFile {
  return {
    basename: basename.replace('.md', ''),
    name: basename,
    path: path || `/Contacts/${basename}`,
    extension: 'md',
    stat: { ctime: Date.now(), mtime: Date.now(), size: 1000 },
    vault: {} as any,
    parent: {} as any
  } as TFile;
}

/**
 * Creates a mock App object with common methods used by curators
 */
export function createMockApp(): Partial<App> {
  return {
    vault: {
      read: vi.fn().mockResolvedValue('---\nFN: John Doe\nUID: john-doe-123\n---\n\n## Related\n- spouse [[Jane Doe]]\n'),
      modify: vi.fn().mockResolvedValue(undefined),
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
          FN: 'John Doe',
          UID: 'john-doe-123',
          EMAIL: 'john@example.com'
        }
      }),
      on: vi.fn(),
      offref: vi.fn()
    } as any,
    workspace: {
      openFile: vi.fn(),
      getLeaf: vi.fn(),
      on: vi.fn(),
      offref: vi.fn()
    } as any
  };
}

/**
 * Creates mock settings for testing
 */
export function createMockSettings(overrides: Partial<ContactsPluginSettings> = {}): ContactsPluginSettings {
  const defaultSettings: ContactsPluginSettings = {
    contactsFolder: 'Contacts',
    defaultHashtag: '',
    vcfWatchFolder: '',
    vcfWatchEnabled: false,
    vcfWatchPollingInterval: 30,
    vcfWriteBackEnabled: false,
    vcfIgnoreFilenames: [],
    vcfIgnoreUIDs: [],
    enableSync: true,
    logLevel: 'INFO',
  };

  return { ...defaultSettings, ...overrides };
}

/**
 * Creates a mock ContactNote with all necessary methods
 */
export function createMockContactNote() {
  return {
    // Data access methods
    getFrontmatter: vi.fn().mockResolvedValue({
      FN: 'John Doe',
      UID: 'john-doe-123',
      EMAIL: 'john@example.com'
    }),
    getGender: vi.fn().mockResolvedValue(null),
    updateGender: vi.fn().mockResolvedValue(undefined),
    updateFrontmatterValue: vi.fn().mockResolvedValue(undefined),
    generateRevTimestamp: vi.fn().mockReturnValue('20240315T120000Z'),

    // Relationship methods
    parseRelatedSection: vi.fn().mockResolvedValue([
      {
        type: 'spouse',
        contactName: 'Jane Doe',
        originalType: 'spouse'
      }
    ] as ParsedRelationship[]),
    parseFrontmatterRelationships: vi.fn().mockResolvedValue([
      {
        key: 'spouse',
        type: 'spouse',
        value: 'Jane Doe',
        parsedValue: { type: 'name', value: 'Jane Doe' }
      }
    ] as FrontmatterRelationship[]),
    resolveContact: vi.fn().mockResolvedValue({
      name: 'Jane Doe',
      uid: 'jane-doe-456',
      file: createMockTFile('Jane Doe.md'),
      gender: 'female'
    } as ResolvedContact),

    // Sync methods
    syncRelatedListToFrontmatter: vi.fn().mockResolvedValue({
      success: true,
      errors: []
    }),
    syncFrontmatterToRelatedList: vi.fn().mockResolvedValue({
      success: true,
      errors: []
    }),

    // Utility methods
    inferGenderFromRelationship: vi.fn().mockImplementation((relationshipType: string) => {
      const genderMap: Record<string, string> = {
        'wife': 'female',
        'husband': 'male',
        'daughter': 'female',
        'son': 'male',
        'mother': 'female',
        'father': 'male',
        'sister': 'female', 
        'brother': 'male'
      };
      return genderMap[relationshipType.toLowerCase()] || null;
    }),
    findContactByName: vi.fn().mockResolvedValue(createMockTFile('Jane Doe.md')),
    
    // File operations
    file: createMockTFile('John Doe.md')
  };
}

/**
 * Creates test data for various relationship scenarios
 */
export const relationshipTestData = {
  // Gender-inferring relationships
  genderRelationships: [
    { type: 'wife', contactName: 'Jane Doe', expectedGender: 'female' },
    { type: 'husband', contactName: 'Bob Smith', expectedGender: 'male' },
    { type: 'daughter', contactName: 'Alice Johnson', expectedGender: 'female' },
    { type: 'son', contactName: 'Charlie Brown', expectedGender: 'male' }
  ],

  // Non-gender-inferring relationships
  neutralRelationships: [
    { type: 'friend', contactName: 'Alex Taylor' },
    { type: 'colleague', contactName: 'Sam Wilson' },
    { type: 'neighbor', contactName: 'Jordan Lee' }
  ],

  // Complex relationships for sync testing
  complexRelationships: [
    { type: 'spouse', contactName: 'Jane Doe', originalType: 'spouse' },
    { type: 'child', contactName: 'Tommy Doe', originalType: 'child' },
    { type: 'parent', contactName: 'Mary Doe', originalType: 'parent' },
    { type: 'sibling', contactName: 'Jim Doe', originalType: 'sibling' }
  ]
};

/**
 * Test frontmatter data for various scenarios
 */
export const frontmatterTestData = {
  // Basic contact with relationships
  withRelationships: {
    FN: 'John Doe',
    UID: 'john-doe-123',
    EMAIL: 'john@example.com',
    'RELATED[SPOUSE]': 'Jane Doe',
    'RELATED[CHILD]': 'Tommy Doe',
    REV: '20240314T120000Z'
  },

  // Contact without relationships  
  withoutRelationships: {
    FN: 'John Doe',
    UID: 'john-doe-123',
    EMAIL: 'john@example.com',
    REV: '20240314T120000Z'
  },

  // Contact with gender
  withGender: {
    FN: 'John Doe',
    UID: 'john-doe-123',
    EMAIL: 'john@example.com',
    GENDER: 'male',
    REV: '20240314T120000Z'
  },

  // Contact without UID (needs UID processor)
  withoutUID: {
    FN: 'John Doe',
    EMAIL: 'john@example.com',
    REV: '20240314T120000Z'
  }
};

/**
 * Creates mock file content for testing
 */
export function createMockFileContent(frontmatter: Record<string, any>, content = ''): string {
  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
  
  return `---\n${frontmatterYaml}\n---\n\n${content}`;
}

/**
 * Error scenarios for testing error handling
 */
export const errorScenarios = {
  vaultReadError: new Error('Failed to read file'),
  vaultWriteError: new Error('Failed to write file'),
  parseError: new Error('Failed to parse frontmatter'),
  resolveContactError: new Error('Failed to resolve contact'),
  syncError: new Error('Failed to sync relationships')
};

/**
 * Utility to setup common mocks for curator tests
 */
export function setupCuratorMocks() {
  const mockApp = createMockApp();
  const mockSettings = createMockSettings();
  const mockContactNote = createMockContactNote();

  return {
    mockApp,
    mockSettings,
    mockContactNote
  };
}

/**
 * Cleanup function for curator tests
 */
export function cleanupCuratorMocks() {
  vi.clearAllMocks();
  vi.resetAllMocks();
}