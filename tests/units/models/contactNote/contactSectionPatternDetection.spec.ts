import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Integration tests for Contact Section to Frontmatter sync with pattern detection
 */
describe('Contact Section Pattern Detection Integration', () => {
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
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      contactSectionTemplate: '',
      contactSectionSyncConfirmation: false
    };
  });

  it('should parse contact section with auto-detected fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

## Contact

john@example.com
555-123-4567
https://johndoe.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();
    
    // Should auto-detect all three fields
    expect(fields.length).toBe(3);
    
    const emailField = fields.find(f => f.fieldType === 'EMAIL');
    expect(emailField).toBeDefined();
    expect(emailField?.value).toBe('john@example.com');
    
    const phoneField = fields.find(f => f.fieldType === 'TEL');
    expect(phoneField).toBeDefined();
    expect(phoneField?.value).toBe('555-123-4567');
    
    const urlField = fields.find(f => f.fieldType === 'URL');
    expect(urlField).toBeDefined();
    expect(urlField?.value).toBe('https://johndoe.com');
  });

  it('should parse contact section with labeled fields', async () => {
    const mockFile = { basename: 'jane-smith', path: 'Contacts/jane-smith.md' } as TFile;
    
    const content = `---
UID: jane-smith-123
FN: Jane Smith
---

## Contact

📧 Email
Home: jane@personal.com
Work: jane@company.com

📞 Phone
Cell: (555) 987-6543

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'jane-smith-123',
        FN: 'Jane Smith'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();
    
    expect(fields.length).toBe(3);
    
    const homeEmail = fields.find(f => f.fieldType === 'EMAIL' && f.fieldLabel === 'Home');
    expect(homeEmail).toBeDefined();
    expect(homeEmail?.value).toBe('jane@personal.com');
    
    const workEmail = fields.find(f => f.fieldType === 'EMAIL' && f.fieldLabel === 'Work');
    expect(workEmail).toBeDefined();
    expect(workEmail?.value).toBe('jane@company.com');
    
    const cellPhone = fields.find(f => f.fieldType === 'TEL' && f.fieldLabel === 'Cell');
    expect(cellPhone).toBeDefined();
    expect(cellPhone?.value).toBe('(555) 987-6543');
  });

  it('should parse contact section with mixed formats', async () => {
    const mockFile = { basename: 'bob-jones', path: 'Contacts/bob-jones.md' } as TFile;
    
    const content = `---
UID: bob-jones-123
FN: Bob Jones
---

## Contact

Email
- Personal: bob@personal.com
- Work bob@work.com

Phone
555-111-2222

Website
www.bobjones.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bob-jones-123',
        FN: 'Bob Jones'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();
    
    // Should parse all fields despite mixed formatting
    expect(fields.length).toBeGreaterThanOrEqual(4);
    
    // Check emails
    const personalEmail = fields.find(f => f.fieldType === 'EMAIL' && f.fieldLabel === 'Personal');
    expect(personalEmail).toBeDefined();
    expect(personalEmail?.value).toBe('bob@personal.com');
    
    // Check phone
    const phoneField = fields.find(f => f.fieldType === 'TEL');
    expect(phoneField).toBeDefined();
    expect(phoneField?.value).toBe('555-111-2222');
    
    // Check URL
    const urlField = fields.find(f => f.fieldType === 'URL');
    expect(urlField).toBeDefined();
  });

  it('should handle international phone numbers', async () => {
    const mockFile = { basename: 'maria-garcia', path: 'Contacts/maria-garcia.md' } as TFile;
    
    const content = `---
UID: maria-garcia-123
FN: Maria Garcia
---

## Contact

Phone
+34 91 123 4567
+86-10-1234-5678

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'maria-garcia-123',
        FN: 'Maria Garcia'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();
    
    // Should detect both international numbers
    const phoneFields = fields.filter(f => f.fieldType === 'TEL');
    expect(phoneFields.length).toBe(2);
    
    expect(phoneFields[0].value).toContain('+34');
    expect(phoneFields[1].value).toContain('+86');
  });

  it('should validate and warn about invalid contact fields', async () => {
    const mockFile = { basename: 'test-contact', path: 'Contacts/test-contact.md' } as TFile;
    
    const content = `---
UID: test-123
FN: Test Contact
---

## Contact

Email
invalid-email

Phone
not-a-phone

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();
    
    // Should still parse but validation should flag issues
    const warnings = contactNote.validateContactFields(fields);
    
    // Should have warnings for invalid formats
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should not duplicate fields when both header and auto-detection match', async () => {
    const mockFile = { basename: 'alice-wonder', path: 'Contacts/alice-wonder.md' } as TFile;
    
    const content = `---
UID: alice-wonder-123
FN: Alice Wonder
---

## Contact

Email
alice@example.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'alice-wonder-123',
        FN: 'Alice Wonder'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();
    
    // Should only have one email field, not duplicated by auto-detection
    const emailFields = fields.filter(f => f.fieldType === 'EMAIL');
    expect(emailFields.length).toBe(1);
    expect(emailFields[0].value).toBe('alice@example.com');
  });
});
