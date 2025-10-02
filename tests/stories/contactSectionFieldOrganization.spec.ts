import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 34: Contact Section Field Organization
 * As a user, I want contact information in the Contact section to be organized 
 * logically and consistently. The plugin should group similar fields together, 
 * use visual indicators, and display fields in a predictable order.
 */
describe('Contact Section Field Organization Story', () => {
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

  it('should group email addresses together', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
EMAIL[PERSONAL]: john@personal.com
---

#Contact`;

    // Future implementation: All emails should be in one Email subsection
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'EMAIL[PERSONAL]': 'john@personal.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@home.com');
    expect(frontmatter['EMAIL[WORK]']).toBe('john@work.com');
    expect(frontmatter['EMAIL[PERSONAL]']).toBe('john@personal.com');
  });

  it('should group phone numbers together', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[CELL]: +1-555-1111
TEL[HOME]: +1-555-2222
TEL[WORK]: +1-555-3333
TEL[FAX]: +1-555-4444
---

#Contact`;

    // Future implementation: All phones should be in one Phone subsection
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL[CELL]': '+1-555-1111',
        'TEL[HOME]': '+1-555-2222',
        'TEL[WORK]': '+1-555-3333',
        'TEL[FAX]': '+1-555-4444'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-1111');
    expect(frontmatter['TEL[HOME]']).toBe('+1-555-2222');
    expect(frontmatter['TEL[WORK]']).toBe('+1-555-3333');
  });

  it('should use visual indicators to separate field types', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
TEL[CELL]: +1-555-1234
URL[HOME]: https://example.com
---

#Contact`;

    // Future implementation: Should use emoji/headers like:
    // 📧 Email
    // 📞 Phone
    // 🌐 Website
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'TEL[CELL]': '+1-555-1234',
        'URL[HOME]': 'https://example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@home.com');
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-1234');
    expect(frontmatter['URL[HOME]']).toBe('https://example.com');
  });

  it('should display fields in predictable order (Email, Phone, Address, URL)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL[HOME]: https://example.com
ADR[HOME].STREET: 123 Main St
TEL[CELL]: +1-555-1234
EMAIL[HOME]: john@home.com
---

#Contact`;

    // Future implementation: Contact section should display in order:
    // 1. Email, 2. Phone, 3. Address, 4. URL
    // Regardless of frontmatter order
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL[HOME]': 'https://example.com',
        'ADR[HOME].STREET': '123 Main St',
        'TEL[CELL]': '+1-555-1234',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@home.com');
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-1234');
    expect(frontmatter['ADR[HOME].STREET']).toBe('123 Main St');
    expect(frontmatter['URL[HOME]']).toBe('https://example.com');
  });

  it('should format addresses as complete postal address blocks', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].REGION: IL
ADR[HOME].POSTAL: 62701
ADR[HOME].COUNTRY: USA
ADR[WORK].STREET: 456 Business Blvd
ADR[WORK].LOCALITY: Chicago
ADR[WORK].REGION: IL
ADR[WORK].POSTAL: 60601
ADR[WORK].COUNTRY: USA
---

#Contact`;

    // Future implementation: Should format as:
    // 🏠 Address (Home)
    // 123 Main St
    // Springfield, IL 62701
    // USA
    //
    // 🏢 Address (Work)
    // 456 Business Blvd
    // Chicago, IL 60601
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
        'ADR[HOME].COUNTRY': 'USA',
        'ADR[WORK].STREET': '456 Business Blvd',
        'ADR[WORK].LOCALITY': 'Chicago',
        'ADR[WORK].REGION': 'IL',
        'ADR[WORK].POSTAL': '60601',
        'ADR[WORK].COUNTRY': 'USA'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['ADR[HOME].STREET']).toBe('123 Main St');
    expect(frontmatter['ADR[WORK].STREET']).toBe('456 Business Blvd');
  });

  it('should show field type labels clearly (Home, Work, Cell, etc.)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: home@example.com
EMAIL[WORK]: work@example.com
TEL[CELL]: +1-555-1111
TEL[HOME]: +1-555-2222
---

#Contact`;

    // Future implementation: Labels should be clear:
    // - Home: home@example.com
    // - Work: work@example.com
    // - Cell: +1-555-1111
    // - Home: +1-555-2222
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'home@example.com',
        'EMAIL[WORK]': 'work@example.com',
        'TEL[CELL]': '+1-555-1111',
        'TEL[HOME]': '+1-555-2222'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('home@example.com');
    expect(frontmatter['EMAIL[WORK]']).toBe('work@example.com');
  });

  it('should handle complex structured fields like addresses properly', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR[HOME].POBOX: PO Box 123
ADR[HOME].EXTENDED: Apt 4B
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].REGION: IL
ADR[HOME].POSTAL: 62701
ADR[HOME].COUNTRY: USA
---

#Contact`;

    // Future implementation: Should handle all address components:
    // PO Box, Extended Address, Street, Locality, Region, Postal, Country
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'ADR[HOME].POBOX': 'PO Box 123',
        'ADR[HOME].EXTENDED': 'Apt 4B',
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
    expect(frontmatter['ADR[HOME].EXTENDED']).toBe('Apt 4B');
  });

  it('should include social media and other contact fields in correct order', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
TEL[CELL]: +1-555-1234
ADR[HOME].STREET: 123 Main St
URL[HOME]: https://johndoe.com
URL[TWITTER]: https://twitter.com/johndoe
URL[LINKEDIN]: https://linkedin.com/in/johndoe
---

#Contact`;

    // Future implementation: Order should be:
    // 1. Email, 2. Phone, 3. Address, 4. Website, 5. Social media
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@example.com',
        'TEL[CELL]': '+1-555-1234',
        'ADR[HOME].STREET': '123 Main St',
        'URL[HOME]': 'https://johndoe.com',
        'URL[TWITTER]': 'https://twitter.com/johndoe',
        'URL[LINKEDIN]': 'https://linkedin.com/in/johndoe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@example.com');
    expect(frontmatter['URL[TWITTER]']).toBe('https://twitter.com/johndoe');
  });
});
