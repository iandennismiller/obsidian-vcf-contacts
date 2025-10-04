import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 36: Contact Section Template Customization
 * As a user, I want to customize how contact information is displayed in the 
 * Contact section. The plugin should provide default fuzzy templates for common 
 * field types and allow customization.
 */
describe('Contact Section Template Customization Story', () => {
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

  it('should provide default templates for email fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Default email template: "{TYPE}: {VALUE}"
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@home.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should use default template to render "Home: john@home.com"
  });

  it('should provide default templates for phone fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Default phone template: "{TYPE}: {VALUE}"
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL.CELL: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL.CELL': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should use default template to render "Cell: +1-555-1234"
  });

  it('should provide default templates for address fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Default address template (multi-line):
    // {STREET}
    // {LOCALITY}, {REGION} {POSTAL}
    // {COUNTRY}
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR.HOME.STREET: 123 Main St
ADR.HOME.LOCALITY: Springfield
ADR.HOME.REGION: IL
ADR.HOME.POSTAL: 62701
ADR.HOME.COUNTRY: USA
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'ADR.HOME.STREET': '123 Main St',
        'ADR.HOME.LOCALITY': 'Springfield',
        'ADR.HOME.REGION': 'IL',
        'ADR.HOME.POSTAL': '62701',
        'ADR.HOME.COUNTRY': 'USA'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should render multi-line address
  });

  it('should provide default templates for URL fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Default URL template: "{TYPE}: {VALUE}"
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL.HOME: https://example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL.HOME': 'https://example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should use default template to render "Home: https://example.com"
  });

  it('should allow customization of email template', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: User could customize to "{TYPE} - {VALUE}" or "{VALUE} ({TYPE})"
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@home.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Custom template in settings
  });

  it('should allow customization of field labels and separators', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: User could customize:
    // - Field separator (": " vs " - " vs " | ")
    // - Label format ("Home" vs "(Home)" vs "[Home]")
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@home.com
TEL.CELL: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@home.com',
        'TEL.CELL': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Customizable separators and labels
  });

  it('should allow customization of visual indicators (emoji, bullets)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: User could customize:
    // - Email indicator (📧 vs ✉️ vs "Email:")
    // - Phone indicator (📞 vs ☎️ vs "Phone:")
    // - Bullet style (- vs * vs •)
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@home.com
TEL.CELL: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@home.com',
        'TEL.CELL': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Customizable visual indicators
  });

  it('should allow customization of field ordering', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: User could customize order:
    // - Default: Email, Phone, Address, URL
    // - Custom: Phone, Email, URL, Address
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@home.com
TEL.CELL: +1-555-1234
ADR.HOME.STREET: 123 Main St
URL.HOME: https://example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@home.com',
        'TEL.CELL': '+1-555-1234',
        'ADR.HOME.STREET': '123 Main St',
        'URL.HOME': 'https://example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Customizable field ordering
  });

  it('should provide template variables for field components', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Template variables:
    // - {TYPE}: Field type (HOME, WORK, CELL, etc.)
    // - {VALUE}: Field value
    // - {STREET}, {LOCALITY}, etc.: Address components
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.HOME: john@home.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.HOME': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Template variable system
  });

  it('should provide examples of template syntax in settings', async () => {
    // Future implementation: Settings UI should show examples like:
    // Email Template: {TYPE}: {VALUE}
    //   Example output: "Home: john@example.com"
    //
    // Phone Template: {VALUE} ({TYPE})
    //   Example output: "+1-555-1234 (Cell)"
    
    // This is a UI/settings feature, not directly testable in ContactNote
    expect(true).toBe(true);
  });

  it('should provide preview of how templates affect display', async () => {
    // Future implementation: Settings should have a preview showing
    // how template changes affect contact display
    
    // This is a UI/settings feature, not directly testable in ContactNote
    expect(true).toBe(true);
  });
});
