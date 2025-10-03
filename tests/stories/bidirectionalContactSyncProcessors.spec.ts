import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 35: Bidirectional Contact Sync Processors
 * As a user, I want two curator processors that maintain synchronization between 
 * the Contact section and frontmatter, similar to how Related list synchronization works.
 */
describe('Bidirectional Contact Sync Processors Story', () => {
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

  it('should have ContactToFrontMatterProcessor that parses Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: ContactToFrontMatterProcessor should:
    // - Parse Contact section markdown
    // - Extract contact information using fuzzy templates
    // - Update frontmatter with parsed data
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Contact
📧 Email
- Home: john@home.com
- Work: john@work.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: Run ContactToFrontMatterProcessor
    // Should add EMAIL[HOME] and EMAIL[WORK] to frontmatter
  });

  it('should have FrontMatterToContactProcessor that generates Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: FrontMatterToContactProcessor should:
    // - Read frontmatter contact fields
    // - Generate Contact section using fuzzy templates
    // - Add missing contact information to markdown
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
---

#### Notes
Notes here.

#Contact`;

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
    
    // Future: Run FrontMatterToContactProcessor
    // Should create/update Contact section with email information
  });

  it('should run processors as part of the curator pipeline', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Processors should integrate with CuratorManager
    // and run automatically as part of the processing pipeline
    
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
    
    // Future: CuratorManager should run both processors automatically
  });

  it('should preserve data when processing (additive, not destructive)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Processing should merge data, not replace
    // If Contact section has EMAIL[HOME] and frontmatter has EMAIL[WORK],
    // result should have both
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[WORK]: john@work.com
---

#### Contact
📧 Email
- Home: john@home.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[WORK]': 'john@work.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: After bidirectional sync, should have both emails
    // in both frontmatter and Contact section
  });

  it('should update REV timestamp only when data actually changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
REV: 20250101T120000Z
---

#### Contact
📧 Email
- Home: john@home.com

#Contact`;

    // Future implementation: If Contact section matches frontmatter,
    // REV should not be updated
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        REV: '20250101T120000Z'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    const originalRev = frontmatter['REV'];
    
    // Future: After sync with no changes, REV should be same
    // await runContactProcessors();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['REV']).toBe(originalRev);
  });

  it('should update REV when contact data changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
REV: 20250101T120000Z
---

#### Contact
📧 Email
- Home: john@home.com
- Work: john@work.com

#Contact`;

    // Future implementation: If Contact section has new email,
    // REV should be updated
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        REV: '20250101T120000Z'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    const originalRev = frontmatter['REV'];
    
    // Future: After sync with changes, REV should be updated
    // await runContactProcessors();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['REV']).not.toBe(originalRev);
  });

  it('should allow processors to be enabled/disabled in settings', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Settings should have toggles for:
    // - ContactToFrontMatterProcessor
    // - FrontMatterToContactProcessor
    
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
    
    // Future: Check settings for processor enablement
    // if (settings.enableContactToFrontMatter) { ... }
    // if (settings.enableFrontMatterToContact) { ... }
  });

  it('should handle additions from both directions', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Additions should flow bidirectionally
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
---

#### Contact
📧 Email
- Home: john@home.com

📞 Phone
- Work: +1-555-5678

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: After bidirectional sync:
    // - Frontmatter should have EMAIL[HOME] and TEL[WORK] (from Contact section)
    // - Contact section should have EMAIL[WORK] and TEL[CELL] (from frontmatter)
  });

  it('should handle edits from both directions', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: If same field is edited in both places,
    // Contact section should take precedence (user's most recent edit)
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: old@example.com
---

#### Contact
📧 Email
- Home: new@example.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'old@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Future: After sync, frontmatter should have new@example.com
  });

  it('should handle deletions from both directions', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: If field is deleted from Contact section,
    // it should be removed from frontmatter (and vice versa)
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
---

#### Contact
📧 Email
- Work: john@work.com

#Contact`;

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
    
    // Future: After sync, EMAIL[HOME] should be removed from both
    // (deleted from Contact section, so sync removes from frontmatter)
  });
});
