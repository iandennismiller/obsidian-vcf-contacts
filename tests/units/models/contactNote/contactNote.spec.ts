import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactNote } from '../../../../src/models/contactNote/contactNote';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';

describe('ContactNote', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockFile: TFile;
  let contactNote: ContactNote;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock file
    mockFile = {
      path: 'Contacts/john-doe.md',
      basename: 'john-doe',
      name: 'john-doe.md',
      extension: 'md',
      parent: { path: 'Contacts' }
    } as TFile;

    // Create mock app
    mockApp = {
      vault: {
        read: vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
GENDER: M
EMAIL: john@example.com
---

## Related

- [[jane-doe|Spouse]]
`),
        modify: vi.fn().mockResolvedValue(undefined),
        getMarkdownFiles: vi.fn().mockReturnValue([mockFile]),
        getAbstractFileByPath: vi.fn().mockReturnValue(mockFile)
      } as any,
      metadataCache: {
        getFileCache: vi.fn().mockReturnValue({
          frontmatter: {
            UID: 'test-uid-123',
            FN: 'John Doe',
            GENDER: 'M',
            EMAIL: 'john@example.com'
          }
        })
      } as any,
      workspace: {
        getActiveFile: vi.fn().mockReturnValue(mockFile)
      } as any
    };

    // Create mock settings
    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };

    contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
  });

  describe('constructor', () => {
    it('should initialize with app, settings, and file', () => {
      expect(contactNote).toBeDefined();
      expect(contactNote.getFile()).toBe(mockFile);
    });
  });

  describe('core file operations', () => {
    it('should get file', () => {
      expect(contactNote.getFile()).toBe(mockFile);
    });

    it('should get UID from frontmatter', async () => {
      const uid = await contactNote.getUID();
      expect(uid).toBe('test-uid-123');
    });

    it('should get display name', () => {
      const displayName = contactNote.getDisplayName();
      expect(displayName).toBe('john-doe');
    });

    it('should get content with caching', async () => {
      const content = await contactNote.getContent();
      expect(content).toContain('UID: test-uid-123');
      expect(content).toContain('John Doe');
      
      // Second call should use cache
      const content2 = await contactNote.getContent();
      expect(content2).toBe(content);
      expect(mockApp.vault!.read).toHaveBeenCalledTimes(1);
    });

    it('should get frontmatter with caching', async () => {
      const frontmatter = await contactNote.getFrontmatter();
      expect(frontmatter).toBeDefined();
      expect(frontmatter?.UID).toBe('test-uid-123');
      expect(frontmatter?.FN).toBe('John Doe');
    });

    it('should invalidate cache', async () => {
      // Get content to populate cache
      await contactNote.getContent();
      expect(mockApp.vault!.read).toHaveBeenCalledTimes(1);

      // Invalidate cache
      contactNote.invalidateCache();

      // Next call should fetch again
      await contactNote.getContent();
      expect(mockApp.vault!.read).toHaveBeenCalledTimes(2);
    });
  });

  describe('gender operations', () => {
    it('should parse gender - male', () => {
      expect(contactNote.parseGender('M')).toBe('M');
      expect(contactNote.parseGender('MALE')).toBe('M');
      expect(contactNote.parseGender('m')).toBe('M');
    });

    it('should parse gender - female', () => {
      expect(contactNote.parseGender('F')).toBe('F');
      expect(contactNote.parseGender('FEMALE')).toBe('F');
      expect(contactNote.parseGender('f')).toBe('F');
    });

    it('should parse gender - non-binary', () => {
      expect(contactNote.parseGender('NB')).toBe('NB');
      expect(contactNote.parseGender('NON-BINARY')).toBe('NB');
      expect(contactNote.parseGender('NONBINARY')).toBe('NB');
    });

    it('should parse gender - unspecified', () => {
      expect(contactNote.parseGender('U')).toBe('U');
      expect(contactNote.parseGender('UNSPECIFIED')).toBe('U');
    });

    it('should return null for empty or invalid gender', () => {
      expect(contactNote.parseGender('')).toBeNull();
      expect(contactNote.parseGender('  ')).toBeNull();
      expect(contactNote.parseGender('INVALID')).toBeNull();
    });

    it('should get gender from frontmatter', async () => {
      const gender = await contactNote.getGender();
      expect(gender).toBe('M');
    });

    it('should update gender in frontmatter', async () => {
      await contactNote.updateGender('F');
      expect(mockApp.vault!.modify).toHaveBeenCalled();
    });
  });

  describe('frontmatter operations', () => {
    it('should update single frontmatter value', async () => {
      await contactNote.updateFrontmatterValue('EMAIL', 'newemail@example.com');
      expect(mockApp.vault!.modify).toHaveBeenCalled();
    });

    it('should update single frontmatter value without REV update', async () => {
      await contactNote.updateFrontmatterValue('EMAIL', 'newemail@example.com', true);
      expect(mockApp.vault!.modify).toHaveBeenCalled();
    });

    it('should update multiple frontmatter values', async () => {
      await contactNote.updateMultipleFrontmatterValues({
        EMAIL: 'newemail@example.com',
        TEL: '555-1234'
      });
      expect(mockApp.vault!.modify).toHaveBeenCalled();
    });

    it('should update multiple frontmatter values without REV update', async () => {
      await contactNote.updateMultipleFrontmatterValues({
        EMAIL: 'newemail@example.com',
        TEL: '555-1234'
      }, true);
      expect(mockApp.vault!.modify).toHaveBeenCalled();
    });
  });

  describe('validation methods', () => {
    it('should validate email addresses', () => {
      expect(contactNote.validateEmail('test@example.com')).toBe(true);
      expect(contactNote.validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(contactNote.validateEmail('invalid-email')).toBe(false);
      // Empty is considered valid in the implementation
      expect(contactNote.validateEmail('')).toBe(true);
    });

    it('should validate phone numbers', () => {
      expect(contactNote.validatePhoneNumber('555-1234')).toBe(true);
      expect(contactNote.validatePhoneNumber('+1 (555) 123-4567')).toBe(true);
      expect(contactNote.validatePhoneNumber('invalid')).toBe(false);
      // Empty is considered valid in the implementation
      expect(contactNote.validatePhoneNumber('')).toBe(true);
    });

    it('should validate dates', () => {
      expect(contactNote.validateDate('2024-01-01')).toBe(true);
      // This format is NOT a valid Date in JavaScript
      expect(contactNote.validateDate('20240101')).toBe(false);
      expect(contactNote.validateDate('invalid-date')).toBe(false);
      // Empty is considered valid in the implementation
      expect(contactNote.validateDate('')).toBe(true);
    });

    it('should sanitize input strings', () => {
      expect(contactNote.sanitizeInput('normal text')).toBe('normal text');
      expect(contactNote.sanitizeInput('<script>alert("xss")</script>')).not.toContain('<script>');
      expect(contactNote.sanitizeInput('')).toBe('');
    });
  });

  describe('cache status', () => {
    it('should get cache status', () => {
      const status = contactNote.getCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });

  describe('REV timestamp generation', () => {
    it('should generate REV timestamp', () => {
      const timestamp = contactNote.generateRevTimestamp();
      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe('string');
      expect(timestamp.length).toBeGreaterThan(0);
      // Should be in format like 20240101T120000Z
      expect(timestamp).toMatch(/^\d{8}T\d{6}Z$/);
    });
  });

  describe('static methods', () => {
    it('should validate UIDs', () => {
      expect(ContactNote.isValidUID('valid-uid-123')).toBe(true);
      expect(ContactNote.isValidUID('another_valid_uid')).toBe(true);
      expect(ContactNote.isValidUID('')).toBe(false);
      expect(ContactNote.isValidUID('   ')).toBe(false);
    });
  });

  describe('relationship type conversions', () => {
    it('should extract relationship type from key', () => {
      expect(contactNote.extractRelationshipType('RELATED[Spouse]')).toBe('Spouse');
      expect(contactNote.extractRelationshipType('RELATED[Parent]')).toBe('Parent');
      expect(contactNote.extractRelationshipType('RELATED')).toBe('related');
      expect(contactNote.extractRelationshipType('NoMatch')).toBe('related');
    });

    it('should convert to genderless relationship type', () => {
      const result = contactNote.convertToGenderlessType('Husband');
      expect(typeof result).toBe('string');
    });

    it('should infer gender from relationship type', () => {
      const gender = contactNote.inferGenderFromRelationship('Husband');
      expect(gender === 'M' || gender === null).toBe(true);
    });

    it('should get gendered relationship term', () => {
      const term = contactNote.getGenderedRelationshipTerm('Spouse', 'M');
      expect(typeof term).toBe('string');
    });
  });

  describe('related value operations', () => {
    it('should format related value', () => {
      const formatted = contactNote.formatRelatedValue('uid-123', 'John Doe');
      expect(formatted).toContain('uid-123');
    });

    it('should parse related value - UID format', () => {
      const parsed = contactNote.parseRelatedValue('urn:uuid:test-uid');
      expect(parsed).toBeDefined();
      expect(parsed?.type).toBe('uuid');
    });

    it('should parse related value - name format', () => {
      const parsed = contactNote.parseRelatedValue('John Doe');
      expect(parsed).toBeDefined();
    });

    it('should return null for invalid related value', () => {
      const parsed = contactNote.parseRelatedValue('');
      expect(parsed).toBeNull();
    });
  });

  describe('findContactByName', () => {
    it('should delegate to relationshipOps', async () => {
      // This tests that the method exists and can be called
      // The actual implementation is tested in relationshipOperations.spec.ts
      const result = await contactNote.findContactByName('test');
      // Result depends on mock setup, we just ensure method works
      expect(result === null || result instanceof Object).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle vault read errors gracefully', async () => {
      mockApp.vault!.read = vi.fn().mockRejectedValue(new Error('Read failed'));

      await expect(contactNote.getContent()).rejects.toThrow();
    });

    it('should handle vault modify errors gracefully', async () => {
      mockApp.vault!.modify = vi.fn().mockRejectedValue(new Error('Modify failed'));

      await expect(contactNote.updateFrontmatterValue('TEST', 'value')).rejects.toThrow();
    });
  });
});
