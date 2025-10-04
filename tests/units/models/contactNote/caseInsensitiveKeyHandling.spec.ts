import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Tests for case-insensitive key handling in frontmatter updates
 * 
 * This addresses the issue where field labels with different cases
 * (e.g., "work" vs "WORK") should map to the same frontmatter key.
 */
describe('Case-Insensitive Frontmatter Key Handling', () => {
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

  it('should update existing key when new key differs only in case', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Frontmatter has TEL[WORK] in uppercase
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[WORK]: +1-555-555-5555
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL[WORK]': '+1-555-555-5555'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with same case - should detect change
    await contactNote.updateMultipleFrontmatterValues({
      'TEL[WORK]': '+1-555-555-6666'
    });

    // Should have called modify because the value changed
    expect(mockApp.vault!.modify).toHaveBeenCalled();
  });

  it('should not create duplicate keys with different cases', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
EMAIL[Home]: john@example.com
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[Home]': 'john@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with different case - should update value
    await contactNote.updateMultipleFrontmatterValues({
      'EMAIL[HOME]': 'john.new@example.com'
    });

    // Should have called modify because value changed
    expect(mockApp.vault!.modify).toHaveBeenCalled();
  });

  it('should handle mixed case labels from Contact section parsing', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[WORK]: +1-555-555-5555
EMAIL[home]: old@example.com
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL[WORK]': '+1-555-555-5555',
        'EMAIL[home]': 'old@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Update with normalized uppercase keys
    await contactNote.updateMultipleFrontmatterValues({
      'TEL[WORK]': '+1-555-555-6666',
      'EMAIL[HOME]': 'new@example.com'
    });

    // Should have called modify because values changed
    expect(mockApp.vault!.modify).toHaveBeenCalled();
  });

  it('should recognize case-insensitive match when comparing keys', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
TEL[Work]: 555-555-5555
---`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'TEL[Work]': '555-555-5555'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Try to update with normalized form of same value but uppercase key
    await contactNote.updateMultipleFrontmatterValues({
      'TEL[WORK]': '+1-555-555-5555' // Normalized version of same number, different case key
    });

    // Should NOT update since the value is the same (just normalized)
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });
});
