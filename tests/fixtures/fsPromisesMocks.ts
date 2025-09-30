/**
 * @fileoverview Reusable mock setup for fs/promises module
 * 
 * This module provides standardized mocking for the Node.js fs/promises module
 * which is commonly used across VCF file operation tests.
 * 
 * @module FsPromisesMocks
 */

import { vi } from 'vitest';

/**
 * Creates a mock fs/promises module configuration
 * This can be used with vi.mock() to mock fs/promises consistently
 * 
 * @example
 * vi.mock('fs/promises', createFsPromisesMock);
 */
export function createFsPromisesMock() {
  return {
    default: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      access: vi.fn()
    },
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn()
  };
}

/**
 * Helper to setup common fs/promises mock behaviors
 * Call this in beforeEach to configure standard responses
 * 
 * @example
 * let fsPromises: any;
 * beforeEach(async () => {
 *   fsPromises = await import('fs/promises');
 *   setupFsPromisesMockBehavior(fsPromises, {
 *     readFileContent: 'BEGIN:VCARD...',
 *     files: ['contact1.vcf', 'contact2.vcf']
 *   });
 * });
 */
export function setupFsPromisesMockBehavior(
  fsPromises: any,
  options: {
    readFileContent?: string;
    readFileError?: Error;
    writeFileError?: Error;
    files?: string[];
    fileStats?: Record<string, any>;
  } = {}
) {
  if (options.readFileContent) {
    vi.mocked(fsPromises.readFile).mockResolvedValue(options.readFileContent);
    if (fsPromises.default?.readFile) {
      vi.mocked(fsPromises.default.readFile).mockResolvedValue(options.readFileContent);
    }
  }

  if (options.readFileError) {
    vi.mocked(fsPromises.readFile).mockRejectedValue(options.readFileError);
    if (fsPromises.default?.readFile) {
      vi.mocked(fsPromises.default.readFile).mockRejectedValue(options.readFileError);
    }
  }

  if (options.writeFileError) {
    vi.mocked(fsPromises.writeFile).mockRejectedValue(options.writeFileError);
    if (fsPromises.default?.writeFile) {
      vi.mocked(fsPromises.default.writeFile).mockRejectedValue(options.writeFileError);
    }
  } else {
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    if (fsPromises.default?.writeFile) {
      vi.mocked(fsPromises.default.writeFile).mockResolvedValue(undefined);
    }
  }

  if (options.files) {
    const dirEntries = options.files.map(name => ({
      name,
      isFile: () => name.endsWith('.vcf') || name.endsWith('.md'),
      isDirectory: () => false
    }));
    vi.mocked(fsPromises.readdir).mockResolvedValue(dirEntries as any);
    if (fsPromises.default?.readdir) {
      vi.mocked(fsPromises.default.readdir).mockResolvedValue(dirEntries as any);
    }
  }

  if (options.fileStats) {
    vi.mocked(fsPromises.stat).mockImplementation(async (path: string) => {
      return options.fileStats![path] || { 
        size: 1000, 
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false
      };
    });
    if (fsPromises.default?.stat) {
      vi.mocked(fsPromises.default.stat).mockImplementation(async (path: string) => {
        return options.fileStats![path] || { 
          size: 1000, 
          mtime: new Date(),
          isFile: () => true,
          isDirectory: () => false
        };
      });
    }
  }

  // access always succeeds by default
  vi.mocked(fsPromises.access).mockResolvedValue(undefined);
  if (fsPromises.default?.access) {
    vi.mocked(fsPromises.default.access).mockResolvedValue(undefined);
  }
}

/**
 * Resets all fs/promises mocks
 * Call this in beforeEach or afterEach to ensure clean state
 * 
 * @example
 * beforeEach(async () => {
 *   const fsPromises = await import('fs/promises');
 *   resetFsPromisesMocks(fsPromises);
 * });
 */
export function resetFsPromisesMocks(fsPromises: any) {
  vi.mocked(fsPromises.readFile).mockReset();
  vi.mocked(fsPromises.writeFile).mockReset();
  
  if (fsPromises.readdir) {
    vi.mocked(fsPromises.readdir).mockReset();
  }
  if (fsPromises.stat) {
    vi.mocked(fsPromises.stat).mockReset();
  }
  if (fsPromises.access) {
    vi.mocked(fsPromises.access).mockReset();
  }

  if (fsPromises.default) {
    if (fsPromises.default.readFile) {
      vi.mocked(fsPromises.default.readFile).mockReset();
    }
    if (fsPromises.default.writeFile) {
      vi.mocked(fsPromises.default.writeFile).mockReset();
    }
    if (fsPromises.default.readdir) {
      vi.mocked(fsPromises.default.readdir).mockReset();
    }
    if (fsPromises.default.stat) {
      vi.mocked(fsPromises.default.stat).mockReset();
    }
    if (fsPromises.default.access) {
      vi.mocked(fsPromises.default.access).mockReset();
    }
  }
}

/**
 * Common VCF file content templates for testing
 */
export const vcfTemplates = {
  /**
   * Basic VCF with minimal required fields
   */
  basic: (uid: string = 'test-uid', fn: string = 'Test Contact') => 
    `BEGIN:VCARD\nVERSION:4.0\nUID:${uid}\nFN:${fn}\nEND:VCARD\n`,

  /**
   * VCF with email
   */
  withEmail: (uid: string = 'test-uid', fn: string = 'Test Contact', email: string = 'test@example.com') =>
    `BEGIN:VCARD\nVERSION:4.0\nUID:${uid}\nFN:${fn}\nEMAIL:${email}\nEND:VCARD\n`,

  /**
   * VCF with phone
   */
  withPhone: (uid: string = 'test-uid', fn: string = 'Test Contact', phone: string = '+1234567890') =>
    `BEGIN:VCARD\nVERSION:4.0\nUID:${uid}\nFN:${fn}\nTEL;TYPE=CELL:${phone}\nEND:VCARD\n`,

  /**
   * VCF with relationships
   */
  withRelationships: (uid: string = 'test-uid', fn: string = 'Test Contact', relations: Array<{type: string, value: string}> = []) => {
    const relatedLines = relations.map(r => `RELATED;TYPE=${r.type}:${r.value}`).join('\n');
    return `BEGIN:VCARD\nVERSION:4.0\nUID:${uid}\nFN:${fn}\n${relatedLines}\nEND:VCARD\n`;
  },

  /**
   * Multiple VCARDs in one file
   */
  multiple: (contacts: Array<{uid: string, fn: string}>) =>
    contacts.map(c => vcfTemplates.basic(c.uid, c.fn)).join('\n'),

  /**
   * Malformed VCF for error testing
   */
  malformed: () => 
    `BEGIN:VCARD\nVERSION:4.0\nBROKEN DATA\n`
};
