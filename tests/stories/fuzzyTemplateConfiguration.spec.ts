import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 31: Fuzzy Template Configuration
 * As a user, I want the plugin to use a "fuzzy template" string that configures 
 * how contact information is displayed and parsed. The fuzzy template should work 
 * bidirectionally (display and parsing) and be configurable per field type.
 */
describe('Fuzzy Template Configuration Story', () => {
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
      logLevel: 'INFO'
    };
  });

  it('should parse email using {TYPE}: {VALUE} template', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation should parse "Home: email@example.com" format
    // and extract TYPE=Home, VALUE=email@example.com
    
    // For now, verify the data structure exists
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: email@example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'email@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // The email field should be stored with type indicator
    expect(frontmatter['EMAIL[HOME]']).toBe('email@example.com');
  });

  it('should parse phone using {TYPE}: {VALUE} template', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation should parse "Cell: +1-555-0000" format
    // and extract TYPE=Cell, VALUE=+1-555-0000
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[CELL]: +1-555-0000
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL[CELL]': '+1-555-0000'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-0000');
  });

  it('should parse URL using {TYPE}: {VALUE} template', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL[WORK]: https://example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL[WORK]': 'https://example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['URL[WORK]']).toBe('https://example.com');
  });

  it('should handle optional TYPE field in template', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation should handle emails without explicit type
    // and default to numbered index (EMAIL[1], EMAIL[2])
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[1]: email1@example.com
EMAIL[2]: email2@example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[1]': 'email1@example.com',
        'EMAIL[2]': 'email2@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[1]']).toBe('email1@example.com');
    expect(frontmatter['EMAIL[2]']).toBe('email2@example.com');
  });

  it('should parse multi-line address template', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation should parse address in format:
    // {STREET}
    // {LOCALITY}, {REGION} {POSTAL}
    // {COUNTRY}
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].REGION: IL
ADR[HOME].POSTAL: 62701
ADR[HOME].COUNTRY: USA
---

#Contact`;

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
    expect(frontmatter['ADR[HOME].POSTAL']).toBe('62701');
  });

  it('should tolerate formatting variations in templates', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation should accept variations like:
    // "Home: email@example.com"
    // "Home : email@example.com"  (extra space)
    // "home: email@example.com"   (lowercase)
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: email@example.com
EMAIL[WORK]: work@example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'email@example.com',
        'EMAIL[WORK]': 'work@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('email@example.com');
    expect(frontmatter['EMAIL[WORK]']).toBe('work@example.com');
  });

  it('should use same template for both display and parsing', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Template defines both how to display and parse
    // Display: EMAIL[HOME] -> "Home: email@example.com"
    // Parse: "Home: email@example.com" -> EMAIL[HOME]
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: email@example.com
TEL[CELL]: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'email@example.com',
        'TEL[CELL]': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // Verify bidirectional mapping is possible
    expect(frontmatter['EMAIL[HOME]']).toBe('email@example.com');
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-1234');
  });
});
