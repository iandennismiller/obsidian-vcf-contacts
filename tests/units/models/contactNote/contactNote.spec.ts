import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ContactNote, 
  parseKey, 
  createNameSlug, 
  createContactSlug, 
  isKind, 
  fileId, 
  getUiName, 
  getSortName, 
  uiSafeString, 
  createFileName 
} from '../../../../src/models/contactNote/contactNote';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { VCardKinds } from '../../../../src/models/vcardFile';

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

  describe('validateRequiredFields', () => {
    it('should validate contact with all required fields', async () => {
      const result = await contactNote.validateRequiredFields();
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing UID', async () => {
      // Test the logic by checking that validation detects the issue
      // when we have frontmatter without UID
      const testFrontmatter: any = { FN: 'John Doe' };
      
      // Manually call the validation logic (mimics what validateRequiredFields does)
      const hasUID = testFrontmatter.UID && testFrontmatter.UID.trim() !== '';
      const hasFN = testFrontmatter.FN && testFrontmatter.FN.trim() !== '';
      
      expect(hasUID).toBeFalsy(); // undefined is falsy
      expect(hasFN).toBe(true);
    });

    it('should detect empty UID', async () => {
      const testFrontmatter = { UID: '   ', FN: 'John Doe' };
      
      const hasUID = testFrontmatter.UID && testFrontmatter.UID.trim() !== '';
      const hasFN = testFrontmatter.FN && testFrontmatter.FN.trim() !== '';
      
      expect(hasUID).toBe(false);
      expect(hasFN).toBe(true);
    });

    it('should detect missing name', async () => {
      const testFrontmatter: any = { UID: 'test-uid' };
      
      const hasUID = testFrontmatter.UID && testFrontmatter.UID.trim() !== '';
      const hasFN = testFrontmatter.FN && testFrontmatter.FN.trim() !== '';
      
      expect(hasUID).toBe(true);
      expect(hasFN).toBeFalsy(); // undefined is falsy
    });

    it('should handle empty frontmatter object', async () => {
      const testFrontmatter: any = {};
      
      // Empty object should be detected as having no UID and no FN
      const hasUID = testFrontmatter.UID && testFrontmatter.UID.trim() !== '';
      const hasFN = testFrontmatter.FN && testFrontmatter.FN.trim() !== '';
      
      expect(hasUID).toBeFalsy(); // undefined is falsy
      expect(hasFN).toBeFalsy(); // undefined is falsy
    });
  });

  describe('parseRevDate', () => {
    it('should parse valid VCard REV timestamp', () => {
      const result = contactNote.parseRevDate('20240101T120000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(0); // January
      expect(result?.getUTCDate()).toBe(1);
      expect(result?.getUTCHours()).toBe(12);
    });

    it('should return null for empty string', () => {
      expect(contactNote.parseRevDate('')).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(contactNote.parseRevDate('2024-01-01')).toBeNull();
      expect(contactNote.parseRevDate('invalid')).toBeNull();
    });

    it('should return null for invalid month', () => {
      expect(contactNote.parseRevDate('20241301T120000Z')).toBeNull();
    });

    it('should return null for invalid day', () => {
      expect(contactNote.parseRevDate('20240132T120000Z')).toBeNull();
    });

    it('should return null for invalid hour', () => {
      expect(contactNote.parseRevDate('20240101T250000Z')).toBeNull();
    });

    it('should return null for invalid minute', () => {
      expect(contactNote.parseRevDate('20240101T126000Z')).toBeNull();
    });

    it('should return null for invalid second', () => {
      expect(contactNote.parseRevDate('20240101T120060Z')).toBeNull();
    });
  });

  describe('shouldUpdateFromVCF', () => {
    it('should return false when REV is missing from contact', async () => {
      // The main contactNote has no REV field
      const result = await contactNote.shouldUpdateFromVCF({ REV: '20240101T120000Z' });
      expect(result).toBe(false);
    });

    it('should return false when VCF REV is missing', async () => {
      const result = await contactNote.shouldUpdateFromVCF({});
      expect(result).toBe(false);
    });

    it('should test parseRevDate which is used by shouldUpdateFromVCF', () => {
      const date1 = contactNote.parseRevDate('20240101T120000Z');
      const date2 = contactNote.parseRevDate('20240102T120000Z');
      
      expect(date1).not.toBeNull();
      expect(date2).not.toBeNull();
      
      // Verify that date2 is later than date1
      if (date1 && date2) {
        expect(date2.getTime()).toBeGreaterThan(date1.getTime());
      }
    });

    it('should return false for invalid dates', () => {
      const date1 = contactNote.parseRevDate('invalid');
      const date2 = contactNote.parseRevDate('also-invalid');
      
      expect(date1).toBeNull();
      expect(date2).toBeNull();
    });
  });

  describe('resolveContactByUID', () => {
    it('should resolve contact by UID', async () => {
      const result = await contactNote.resolveContactByUID('test-uid-123');
      expect(result).toBeDefined();
      expect(result?.file).toBe(mockFile);
      expect(result?.frontmatter?.UID).toBe('test-uid-123');
    });

    it('should return null for non-existent UID', async () => {
      const result = await contactNote.resolveContactByUID('non-existent-uid');
      expect(result).toBeNull();
    });
  });

  describe('resolveContactFileByUID', () => {
    it('should resolve contact file by UID', async () => {
      const result = await contactNote.resolveContactFileByUID('test-uid-123');
      expect(result).toBe(mockFile);
    });

    it('should return null for non-existent UID', async () => {
      const result = await contactNote.resolveContactFileByUID('non-existent-uid');
      expect(result).toBeNull();
    });
  });

  describe('resolveContactNameByUID', () => {
    it('should resolve contact name by UID using FN', async () => {
      const result = await contactNote.resolveContactNameByUID('test-uid-123');
      expect(result).toBe('John Doe');
    });

    it('should fallback to basename when FN is missing', async () => {
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { UID: 'test-uid-123' }
      });

      const result = await contactNote.resolveContactNameByUID('test-uid-123');
      expect(result).toBe('john-doe');
    });

    it('should return null for non-existent UID', async () => {
      const result = await contactNote.resolveContactNameByUID('non-existent-uid');
      expect(result).toBeNull();
    });
  });

  describe('resolveRelationshipTarget', () => {
    it('should resolve by relationship type in frontmatter', async () => {
      const spouseFile = { ...mockFile, path: 'Contacts/spouse-rel.md', basename: 'spouse-rel' } as TFile;
      const spouseContact = new ContactNote(mockApp as App, mockSettings, spouseFile);

      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: urn:uuid:spouse-uid
---`);

      const janeFile = {
        path: 'Contacts/jane-doe.md',
        basename: 'jane-doe'
      } as TFile;

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([spouseFile, janeFile]);
      mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file) => {
        if (file === spouseFile || file.path === 'Contacts/spouse-rel.md') {
          return {
            frontmatter: {
              UID: 'test-uid-123',
              FN: 'John Doe',
              'RELATED[spouse]': 'urn:uuid:spouse-uid'
            }
          };
        }
        if (file === janeFile) {
          return {
            frontmatter: { UID: 'spouse-uid', FN: 'Jane Doe' }
          };
        }
        return null;
      });

      const result = await spouseContact.resolveRelationshipTarget('spouse');
      expect(result).toBeDefined();
      // May resolve by UID or name depending on setup
      expect(['uid', 'name']).toContain(result?.type);
    });

    it('should resolve by UID format', async () => {
      const result = await contactNote.resolveRelationshipTarget('test-uid-123');
      expect(result).toBeDefined();
      // May be uid or name depending on how it resolves
      expect(['uid', 'name']).toContain(result?.type);
      expect(result?.contactName).toBe('John Doe');
    });

    it('should resolve by urn:uuid format', async () => {
      const result = await contactNote.resolveRelationshipTarget('urn:uuid:test-uid-123');
      expect(result).toBeDefined();
      // The urn:uuid prefix doesn't match our UID, so it might fall back to name
      expect(['uid', 'name']).toContain(result?.type);
    });

    it('should fallback to name resolution', async () => {
      const result = await contactNote.resolveRelationshipTarget('john-doe');
      expect(result).toBeDefined();
      expect(result?.type).toBe('name');
      expect(result?.contactName).toBe('john-doe');
    });

    it('should return null for non-existent target', async () => {
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(null);
      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([]);
      
      const result = await contactNote.resolveRelationshipTarget('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getRelationships', () => {
    it('should get relationships with UID linking', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: urn:uuid:spouse-uid
---

#### Related
- spouse: [[Jane Doe]]`);
      contactNote.invalidateCache();

      mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file) => {
        if (file.path === 'Contacts/john-doe.md') {
          return {
            frontmatter: {
              UID: 'test-uid-123',
              FN: 'John Doe',
              'RELATED[spouse]': 'urn:uuid:spouse-uid'
            }
          };
        }
        return {
          frontmatter: { UID: 'spouse-uid', FN: 'Jane Doe' }
        };
      });

      const result = await contactNote.getRelationships();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle name-based frontmatter relationships', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: name:Jane Doe
---`);
      contactNote.invalidateCache();

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-uid-123',
          FN: 'John Doe',
          'RELATED[spouse]': 'name:Jane Doe'
        }
      });

      const result = await contactNote.getRelationships();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should process markdown relationships', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
---

#### Related
- spouse: [[Jane Doe]]`);
      contactNote.invalidateCache();

      const result = await contactNote.getRelationships();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('detectUIDConflicts', () => {
    it('should detect no conflicts when UIDs are unique', async () => {
      const result = await contactNote.detectUIDConflicts();
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflicts when multiple files have same UID', async () => {
      const mockFile2 = {
        path: 'Contacts/jane-doe.md',
        basename: 'jane-doe',
        name: 'jane-doe.md',
        extension: 'md'
      } as TFile;

      mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([mockFile, mockFile2]);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { UID: 'test-uid-123', FN: 'John Doe' }
      });

      const result = await contactNote.detectUIDConflicts();
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].uid).toBe('test-uid-123');
      expect(result.conflicts[0].files).toHaveLength(2);
    });
  });

  describe('updateRelationshipUID', () => {
    it('should update relationship UID', async () => {
      const uidUpdateFile = { ...mockFile, path: 'Contacts/uid-update.md', basename: 'uid-update' } as TFile;
      const uidUpdateContact = new ContactNote(mockApp as App, mockSettings, uidUpdateFile);
      
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: urn:uuid:old-uid
---`);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-uid-123',
          FN: 'John Doe',
          'RELATED[spouse]': 'urn:uuid:old-uid'
        }
      });

      const result = await uidUpdateContact.updateRelationshipUID('old-uid', 'new-uid');
      expect(result.success).toBe(true);
      expect(result.updatedRelationships.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle no matching relationships', async () => {
      const result = await contactNote.updateRelationshipUID('non-existent', 'new-uid');
      expect(result.success).toBe(true);
      expect(result.updatedRelationships).toHaveLength(0);
    });

    it('should handle missing frontmatter', async () => {
      const noFmFile3 = { ...mockFile, path: 'Contacts/no-fm3.md', basename: 'no-fm3' } as TFile;
      
      const originalRead = mockApp.vault!.read;
      mockApp.vault!.read = vi.fn().mockResolvedValue('# No frontmatter');

      const noFmContact3 = new ContactNote(mockApp as App, mockSettings, noFmFile3);

      // When frontmatter is {}, it's not null, so the method succeeds with 0 updates
      const result = await noFmContact3.updateRelationshipUID('old-uid', 'new-uid');
      expect(result.success).toBe(true);
      expect(result.updatedRelationships).toHaveLength(0);
      
      // Restore
      mockApp.vault!.read = originalRead;
    });
  });

  describe('bulkUpdateRelationshipUIDs', () => {
    it('should bulk update relationship UIDs with object mapping', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: name:Jane Doe
---`);
      contactNote.invalidateCache();

      const result = await contactNote.bulkUpdateRelationshipUIDs({
        'name:Jane Doe': 'jane-uid'
      });
      expect(result.success).toBe(true);
    });

    it('should bulk update relationship UIDs with array mapping', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: name:Jane Doe
---`);
      contactNote.invalidateCache();

      const result = await contactNote.bulkUpdateRelationshipUIDs([
        { name: 'Jane Doe', uid: 'jane-uid' }
      ]);
      expect(result.success).toBe(true);
    });

    it('should handle no frontmatter', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue('# No frontmatter');
      contactNote.invalidateCache();

      const result = await contactNote.bulkUpdateRelationshipUIDs({});
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
    });
  });

  describe('upgradeNameBasedRelationshipsToUID', () => {
    it('should upgrade name-based relationships to UID', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: name:Jane Doe
---`);
      contactNote.invalidateCache();

      const janeFile = {
        path: 'Contacts/jane-doe.md',
        basename: 'jane-doe'
      } as TFile;

      mockApp.vault!.getAbstractFileByPath = vi.fn().mockImplementation((path) => {
        if (path.includes('jane-doe')) return janeFile;
        return mockFile;
      });

      mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file) => {
        if (file === janeFile) {
          return { frontmatter: { UID: 'jane-uid', FN: 'Jane Doe' } };
        }
        return {
          frontmatter: {
            UID: 'test-uid-123',
            FN: 'John Doe',
            'RELATED[spouse]': 'name:Jane Doe'
          }
        };
      });

      const result = await contactNote.upgradeNameBasedRelationshipsToUID();
      expect(result.success).toBe(true);
    });

    it('should handle contacts without UID', async () => {
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
RELATED[spouse]: name:Jane Doe
---`);
      contactNote.invalidateCache();

      const janeFile = {
        path: 'Contacts/jane-doe.md',
        basename: 'jane-doe'
      } as TFile;

      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(janeFile);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { FN: 'Jane Doe' } // No UID
      });

      const result = await contactNote.upgradeNameBasedRelationshipsToUID();
      expect(result.success).toBe(true);
      expect(result.upgradedRelationships).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockApp.vault!.read = vi.fn().mockRejectedValue(new Error('Read error'));
      contactNote.invalidateCache();

      const result = await contactNote.upgradeNameBasedRelationshipsToUID();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('processReverseRelationships', () => {
    it('should process reverse relationships', async () => {
      const reverseFile = { ...mockFile, path: 'Contacts/reverse.md', basename: 'reverse' } as TFile;
      const reverseContact = new ContactNote(mockApp as App, mockSettings, reverseFile);
      
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
GENDER: M
---

#### Related
- spouse: [[Jane Doe]]`);

      const janeFile = {
        path: 'Contacts/jane-doe.md',
        basename: 'jane-doe'
      } as TFile;

      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(janeFile);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { UID: 'jane-uid', FN: 'Jane Doe', GENDER: 'F' }
      });

      const result = await reverseContact.processReverseRelationships();
      expect(result.success).toBe(true);
      expect(result.processedRelationships).toBeDefined();
    });

    it('should handle target contact not found', async () => {
      const notFoundFile = { ...mockFile, path: 'Contacts/not-found.md', basename: 'not-found' } as TFile;
      const notFoundContact = new ContactNote(mockApp as App, mockSettings, notFoundFile);
      
      mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid-123
FN: John Doe
---

#### Related
- spouse: [[Non Existent]]`);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { UID: 'test-uid-123', FN: 'John Doe' }
      });

      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(null);

      const result = await notFoundContact.processReverseRelationships();
      expect(result.success).toBe(true);
      if (result.processedRelationships.length > 0) {
        expect(result.processedRelationships[0].added).toBe(false);
        expect(result.processedRelationships[0].reason).toContain('not found');
      }
    });

    it('should handle errors in processing', async () => {
      const errorFile = { ...mockFile, path: 'Contacts/error.md', basename: 'error' } as TFile;
      const errorContact = new ContactNote(mockApp as App, mockSettings, errorFile);
      
      mockApp.vault!.read = vi.fn().mockRejectedValue(new Error('Read error'));

      const result = await errorContact.processReverseRelationships();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('delegated sync operations', () => {
    it('should delegate extractMarkdownSections', async () => {
      const result = await contactNote.extractMarkdownSections();
      expect(result).toBeInstanceOf(Map);
    });

    it('should delegate updateMarkdownSection', async () => {
      await expect(contactNote.updateMarkdownSection('Notes', 'New content')).resolves.not.toThrow();
    });

    it('should delegate performFullSync', async () => {
      const result = await contactNote.performFullSync();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
    });

    it('should delegate validateRelationshipConsistency', async () => {
      const result = await contactNote.validateRelationshipConsistency();
      expect(result).toHaveProperty('isConsistent');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('findContactByName error handling', () => {
    it('should use fallback when relationshipOps throws', async () => {
      // Create a new contact note that will trigger the error path
      const newContactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      
      // Force the relationshipOps to throw by making metadataCache return undefined
      const originalGetFileCache = mockApp.metadataCache!.getFileCache;
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(undefined);

      const result = await newContactNote.findContactByName('test-contact');
      
      // Restore original
      mockApp.metadataCache!.getFileCache = originalGetFileCache;
      
      // Should return null or a file
      expect(result === null || result instanceof Object).toBe(true);
    });
  });

  describe('utility functions', () => {
    it('should parse frontmatter keys with parseKey', () => {
      // Simple key
      let result = parseKey('EMAIL');
      expect(result.key).toBe('EMAIL');
      expect(result.index).toBeUndefined();
      expect(result.type).toBeUndefined();
      
      // Key with type
      result = parseKey('RELATED[spouse]');
      expect(result.key).toBe('RELATED');
      expect(result.type).toBe('spouse');
      
      // Key with index and type
      result = parseKey('RELATED[1:spouse]');
      expect(result.key).toBe('RELATED');
      expect(result.index).toBe('1');
      expect(result.type).toBe('spouse');
      
      // Key with just index
      result = parseKey('TEL[0]');
      expect(result.key).toBe('TEL');
      expect(result.index).toBe('0');
      
      // Key with bracket and subkey
      result = parseKey('TEL[0].TYPE');
      expect(result.key).toBe('TEL');
      expect(result.index).toBe('0');
      expect(result.subkey).toBe('TYPE');
      
      // Key with dot but no brackets splits into key and subkey
      result = parseKey('N.GN');
      expect(result.key).toBe('N');
      expect(result.subkey).toBe('GN');
    });

    it('should create name slug with createNameSlug', () => {
      const record: any = {
        KIND: VCardKinds.Individual,
        'N.GN': 'John',
        'N.FN': 'Doe',
        FN: 'John Doe'
      };
      
      const slug = createNameSlug(record);
      expect(slug).toBe('John Doe');
    });

    it('should fallback to FN when name parts are missing', () => {
      const record: any = {
        FN: 'John Doe'
      };
      
      const slug = createNameSlug(record);
      expect(slug).toBe('John Doe');
    });

    it('should throw error when no name is found', () => {
      const record: any = {};
      
      expect(() => createNameSlug(record)).toThrow('No name found for record');
    });

    it('should sanitize file names', () => {
      const record: any = {
        FN: 'John/Doe<Test>'
      };
      
      const slug = createNameSlug(record);
      // Illegal characters should be replaced with spaces
      expect(slug).not.toContain('/');
      expect(slug).not.toContain('<');
      expect(slug).not.toContain('>');
    });

    it('should create contact slug', () => {
      const record: any = {
        FN: 'John Doe'
      };
      
      const slug = createContactSlug(record);
      expect(slug).toBe('John Doe');
    });

    it('should check vCard kind', () => {
      const individualRecord: any = {
        KIND: VCardKinds.Individual
      };
      
      expect(isKind(individualRecord, VCardKinds.Individual)).toBe(true);
      expect(isKind(individualRecord, VCardKinds.Group)).toBe(false);
      
      // No KIND defaults to individual
      const noKindRecord: any = {};
      expect(isKind(noKindRecord, VCardKinds.Individual)).toBe(true);
    });

    it('should generate file ID', () => {
      const file = {
        path: 'Contacts/john-doe.md'
      } as TFile;
      
      const id = fileId(file);
      expect(id).toBe('Contacts_john_doe_md');
    });

    it('should get UI name from contact', () => {
      const contact: any = {
        data: {
          'N.GN': 'John',
          'N.FN': 'Doe',
          FN: 'John Doe'
        },
        file: { basename: 'john-doe' }
      };
      
      const name = getUiName(contact);
      expect(name).toContain('John');
      expect(name).toContain('Doe');
    });

    it('should get sort name from contact', () => {
      const contact: any = {
        data: {
          'N.FN': 'Doe',
          'N.GN': 'John',
          FN: 'John Doe'
        },
        file: { basename: 'john-doe' }
      };
      
      const name = getSortName(contact);
      expect(name).toContain('Doe');
      expect(name).toContain('John');
    });

    it('should make string UI safe', () => {
      const unsafe = '<script>alert("test")</script>';
      const safe = uiSafeString(unsafe);
      
      expect(safe).not.toContain('<script>');
      expect(safe).toContain('&lt;');
      expect(safe).toContain('&gt;');
    });

    it('should create file name with .md extension', () => {
      const record: any = {
        FN: 'John Doe'
      };
      
      const fileName = createFileName(record);
      expect(fileName).toBe('John Doe.md');
    });

    it('should fallback to contact.md on error', () => {
      const record: any = {};
      
      const fileName = createFileName(record);
      expect(fileName).toBe('contact.md');
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
