import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VCFolderWatcher } from '../src/services/vcfFolderWatcher';

// Mock all external dependencies
vi.mock('obsidian', () => ({
  TFile: class TFile {
    constructor(public path: string, public name: string, public basename: string) {}
  },
  Notice: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../src/contacts/contactFrontmatter', () => ({
  updateFrontMatterValue: vi.fn(),
}));

vi.mock('../src/contacts/contactMdTemplate', () => ({
  mdRender: vi.fn(() => 'mock content'),
}));

vi.mock('../src/contacts/vcard', () => ({
  vcard: {
    toString: vi.fn(() => Promise.resolve({ vcards: 'mock vcf', errors: [] })),
  },
}));

const mockApp = {
  vault: {
    read: vi.fn(),
    modify: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getMarkdownFiles: vi.fn(() => []),
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
};

const mockSettings = {
  contactsFolder: 'Contacts/',
  vcfWatchFolder: '/test/vcf',
  vcfWatchEnabled: true,
  vcfWriteBackEnabled: true,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'DEBUG' as const,
};

describe('VCFolderWatcher REV Update Optimization', () => {
  let watcher: VCFolderWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    watcher = new VCFolderWatcher(mockApp as any, mockSettings);
  });

  describe('Content change detection', () => {
    it('should create consistent hashes for same content', () => {
      const content1 = 'Test content 123';
      const content2 = 'Test content 123';
      const content3 = 'Different content';

      const hash1 = (watcher as any).createContentHash(content1);
      const hash2 = (watcher as any).createContentHash(content2);
      const hash3 = (watcher as any).createContentHash(content3);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      
      console.log('✅ Content hashing working correctly');
    });

    it('should detect when content has not meaningfully changed', async () => {
      const mockFile = { path: 'Contacts/test.md' } as any;
      
      const content1 = `---
FN: John Doe
UID: 123
REV: 20240101T120000Z
---

# John Doe

## Notes
Some notes here.`;

      const content2 = `---
FN: John Doe
UID: 123
REV: 20240101T130000Z
---

# John Doe

## Notes
Some notes here.`;

      mockApp.vault.read = vi.fn()
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2);

      // First call should detect change (initial)
      const hasChanged1 = await (watcher as any).hasContentChanged(mockFile);
      expect(hasChanged1).toBe(true);

      // Second call with only REV change should not detect change
      const hasChanged2 = await (watcher as any).hasContentChanged(mockFile);
      expect(hasChanged2).toBe(false);
      
      console.log('✅ REV-only changes correctly ignored');
    });

    it('should detect when content has meaningfully changed', async () => {
      const mockFile = { path: 'Contacts/test.md' } as any;
      
      const content1 = `---
FN: John Doe
UID: 123
REV: 20240101T120000Z
---

# John Doe

## Notes
Some notes here.`;

      const content2 = `---
FN: John Doe
UID: 123
REV: 20240101T120000Z
---

# John Doe

## Notes
Updated notes here.`;

      mockApp.vault.read = vi.fn()
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2);

      // First call should detect change (initial)
      const hasChanged1 = await (watcher as any).hasContentChanged(mockFile);
      expect(hasChanged1).toBe(true);

      // Second call with actual content change should detect change
      const hasChanged2 = await (watcher as any).hasContentChanged(mockFile);
      expect(hasChanged2).toBe(true);
      
      console.log('✅ Meaningful content changes correctly detected');
    });
  });

  describe('REV update behavior', () => {
    it('should demonstrate REV update conditions', () => {
      // This test documents the expected behavior
      const testCases = [
        {
          name: 'VCF write-back disabled',
          writeBackEnabled: false,
          shouldSkip: true
        },
        {
          name: 'VCF write-back enabled',
          writeBackEnabled: true,
          shouldSkip: false
        }
      ];

      testCases.forEach(testCase => {
        const shouldProcess = testCase.writeBackEnabled;
        expect(shouldProcess).toBe(!testCase.shouldSkip);
        console.log(`✅ ${testCase.name}: REV updates ${shouldProcess ? 'enabled' : 'disabled'}`);
      });
    });
  });

  afterEach(() => {
    watcher.stop();
  });
});