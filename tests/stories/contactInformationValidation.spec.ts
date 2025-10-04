import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 38: Contact Information Validation
 * As a user, I want the plugin to validate contact information when syncing from 
 * the Contact section to frontmatter. The plugin should validate formats and warn 
 * about invalid data without blocking sync.
 */
describe('Contact Information Validation Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(),
        getAbstractFileByPath: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'contacts.vcf',
      vcardWatchFolder: '/test/vcf',
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should validate email format (contains @ and domain)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@example.com
---

#Contact`;

    // Future implementation: Should validate email has @ and domain
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Valid email should pass validation
    // const validation = await contactNote.validateContactField('EMAIL', 'john@example.com');
    // expect(validation.isValid).toBe(true);
  });

  it('should detect invalid email format (missing @)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#Contact`;

    // Future implementation: Should detect missing @ symbol
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Invalid email should fail validation
    // const validation = await contactNote.validateContactField('EMAIL', 'johnexample.com');
    // expect(validation.isValid).toBe(false);
  });

  it('should validate phone number format (contains digits)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL.CELL: +1-555-1234
---

#Contact`;

    // Future implementation: Should validate phone contains digits
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL.CELL': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Valid phone should pass validation
    // const validation = await contactNote.validateContactField('TEL', '+1-555-1234');
    // expect(validation.isValid).toBe(true);
  });

  it('should accept flexible phone number formats', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should accept various phone formats:
    // +1-555-1234, (555) 123-4567, 555.123.4567, etc.
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL.CELL: (555) 123-4567
TEL.HOME: 555.123.4567
TEL.WORK: +1 555 123 4567
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL.CELL': '(555) 123-4567',
        'TEL.HOME': '555.123.4567',
        'TEL.WORK': '+1 555 123 4567'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: All should pass validation
  });

  it('should validate URL format (valid URL scheme)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL.HOME: https://example.com
URL.WORK: http://company.com
---

#Contact`;

    // Future implementation: Should validate http:// or https:// scheme
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL.HOME': 'https://example.com',
        'URL.WORK': 'http://company.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Valid URLs should pass validation
    // const validation1 = await contactNote.validateContactField('URL', 'https://example.com');
    // expect(validation1.isValid).toBe(true);
  });

  it('should detect invalid URL format (missing scheme)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#Contact`;

    // Future implementation: Should detect missing http:// or https://
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Invalid URL should fail validation
    // const validation = await contactNote.validateContactField('URL', 'example.com');
    // expect(validation.isValid).toBe(false);
  });

  it('should validate address has at least one non-empty component', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR.HOME.STREET: 123 Main St
---

#Contact`;

    // Future implementation: Address with any component should be valid
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'ADR.HOME.STREET': '123 Main St'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Valid address should pass validation
  });

  it('should warn about invalid data in console', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should log warnings for invalid data
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Invalid data should generate console warnings
    // Mock console.warn and verify it's called
  });

  it('should continue sync with best-effort parsing despite invalid data', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Sync should continue even with invalid data
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Sync should not fail, just warn
    // const result = await contactNote.syncContactSectionToFrontmatter();
    // expect(result.success).toBe(true);
    // expect(result.warnings).toContain('Invalid email format');
  });

  it('should notify user about validation issues', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should provide user feedback about validation
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Validation issues should be reported to user
  });

  it('should skip seriously malformed data', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Seriously malformed data may be skipped
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Seriously malformed data (e.g., binary content) should be skipped
  });

  it('should validate date formats', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should validate BDAY and other date fields
    
    const content = `---
UID: john-doe-123
FN: John Doe
BDAY: 1990-05-15
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        BDAY: '1990-05-15'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Valid date format should pass validation
    // const validation = await contactNote.validateContactField('BDAY', '1990-05-15');
    // expect(validation.isValid).toBe(true);
  });
});
