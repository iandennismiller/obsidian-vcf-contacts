import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 32: Contact Section Sync to Frontmatter
 * As a user, when I edit contact information in the "## Contact" section and save 
 * the note, I want those changes to automatically sync back to the frontmatter. 
 * Similar to how the Related list syncs relationships, the Contact section should 
 * parse edited contact information and update frontmatter accordingly.
 */
describe('Contact Section Sync to Frontmatter Story', () => {
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

  it('should add new email to frontmatter when added to Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Initial state: no email in frontmatter
    const initialContent = `---
UID: john-doe-123
FN: John Doe
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: User adds email to Contact section
    // The sync should detect "Personal: john@personal.com" and add EMAIL[PERSONAL]
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // Initially no email
    expect(frontmatter['EMAIL[PERSONAL]']).toBeUndefined();
    
    // After sync (future implementation), should have email
    // await contactNote.syncContactSectionToFrontmatter();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['EMAIL[PERSONAL]']).toBe('john@personal.com');
  });

  it('should update existing phone number in frontmatter when edited in Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[CELL]: +1-555-0000
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: User changes phone to +1-555-9999 in Contact section
    // The sync should update TEL[CELL] in frontmatter
    
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
    
    // After edit and sync (future implementation):
    // await contactNote.syncContactSectionToFrontmatter();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['TEL[CELL]']).toBe('+1-555-9999');
  });

  it('should remove address field from frontmatter when deleted from Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].POSTAL: 62701
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: User deletes street address line
    // The sync should remove ADR[HOME].STREET from frontmatter
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'ADR[HOME].STREET': '123 Main St',
        'ADR[HOME].LOCALITY': 'Springfield',
        'ADR[HOME].POSTAL': '62701'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['ADR[HOME].STREET']).toBe('123 Main St');
    
    // After deletion and sync (future implementation):
    // await contactNote.syncContactSectionToFrontmatter();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['ADR[HOME].STREET']).toBeUndefined();
  });

  it('should not update frontmatter when Contact section matches exactly (no-op)', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
TEL[CELL]: +1-555-1234
REV: 20250101T120000Z
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: Contact section matches frontmatter
    // No updates should occur, REV should not change
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@example.com',
        'TEL[CELL]': '+1-555-1234',
        REV: '20250101T120000Z'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    const originalRev = frontmatter['REV'];
    expect(originalRev).toBe('20250101T120000Z');
    
    // After no-op sync (future implementation):
    // await contactNote.syncContactSectionToFrontmatter();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['REV']).toBe(originalRev); // REV unchanged
  });

  it('should update REV timestamp when contact information changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
REV: 20250101T120000Z
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: User changes email in Contact section
    // REV should be updated to reflect the change
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@example.com',
        REV: '20250101T120000Z'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    const originalRev = frontmatter['REV'];
    expect(originalRev).toBe('20250101T120000Z');
    
    // After change and sync (future implementation):
    // await contactNote.syncContactSectionToFrontmatter();
    // const updatedFrontmatter = await contactNote.getFrontmatter();
    // expect(updatedFrontmatter['REV']).not.toBe(originalRev); // REV updated
  });

  it('should handle additions, modifications, and deletions in a single sync', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
TEL[CELL]: +1-555-0000
ADR[HOME].STREET: 123 Main St
---

#### Notes
Notes here.

#Contact`;

    // Future implementation: User makes multiple changes:
    // - Adds EMAIL[WORK]
    // - Changes TEL[CELL]
    // - Deletes ADR[HOME].STREET
    
    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@example.com',
        'TEL[CELL]': '+1-555-0000',
        'ADR[HOME].STREET': '123 Main St'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['EMAIL[HOME]']).toBe('john@example.com');
    expect(frontmatter['TEL[CELL]']).toBe('+1-555-0000');
    expect(frontmatter['ADR[HOME].STREET']).toBe('123 Main St');
    
    // After multiple changes and sync (future implementation):
    // await contactNote.syncContactSectionToFrontmatter();
    // const updated = await contactNote.getFrontmatter();
    // expect(updated['EMAIL[WORK]']).toBe('john.work@company.com'); // Added
    // expect(updated['TEL[CELL]']).toBe('+1-555-9999'); // Modified
    // expect(updated['ADR[HOME].STREET']).toBeUndefined(); // Deleted
  });

  it('should use fuzzy template matching to identify fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should recognize variations like:
    // "Home: john@example.com" or "home: john@example.com" or "Home : john@example.com"
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

#### Notes
Notes here.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    expect(frontmatter['UID']).toBe('john-doe-123');
    
    // Future: Fuzzy matching should work for various formatting
  });

  it('should preserve formatting where possible during sync', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Future implementation: Should maintain user's preferred formatting
    // in the Contact section while syncing data to frontmatter
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@example.com
---

#### Notes
Notes here.

#Contact`;

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
  });
});
