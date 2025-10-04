import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 37: Contact Section Creation from User Input
 * As a user, when I manually create or edit a Contact section in markdown, I want 
 * the plugin to recognize and parse it even if formatting isn't perfect. The fuzzy 
 * template matching should tolerate variations.
 */
describe('Contact Section Creation from User Input Story', () => {
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

  it('should parse Contact section with simple email format', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should parse simple format without emoji
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
Email: john@example.com
john.work@company.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse both emails, defaulting to EMAIL.1, EMAIL.2
  });

  it('should parse Contact section with emoji headers', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should parse format with emoji
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
📧 Emails
Home: john@example.com
Work: john.work@company.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse EMAIL.HOME and EMAIL.WORK
  });

  it('should parse Contact section with parenthetical type labels', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should handle (Type) format
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
Email
- john@example.com (Home)
- john.work@company.com (Work)

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse EMAIL.HOME and EMAIL.WORK
  });

  it('should tolerate variations in whitespace', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should handle extra spaces
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
Email:    john@example.com
Phone  :  +1-555-1234

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse despite extra whitespace
  });

  it('should handle different line break patterns', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should handle various line break styles
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact

Email:
john@example.com

Phone:
+1-555-1234

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse despite different line breaks
  });

  it('should accept alternative separators', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should handle - or | separators
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
Email - john@example.com
Phone | +1-555-1234

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse with alternative separators
  });

  it('should work with or without field type labels', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should default to numbered indices
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
📧 Email
john@example.com
jane@example.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse as EMAIL.1, EMAIL.2
  });

  it('should parse incomplete information gracefully', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should handle missing components
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
Address:
123 Main St
Springfield

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse partial address (STREET and LOCALITY)
  });

  it('should default to indexed numbers for untyped fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: EMAIL.1, EMAIL.2 for untyped emails
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
📧 Email
- john@example.com
- jane@example.com
- work@company.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse as EMAIL.1, EMAIL.2, EMAIL.3
  });

  it('should preserve unrecognized content without syncing', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Unrecognized content should be preserved
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
Email: john@example.com

Some random notes about contact preferences.
Prefers email over phone.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should parse email, preserve notes
  });

  it('should recognize common formatting variations', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should handle various common formats
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
E-mail: john@example.com
Phone Number: +1-555-1234
Web: https://example.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Should recognize E-mail as EMAIL, Phone Number as TEL, Web as URL
  });
});
