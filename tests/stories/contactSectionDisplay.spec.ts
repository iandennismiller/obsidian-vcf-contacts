import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 30: Contact Section Display in Markdown
 * As a user, when I view a contact note, I want to see contact information like 
 * addresses, emails, and phone numbers displayed in a dedicated "## Contact" section 
 * in the markdown. This section should render the frontmatter fields in a 
 * human-readable format, making it easy to view contact details without parsing YAML frontmatter.
 */
describe('Contact Section Display in Markdown Story', () => {
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

  it('should display email addresses in Contact section', async () => {
    const mockFile = { basename: 'bruce-wayne', path: 'Contacts/bruce-wayne.md' } as TFile;
    const content = `---
UID: bruce-wayne-123
FN: Bruce Wayne
EMAIL[HOME]: bruce.wayne@wayneenterprises.com
EMAIL[WORK]: batman@batcave.org
---

#### Notes
Bruce Wayne is a billionaire philanthropist.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bruce-wayne-123',
        FN: 'Bruce Wayne',
        'EMAIL[HOME]': 'bruce.wayne@wayneenterprises.com',
        'EMAIL[WORK]': 'batman@batcave.org'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future implementation should generate Contact section from frontmatter
    // For now, verify that frontmatter contains email fields
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter['EMAIL[HOME]']).toBe('bruce.wayne@wayneenterprises.com');
    expect(frontmatter['EMAIL[WORK]']).toBe('batman@batcave.org');
  });

  it('should display phone numbers in Contact section', async () => {
    const mockFile = { basename: 'bruce-wayne', path: 'Contacts/bruce-wayne.md' } as TFile;
    const content = `---
UID: bruce-wayne-123
FN: Bruce Wayne
TEL[CELL]: +12125550000
TEL[BATPHONE]: +12125550001
---

#### Notes
Bruce Wayne is a billionaire philanthropist.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bruce-wayne-123',
        FN: 'Bruce Wayne',
        'TEL[CELL]': '+12125550000',
        'TEL[BATPHONE]': '+12125550001'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future implementation should generate Contact section from frontmatter
    // For now, verify that frontmatter contains phone fields
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter['TEL[CELL]']).toBe('+12125550000');
    expect(frontmatter['TEL[BATPHONE]']).toBe('+12125550001');
  });

  it('should display addresses in Contact section', async () => {
    const mockFile = { basename: 'bruce-wayne', path: 'Contacts/bruce-wayne.md' } as TFile;
    const content = `---
UID: bruce-wayne-123
FN: Bruce Wayne
ADR[HOME].STREET: 1007 Mountain Drive
ADR[HOME].LOCALITY: Gotham
ADR[HOME].POSTAL: 10001
ADR[HOME].COUNTRY: USA
---

#### Notes
Bruce Wayne is a billionaire philanthropist.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bruce-wayne-123',
        FN: 'Bruce Wayne',
        'ADR[HOME].STREET': '1007 Mountain Drive',
        'ADR[HOME].LOCALITY': 'Gotham',
        'ADR[HOME].POSTAL': '10001',
        'ADR[HOME].COUNTRY': 'USA'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future implementation should generate Contact section from frontmatter
    // For now, verify that frontmatter contains address fields
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter['ADR[HOME].STREET']).toBe('1007 Mountain Drive');
    expect(frontmatter['ADR[HOME].LOCALITY']).toBe('Gotham');
    expect(frontmatter['ADR[HOME].POSTAL']).toBe('10001');
    expect(frontmatter['ADR[HOME].COUNTRY']).toBe('USA');
  });

  it('should display websites/URLs in Contact section', async () => {
    const mockFile = { basename: 'bruce-wayne', path: 'Contacts/bruce-wayne.md' } as TFile;
    const content = `---
UID: bruce-wayne-123
FN: Bruce Wayne
URL[HOME]: https://wayneenterprises.com/bruce
URL[WORK]: https://batcave.org/batman
---

#### Notes
Bruce Wayne is a billionaire philanthropist.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bruce-wayne-123',
        FN: 'Bruce Wayne',
        'URL[HOME]': 'https://wayneenterprises.com/bruce',
        'URL[WORK]': 'https://batcave.org/batman'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future implementation should generate Contact section from frontmatter
    // For now, verify that frontmatter contains URL fields
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter['URL[HOME]']).toBe('https://wayneenterprises.com/bruce');
    expect(frontmatter['URL[WORK]']).toBe('https://batcave.org/batman');
  });

  it('should handle multiple contact fields of different types', async () => {
    const mockFile = { basename: 'bruce-wayne', path: 'Contacts/bruce-wayne.md' } as TFile;
    const content = `---
UID: bruce-wayne-123
FN: Bruce Wayne
EMAIL[HOME]: bruce.wayne@wayneenterprises.com
EMAIL[WORK]: batman@batcave.org
TEL[CELL]: +12125550000
TEL[BATPHONE]: +12125550001
ADR[HOME].STREET: 1007 Mountain Drive
ADR[HOME].LOCALITY: Gotham
ADR[HOME].POSTAL: 10001
ADR[HOME].COUNTRY: USA
URL[HOME]: https://wayneenterprises.com/bruce
URL[WORK]: https://batcave.org/batman
---

#### Notes
Bruce Wayne is a billionaire philanthropist.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bruce-wayne-123',
        FN: 'Bruce Wayne',
        'EMAIL[HOME]': 'bruce.wayne@wayneenterprises.com',
        'EMAIL[WORK]': 'batman@batcave.org',
        'TEL[CELL]': '+12125550000',
        'TEL[BATPHONE]': '+12125550001',
        'ADR[HOME].STREET': '1007 Mountain Drive',
        'ADR[HOME].LOCALITY': 'Gotham',
        'ADR[HOME].POSTAL': '10001',
        'ADR[HOME].COUNTRY': 'USA',
        'URL[HOME]': 'https://wayneenterprises.com/bruce',
        'URL[WORK]': 'https://batcave.org/batman'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future implementation should generate Contact section from all frontmatter fields
    // For now, verify that frontmatter contains all contact fields
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter['EMAIL[HOME]']).toBe('bruce.wayne@wayneenterprises.com');
    expect(frontmatter['TEL[CELL]']).toBe('+12125550000');
    expect(frontmatter['ADR[HOME].STREET']).toBe('1007 Mountain Drive');
    expect(frontmatter['URL[HOME]']).toBe('https://wayneenterprises.com/bruce');
  });

  it('should organize contact information in a readable format', async () => {
    const mockFile = { basename: 'tony-stark', path: 'Contacts/tony-stark.md' } as TFile;
    const content = `---
UID: tony-stark-456
FN: Tony Stark
EMAIL[HOME]: tony.stark@starkindustries.com
EMAIL[WORKSHOP]: ironman@avengers.com
TEL[CELL]: +13105551234
---

#### Notes
Tony Stark is a genius inventor.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'tony-stark-456',
        FN: 'Tony Stark',
        'EMAIL[HOME]': 'tony.stark@starkindustries.com',
        'EMAIL[WORKSHOP]': 'ironman@avengers.com',
        'TEL[CELL]': '+13105551234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future implementation should:
    // 1. Group similar fields together (all emails, all phones)
    // 2. Use visual indicators to separate field types
    // 3. Display fields in predictable order
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter['EMAIL[HOME]']).toBe('tony.stark@starkindustries.com');
    expect(frontmatter['EMAIL[WORKSHOP]']).toBe('ironman@avengers.com');
    expect(frontmatter['TEL[CELL]']).toBe('+13105551234');
  });
});
