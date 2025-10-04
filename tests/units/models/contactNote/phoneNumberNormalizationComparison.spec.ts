import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Tests for phone number normalization during frontmatter comparison
 * 
 * This addresses the issue where editing a Contact list with a new work phone number
 * would not update the frontmatter because the comparison wasn't normalizing both values.
 */
describe('Phone Number Normalization in Frontmatter Comparison', () => {
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

  it('should not update when phone numbers are the same but in different formats', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Frontmatter has non-normalized format
    const content = `---
UID: john-doe-123
FN: John Doe
TEL.WORK: 555-555-5555
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL.WORK': '555-555-5555'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with normalized version of the same number
    await contactNote.updateMultipleFrontmatterValues({
      'TEL.WORK': '+1-555-555-5555'
    });

    // Should NOT have called modify because the numbers are the same
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });

  it('should update when phone number actually changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL.WORK: +1-555-555-5555
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL.WORK': '+1-555-555-5555'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with a DIFFERENT number
    await contactNote.updateMultipleFrontmatterValues({
      'TEL.WORK': '+1-555-555-6666'
    });

    // SHOULD have called modify because the number changed
    expect(mockApp.vault!.modify).toHaveBeenCalled();
  });

  it('should handle various phone number formats correctly', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL.WORK: (555) 555-5555
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL.WORK': '(555) 555-5555'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // All these formats represent the same number
    const formats = [
      '555-555-5555',
      '5555555555',
      '+1-555-555-5555',
      '+15555555555',
      '1-555-555-5555'
    ];

    for (const format of formats) {
      vi.clearAllMocks();
      await contactNote.updateMultipleFrontmatterValues({
        'TEL.WORK': format
      });

      // Should NOT update since it's the same number
      expect(mockApp.vault!.modify).not.toHaveBeenCalled();
    }
  });

  it('should normalize and compare email addresses correctly', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.WORK: John@Example.COM
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.WORK': 'John@Example.COM'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with lowercase version (same email, different case)
    await contactNote.updateMultipleFrontmatterValues({
      'EMAIL.WORK': 'john@example.com'
    });

    // Should NOT update because email normalization lowercases both
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });

  it('should normalize and compare URLs correctly', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
URL.WORK: example.com
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'URL.WORK': 'example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with protocol-prefixed version (same URL)
    await contactNote.updateMultipleFrontmatterValues({
      'URL.WORK': 'https://example.com'
    });

    // Should NOT update because URL normalization adds protocol to both
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });

  it('should update when email actually changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.WORK: old@example.com
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.WORK': 'old@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with a DIFFERENT email
    await contactNote.updateMultipleFrontmatterValues({
      'EMAIL.WORK': 'new@example.com'
    });

    // SHOULD update because email changed
    expect(mockApp.vault!.modify).toHaveBeenCalled();
  });

  it('should handle multiple fields with mixed changes and no-changes', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.WORK: john@example.com
TEL.WORK: 555-555-5555
URL.WORK: example.com
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.WORK': 'john@example.com',
        'TEL.WORK': '555-555-5555',
        'URL.WORK': 'example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with normalized versions (no actual changes)
    await contactNote.updateMultipleFrontmatterValues({
      'EMAIL.WORK': 'john@example.com',
      'TEL.WORK': '+1-555-555-5555',  // Same number, different format
      'URL.WORK': 'https://example.com'  // Same URL, different format
    });

    // Should NOT update since all values are semantically the same
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });

  it('should update when at least one field changes among multiple fields', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL.WORK: john@example.com
TEL.WORK: 555-555-5555
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL.WORK': 'john@example.com',
        'TEL.WORK': '555-555-5555'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with one same value and one changed value
    await contactNote.updateMultipleFrontmatterValues({
      'EMAIL.WORK': 'john@example.com',  // Same
      'TEL.WORK': '+1-555-555-6666'  // Changed
    });

    // SHOULD update because TEL changed
    expect(mockApp.vault!.modify).toHaveBeenCalled();

    // Verify the phone number was updated
    const modifyCall = (mockApp.vault!.modify as any).mock.calls[0];
    expect(modifyCall[1]).toContain('TEL.WORK: +1-555-555-6666');
  });
});
