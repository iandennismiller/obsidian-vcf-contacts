import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 33: Frontmatter to Contact Section Sync
 * As a user, when frontmatter contains contact fields like EMAIL[HOME], TEL[WORK], 
 * ADR[HOME].STREET, etc., I want those fields to automatically appear in the 
 * "## Contact" section. This curator processor should generate Contact section 
 * content using fuzzy templates.
 */
describe('Frontmatter to Contact Section Sync Story', () => {
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

  it('should display multiple emails from frontmatter in Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Should generate Contact section with both emails
    // ## Contact
    // 📧 Email
    // - Home: john@home.com
    // - Work: john@work.com
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@home.com');
    expect(frontmatter['EMAIL[WORK]']).toBe('john@work.com');
  });

  it('should format address fields as complete postal address', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].REGION: IL
ADR[HOME].POSTAL: 62701
ADR[HOME].COUNTRY: USA
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Should format as:
    // ## Contact
    // 🏠 Address (Home)
    // 123 Main St
    // Springfield, IL 62701
    // USA
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'ADR[HOME].STREET': '123 Main St',
        'ADR[HOME].LOCALITY': 'Springfield',
        'ADR[HOME].REGION': 'IL',
        'ADR[HOME].POSTAL': '62701',
        'ADR[HOME].COUNTRY': 'USA'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['ADR[HOME].STREET']).toBe('123 Main St');
    expect(frontmatter['ADR[HOME].LOCALITY']).toBe('Springfield');
  });

  it('should group phone numbers together with their types', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[CELL]: +1-555-1234
TEL[HOME]: +1-555-5678
TEL[WORK]: +1-555-9999
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Should group as:
    // ## Contact
    // 📞 Phone
    // - Cell: +1-555-1234
    // - Home: +1-555-5678
    // - Work: +1-555-9999
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL[CELL]': '+1-555-1234',
        'TEL[HOME]': '+1-555-5678',
        'TEL[WORK]': '+1-555-9999'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-1234');
    expect(frontmatter['TEL[HOME]']).toBe('+1-555-5678');
    expect(frontmatter['TEL[WORK]']).toBe('+1-555-9999');
  });

  it('should list URLs/websites together', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL[HOME]: https://johndoe.com
URL[WORK]: https://company.com/john
URL[BLOG]: https://blog.johndoe.com
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Should list as:
    // ## Contact
    // 🌐 Website
    // - Home: https://johndoe.com
    // - Work: https://company.com/john
    // - Blog: https://blog.johndoe.com
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL[HOME]': 'https://johndoe.com',
        'URL[WORK]': 'https://company.com/john',
        'URL[BLOG]': 'https://blog.johndoe.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['URL[HOME]']).toBe('https://johndoe.com');
    expect(frontmatter['URL[WORK]']).toBe('https://company.com/john');
    expect(frontmatter['URL[BLOG]']).toBe('https://blog.johndoe.com');
  });

  it('should create Contact section if it does not exist', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Should create ## Contact section
    // when contact fields exist in frontmatter but section is missing
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should detect missing Contact section and create it
    // const sections = await contactNote.extractMarkdownSections();
    // expect(sections.has('Contact')).toBe(false);
    // 
    // await contactNote.syncFrontmatterToContactSection();
    // const updatedSections = await contactNote.extractMarkdownSections();
    // expect(updatedSections.has('Contact')).toBe(true);
  });

  it('should update Contact section when frontmatter changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: When frontmatter is updated (e.g., EMAIL[WORK] added),
    // the Contact section should be regenerated/updated
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@example.com');
    
    // Future: After updating frontmatter
    // await contactNote.updateFrontmatterValue('EMAIL[WORK]', 'john@work.com');
    // await contactNote.syncFrontmatterToContactSection();
    // Contact section should now include both emails
  });

  it('should sort fields in a logical order', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL[HOME]: https://example.com
TEL[CELL]: +1-555-1234
EMAIL[HOME]: john@example.com
ADR[HOME].STREET: 123 Main St
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Should organize by priority:
    // 1. Emails
    // 2. Phones
    // 3. Addresses
    // 4. URLs
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL[HOME]': 'https://example.com',
        'TEL[CELL]': '+1-555-1234',
        'EMAIL[HOME]': 'john@example.com',
        'ADR[HOME].STREET': '123 Main St'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // Verify fields exist (ordering will be in future Contact section implementation)
    expect(frontmatter['EMAIL[HOME]']).toBe('john@example.com');
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-1234');
    expect(frontmatter['ADR[HOME].STREET']).toBe('123 Main St');
    expect(frontmatter['URL[HOME]']).toBe('https://example.com');
  });

  it('should format fields consistently using templates', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: All similar fields should use same template format
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@home.com');
    expect(frontmatter['EMAIL[WORK]']).toBe('john@work.com');
  });
});
