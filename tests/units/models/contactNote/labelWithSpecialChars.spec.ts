import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Tests for parsing contact fields with labels that contain special characters
 * 
 * This addresses the issue where labels like "Home,pref" were being included
 * in the value instead of being separated as the field label.
 */
describe('Contact Field Labels with Special Characters', () => {
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

  it('should parse label with comma correctly (e.g., "Home,pref")', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

## Contact

📞 Phone
- Home,pref 555-555-5555

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();

    // Should parse the field correctly
    expect(fields).toHaveLength(1);
    expect(fields[0].fieldType).toBe('TEL');
    expect(fields[0].fieldLabel).toBe('Home,pref');
    expect(fields[0].value).toBe('555-555-5555');
    
    // The value should NOT contain the label
    expect(fields[0].value).not.toContain('Home');
    expect(fields[0].value).not.toContain('pref');
  });

  it('should parse multiple labels with special characters', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

## Contact

📧 Email
- work,pref user@example.com
- home,voice info@example.org

📞 Phone
- cell,text 555-123-4567

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();

    expect(fields).toHaveLength(3);
    
    // First email
    expect(fields[0].fieldType).toBe('EMAIL');
    expect(fields[0].fieldLabel).toBe('work,pref');
    expect(fields[0].value).toBe('user@example.com');
    expect(fields[0].value).not.toContain('work');
    
    // Second email
    expect(fields[1].fieldType).toBe('EMAIL');
    expect(fields[1].fieldLabel).toBe('home,voice');
    expect(fields[1].value).toBe('info@example.org');
    expect(fields[1].value).not.toContain('home');
    
    // Phone
    expect(fields[2].fieldType).toBe('TEL');
    expect(fields[2].fieldLabel).toBe('cell,text');
    expect(fields[2].value).toBe('555-123-4567');
    expect(fields[2].value).not.toContain('cell');
  });

  it('should handle colon-separated format with simple labels', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

## Contact

📧 Email
- work: user@work.com
- home: user@home.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();

    expect(fields).toHaveLength(2);
    
    expect(fields[0].fieldType).toBe('EMAIL');
    expect(fields[0].fieldLabel).toBe('work');
    expect(fields[0].value).toBe('user@work.com');
    
    expect(fields[1].fieldType).toBe('EMAIL');
    expect(fields[1].fieldLabel).toBe('home');
    expect(fields[1].value).toBe('user@home.com');
  });

  it('should handle space-separated format with various label types', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const content = `---
UID: john-doe-123
FN: John Doe
---

## Contact

📞 Phone
- work 555-111-2222
- home,pref 555-333-4444
- cell 555-555-6666

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fields = await contactNote.parseContactSection();

    expect(fields).toHaveLength(3);
    
    // Work phone
    expect(fields[0].fieldType).toBe('TEL');
    expect(fields[0].fieldLabel).toBe('work');
    expect(fields[0].value).toBe('555-111-2222');
    
    // Home phone with comma
    expect(fields[1].fieldType).toBe('TEL');
    expect(fields[1].fieldLabel).toBe('home,pref');
    expect(fields[1].value).toBe('555-333-4444');
    expect(fields[1].value).not.toContain('pref');
    
    // Cell phone
    expect(fields[2].fieldType).toBe('TEL');
    expect(fields[2].fieldLabel).toBe('cell');
    expect(fields[2].value).toBe('555-555-6666');
  });
});
