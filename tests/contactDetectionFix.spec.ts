import { describe, it, expect, beforeEach } from 'vitest';
import { TFile } from 'obsidian';
import { ContactUtils } from '../src/relationships/contactUtils';
import { ContactsPluginSettings } from '../src/settings/settings.d';

// Mock TFile implementation
class MockTFile implements Partial<TFile> {
  path: string;
  basename: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop()?.replace('.md', '') || '';
    this.name = path.split('/').pop() || '';
  }
}

// Mock App with vault and metadata cache
class MockApp {
  vault: any;
  metadataCache: any;

  constructor(files: MockTFile[], fileUIDs: Record<string, string> = {}) {
    this.vault = {
      getMarkdownFiles: () => files
    };
    this.metadataCache = {
      getFileCache: (file: TFile) => {
        const uid = fileUIDs[file.path];
        return uid ? { frontmatter: { UID: uid } } : { frontmatter: {} };
      }
    };
  }
}

describe('ContactUtils - Contact Detection Fix', () => {
  let mockFiles: MockTFile[];
  let mockApp: MockApp;

  beforeEach(() => {
    // Set up mock files that simulate a typical Obsidian vault
    mockFiles = [
      new MockTFile('Contacts/John Doe.md'),
      new MockTFile('Contacts/Jane Smith.md'),
      new MockTFile('ContactsExtra/Wrong.md'), // Should NOT match "Contacts" folder
      new MockTFile('Other/Contact.md'),
      new MockTFile('Root.md')
    ];
  });

  describe('folder boundary matching', () => {
    it('should correctly match files in "Contacts" folder without false positives', () => {
      mockApp = new MockApp(mockFiles);
      const settings: ContactsPluginSettings = { contactsFolder: 'Contacts' } as any;
      const contactUtils = new ContactUtils(mockApp as any, settings);

      expect(contactUtils.isContactFile(mockFiles[0])).toBe(true); // Contacts/John Doe.md
      expect(contactUtils.isContactFile(mockFiles[1])).toBe(true); // Contacts/Jane Smith.md
      expect(contactUtils.isContactFile(mockFiles[2])).toBe(false); // ContactsExtra/Wrong.md - FALSE POSITIVE FIXED
      expect(contactUtils.isContactFile(mockFiles[3])).toBe(false); // Other/Contact.md (no UID)
      expect(contactUtils.isContactFile(mockFiles[4])).toBe(false); // Root.md
    });

    it('should handle trailing slash in contactsFolder correctly', () => {
      mockApp = new MockApp(mockFiles);
      const settings: ContactsPluginSettings = { contactsFolder: 'Contacts/' } as any;
      const contactUtils = new ContactUtils(mockApp as any, settings);

      expect(contactUtils.isContactFile(mockFiles[0])).toBe(true); // Contacts/John Doe.md
      expect(contactUtils.isContactFile(mockFiles[1])).toBe(true); // Contacts/Jane Smith.md
      expect(contactUtils.isContactFile(mockFiles[2])).toBe(false); // ContactsExtra/Wrong.md
    });

    it('should handle empty contactsFolder (root vault)', () => {
      mockApp = new MockApp(mockFiles);
      const settings: ContactsPluginSettings = { contactsFolder: '' } as any;
      const contactUtils = new ContactUtils(mockApp as any, settings);

      // When contactsFolder is empty, should use pattern matching for "Contacts/"
      expect(contactUtils.isContactFile(mockFiles[0])).toBe(true); // Contacts/John Doe.md
      expect(contactUtils.isContactFile(mockFiles[1])).toBe(true); // Contacts/Jane Smith.md
      expect(contactUtils.isContactFile(mockFiles[2])).toBe(false); // ContactsExtra/Wrong.md
      expect(contactUtils.isContactFile(mockFiles[3])).toBe(false); // Other/Contact.md (no UID)
      expect(contactUtils.isContactFile(mockFiles[4])).toBe(false); // Root.md
    });
  });

  describe('UID-based matching', () => {
    it('should match files with UIDs regardless of location', () => {
      const fileUIDs = {
        'Other/Contact.md': 'test-uid-123',
        'Root.md': 'another-uid-456'
      };
      mockApp = new MockApp(mockFiles, fileUIDs);
      const settings: ContactsPluginSettings = { contactsFolder: 'Contacts' } as any;
      const contactUtils = new ContactUtils(mockApp as any, settings);

      // Files in Contacts folder should match
      expect(contactUtils.isContactFile(mockFiles[0])).toBe(true); // Contacts/John Doe.md
      expect(contactUtils.isContactFile(mockFiles[1])).toBe(true); // Contacts/Jane Smith.md

      // Files with UIDs should match regardless of location
      expect(contactUtils.isContactFile(mockFiles[3])).toBe(true); // Other/Contact.md (has UID)
      expect(contactUtils.isContactFile(mockFiles[4])).toBe(true); // Root.md (has UID)

      // Files without UIDs outside contacts folder should not match
      expect(contactUtils.isContactFile(mockFiles[2])).toBe(false); // ContactsExtra/Wrong.md
    });
  });

  describe('getAllContactFiles integration', () => {
    it('should find all contact files without false positives', () => {
      const fileUIDs = {
        'Other/Contact.md': 'test-uid-123'
      };
      mockApp = new MockApp(mockFiles, fileUIDs);
      const settings: ContactsPluginSettings = { contactsFolder: 'Contacts' } as any;
      const contactUtils = new ContactUtils(mockApp as any, settings);

      const contactFiles = contactUtils.getAllContactFiles();

      // Should find: Contacts/John Doe.md, Contacts/Jane Smith.md, Other/Contact.md
      expect(contactFiles).toHaveLength(3);
      expect(contactFiles.map(f => f.path)).toContain('Contacts/John Doe.md');
      expect(contactFiles.map(f => f.path)).toContain('Contacts/Jane Smith.md');
      expect(contactFiles.map(f => f.path)).toContain('Other/Contact.md');

      // Should NOT find: ContactsExtra/Wrong.md, Root.md
      expect(contactFiles.map(f => f.path)).not.toContain('ContactsExtra/Wrong.md');
      expect(contactFiles.map(f => f.path)).not.toContain('Root.md');
    });

    it('should handle the exact issue scenario (no UIDs, Contacts folder)', () => {
      // This simulates the exact scenario from the bug report
      mockApp = new MockApp(mockFiles); // No UIDs in any files
      const settings: ContactsPluginSettings = { contactsFolder: 'Contacts' } as any;
      const contactUtils = new ContactUtils(mockApp as any, settings);

      const contactFiles = contactUtils.getAllContactFiles();

      // Should find the 2 files in Contacts folder
      expect(contactFiles).toHaveLength(2);
      expect(contactFiles.map(f => f.path)).toContain('Contacts/John Doe.md');
      expect(contactFiles.map(f => f.path)).toContain('Contacts/Jane Smith.md');

      // Should NOT find ContactsExtra files (this was the original bug)
      expect(contactFiles.map(f => f.path)).not.toContain('ContactsExtra/Wrong.md');
    });
  });
});