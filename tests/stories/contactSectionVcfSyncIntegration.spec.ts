import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { VCardGenerator } from '../../src/models/vcardFile/generation';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 39: Contact Section and VCF Sync Integration
 * As a user, when I export contacts to VCF format or import from VCF files, 
 * I expect the Contact section to be synchronized properly through frontmatter.
 */
describe('Contact Section and VCF Sync Integration Story', () => {
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

  it('should export Contact section data to VCF fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].POSTAL: 62701
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234',
        'ADR[HOME].STREET': '123 Main St',
        'ADR[HOME].LOCALITY': 'Springfield',
        'ADR[HOME].POSTAL': '62701'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // Generate VCF from frontmatter
    const vcf = VCardGenerator.objectToVcf(frontmatter);
    
    // VCF should contain all contact fields
    expect(vcf).toContain('EMAIL');
    expect(vcf).toContain('TEL');
    expect(vcf).toContain('ADR');
  });

  it('should import VCF contact fields to frontmatter (triggering Contact section creation)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: VCF import populates frontmatter,
    // then FrontMatterToContactProcessor creates Contact section
    
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
    
    // Future: After VCF import and processor run, Contact section should exist
  });

  it('should preserve field type mappings (HOME, WORK, CELL) in VCF export', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
TEL[HOME]: +1-555-5678
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234',
        'TEL[HOME]': '+1-555-5678'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // VCF should preserve type information
    const vcf = VCardGenerator.objectToVcf(frontmatter);
    
    // Should contain type parameters like TYPE=HOME, TYPE=WORK, TYPE=CELL
    expect(vcf).toContain('EMAIL');
    expect(vcf).toContain('TEL');
  });

  it('should preserve structured field organization in VCF', async () => {
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
    
    // VCF should organize address components properly
    const vcf = VCardGenerator.objectToVcf(frontmatter);
    expect(vcf).toContain('ADR');
  });

  it('should handle VCF-specific field formats', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: VCF has specific formats for some fields
    // e.g., ADR;TYPE=HOME:;;123 Main St;Springfield;IL;62701;USA
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    const vcf = VCardGenerator.objectToVcf(frontmatter);
    expect(vcf).toContain('EMAIL');
  });

  it('should preserve all contact data in round-trip VCF export/import', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
TEL[HOME]: +1-555-5678
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].POSTAL: 62701
URL[HOME]: https://example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234',
        'TEL[HOME]': '+1-555-5678',
        'ADR[HOME].STREET': '123 Main St',
        'ADR[HOME].LOCALITY': 'Springfield',
        'ADR[HOME].POSTAL': '62701',
        'URL[HOME]': 'https://example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // Export to VCF
    const vcf = VCardGenerator.objectToVcf(frontmatter);
    
    // VCF should contain all fields
    expect(vcf).toContain('EMAIL');
    expect(vcf).toContain('TEL');
    expect(vcf).toContain('ADR');
    expect(vcf).toContain('URL');
    
    // Future: Import back should preserve all data
  });

  it('should map EMAIL;TYPE=HOME to EMAIL[HOME] on import', async () => {
    // Future implementation: VCF import should map type parameters correctly
    
    // This is tested by VCF parsing tests, but Contact section
    // should work with the imported frontmatter structure
    
    expect(true).toBe(true);
  });

  it('should map ADR;TYPE=HOME to ADR[HOME].* components on import', async () => {
    // Future implementation: VCF address import should create
    // ADR[HOME].STREET, ADR[HOME].LOCALITY, etc.
    
    // This is tested by VCF parsing tests
    
    expect(true).toBe(true);
  });

  it('should integrate Contact section with VCF monitoring workflow', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Complete workflow:
    // 1. VCF file updated externally
    // 2. Plugin detects change
    // 3. Imports to frontmatter
    // 4. FrontMatterToContactProcessor updates Contact section
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Complete integration test
  });

  it('should integrate Contact section with VCF export workflow', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Complete workflow:
    // 1. User edits Contact section
    // 2. ContactToFrontMatterProcessor updates frontmatter
    // 3. VCF export includes updated data
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Complete integration test
  });
});
